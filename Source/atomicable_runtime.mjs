import assert from "assert";

export const MAGIC_FN_TAG = Symbol( "magic fn tag" );
const CTX_STATE_ACTIVE    = Symbol( "context state active" );
const CTX_STATE_PAUSED    = Symbol( "context state paused" );
const CTX_STATE_FINISHED  = Symbol( "context state finished" );

function makeContext( global, prev )
{
    return {
        global  : global,
        waiters : [],
        prev    : prev,
        state   : CTX_STATE_ACTIVE,
        mutex   : mutex()
    };
}

export async function main( f )
{
    assert( MAGIC_FN_TAG in f );
    const global = {};
    global.current = makeContext( global, null );
    return await f[ MAGIC_FN_TAG ]( global.current );
}

/* NOTE: The idea here is that checking for atomic mode only at awaits
 * might not be "good enough".  But I think it probably is.  Regular
 * calls are not going to be interrupted anyway. */
export async function call( ctx, callee, method, ...params )
{
    wait();
    call();
    wait();
}

/* NOTE: As of the writing of this comment, atomic bodies are statements.
 * Might be good to also support expressions? */

export async function enterAtomic( ctx, body )
{
    if( !ctx )
    {
        return null;
    }
    await mutexAcquire( ctx.mutex, () => { ctx.state = CTX_STATE_PAUSED; } );
    ctx.state = CTX_STATE_ACTIVE;
    const global = ctx.global;
    global.current = makeContext( global, ctx );
    return global.current;
}

/* NOTE: Currently there is no good reason for this function to be
 * async.  However, in the future it's possible that there will be cases
 * where we want code to pause at the end of atomic blocks for
 * concurrent flows of some sort to finish. */
export async function exitAtomic( new_ctx )
{
    if( !new_ctx )
    {
        return;
    }
    assert( new_ctx.waiters.length === 0 );
    const ctx = new_ctx.prev;
    const global = new_ctx.global;
    assert( ctx.global === global );
    global.current = ctx;
    new_ctx.state = CTX_STATE_FINISHED;
    if( ctx.mutex.waiters.length === 0 )
    {
        for( const waiter of ctx.waiters )
        {
            waiter();
        }
        ctx.waiters = [];
    }
    mutexRelease( ctx.mutex );
}

export function inAtomicMode( ctx )
{
    if( !ctx )
    {
        return false;
    }
    return !( ctx.prev === null );
}

export async function wait( ctx )
{
    if( !ctx )
    {
        return;
    }

    while( true )
    {
        var effective_ctx = ctx;
        while( effective_ctx.state === CTX_STATE_FINISHED )
        {
            effective_ctx = effective_ctx.prev;
        }

        if( ctx.global.current === effective_ctx )
        {
            ctx.state = CTX_STATE_ACTIVE;
            return;
        }
        ctx.state = CTX_STATE_PAUSED;
        await new Promise(
            ( resolve ) => { effective_ctx.waiters.push( resolve ) }
        );
    }
}

function mutex()
{
    return {
        acquired: false,
        waiters: []
    };
}

async function mutexAcquire( m, wait_callback )
{
    if( m.acquired )
    {
        if( wait_callback )
        {
            wait_callback();
        }
        await new Promise(
            ( resolve ) => { m.waiters.push( resolve ); }
        );
    }
    else
    {
        m.acquired = true;
    }
}

function mutexRelease( m )
{
    assert( m.acquired );
    if( m.waiters.length > 0 )
    {
        const resolve = m.waiters.shift();
        resolve();
    }
    else
    {
        m.acquired = false;
    }
}
