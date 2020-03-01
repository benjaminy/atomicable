# atomicable
Atomic Blocks for Async Functions in JS

## A Tiny Example

Here is a small and silly example of what this library does.

```javascript
function delayed_console_log( message )
{
    return new Promise(
        ( resolve ) => {
            setTimeout( 1, () => {
                console.log( message );
                resolve();
            } );
        }
    )
}

async function abc()
{
    atomicish:
    {
        await delayed_console_log( "A" );
        await delayed_console_log( "B" );
        await delayed_console_log( "C" );
    }
}
```

If this is interpreted as normal JavaScript code, the output of "A", "B" and "C" could be interleaved with whatever other concurrent asynchronous continuations.
This library makes it so that other concurrent continuations will pause themselves while any code is running in an `atomicish` block.

## How? (Part 1)

There are two parts of this library: a Babel plugin and a small runtime library.
The Babel plugin rewrites function calls, function definitions, await expressions and blocks labeled `atomicish`.
Await expressions are modified to check if some concurrent async flow is in atomicish mode; if so, that await pauses itself until that `atomicish` block is finished.
The function definitions and calls are modified to pass along a context reference so that async continuation flows that are "inside" `atomicish` blocks can be distinguished from those that are not.

## Why? (Part 1)

_Atomicity violations_ is a broad category of concurrency bugs.
Classic data races are the simplest kind of atomicity violation, where two (or more) threads access the same shared memory locations without appropriate synchronization, like mutex release/acquire.
(At least one of the accesses must be a write).
Classic data races are not a thing in normal JavaScript, because it doesn't have shared-memory multithreading (unless shared memory between Workers has become a thing?).

But atomicity violations at a coarser granularity are absolutely possible.
These can occur when a programmer (often unintentionally) assumes that a chain of continuations happen in sequence without the state of the program being modified by some other continuation.
The sequence of calls to `delayed_console_log` are an example (again, a pretty silly one) of such a chain.

Here's a slightly more interesting example:

```javascript
function sleep( milliseconds )
{
    return new Promise(
        resolve => setTimeout( resolve, milliseconds )
    );
}

async function delayedMessage( seconds, msg )
{
    await sleep( seconds * 1000 );
    console.log( msg );
}

async function abc( msg )
{
    atomicish:
    {
        await delayedMessage( 1, "A"+msg );
        await delayedMessage( 1, "B"+msg );
        await delayedMessage( 1, "C"+msg );
    }
}

async function main()
{
    const promises = [];
    for( var i = 0; i < 3; ++i )
    {
        promises.push( abc( i ) );
    }
    await Promise.all( promises );
}

__atomicable_main( main ).then(
    () => { console.log( "Test's all done." ) }
);
```

Without the `atomicish` block, the order of `log`s is "A0, A1, A2, B0, B1, B2, C0, C1, C2".
With `atomicish` it is "A0, B0, C0, A1, B1, C1, A2, B2, C2".
That is, the `log`s performed by a call to `abc` all happen without interruption.

## How (Part 2)

Here's a rough sketch of how the transformations work:

```javascript
function fubar( x, y, z ) { stuff }

~>

const fubar = ( () => {
    const magic = { x : null };
    function fubar( x, y, z ) // named "fubar" so it looks right for debugging
    {
        if( magic.x )
        {
            const __context = magic.x;
            magic.x = null;
            [[ stuff ]] // transformed with context
        }
        else
        {
            [[ stuff ]] // transformed without context
        }
    }
    fubar[ MAGIC_FN_TAG ] = magic;
    return fubar;
} )()
```

```javascript
e1( x, y, z )

~>

( ( callee ) => {
    if( MAGIC_FN_TAG in callee )
        callee[ MAGIC_FN_TAG ].x = __context;
    return callee( x, y, z );
} )
( e1 )
```

In English, these function definition and call transformations pass an extra context parameter through a somewhat tortured route.
We jump through these hoops to avoid modifying `fubar`'s arguments.
Notice there are two copies of `fubar`'s translated body.
This will cause a code size explosion if there are deeply nested function definitions in the original source.
If this is ever a problem in practice, _lambda lifting_ is the answer.

So far we haven't really accomlished anything.
Looking at the translation of `atomicish` shows what we're driving at here.

```javascript
atomicish: {
   body
}

~>

{
    const __dumb_js_scope_workaround = __context;
    {
        // Shadow outer binding of __context
        const __context = await Runtime.enterAtomic( __dumb_js_scope_workaround );
        try     { [[ body ]]; }
        finally { await Runtime.exitAtomic( __context ); }
    }
}
```

And finally how `atomicish` is enforced:

```javascript
await body

~>

await ( ( async () => {
    await Runtime.wait( __context );
    try     { return await [[ body ]]; }
    finally { await Runtime.wait( __context ) } } )() )
```

The `wait` function in the runtime library checks whether the current continuation flow should pause.
It should pause if there is an atomic block going and this continuation is not "inside" it.

## A Little Theory

Vanilla JS does not have any thread-like primitive.
From its beginning JS has supported non-parallel concurrency via the event dispatcher (I prefer "event _dispatcher_" to "event _loop_" because I think it describes what it does better).
Original JS used callbacks to register continuations, then came _Promises_, then _generator functions_ and _async functions_.
These are all ways to register continuations whose execution can be interleaved with unrelated bits of application code.

One weakness of JS's continuation-based approach to concurrency is that it does not make it easy to distinguish between intentional concurrency, coninuations used to avoid blocking/starvation, and incidental concurrency.
For example, consider the following tiny snippets of code:

```javascript
    var x1 = await thing1();
    var x2 = await thing2();
```

```javascript
    var p  = thing1();
    var x2 = await thing2();
    var x1 = await p;
```

In the first case `thing1` and `thing2` are serialized, but continuations from unrelated code can still be interleaved arbitrarily with whatever chain of continuations those functions create.
In the second case `thing1` and `thing2` are run concurrently.
Note that I _do not_ mean concurrent in the sense of parallel, like running simultaneous on multicores.
But their chains continuations can be interleaved with each other.
In particular if `thing1` and `thing2` do some long-latency things (like make network requests), those things can be overlapped in time.

The thing that's slightly weird about async functions is that _every_ call to an async function by default creates the possibility of concurrency.
The programmer has to add the additional `await` syntax to prevent that concurrency.
Which might sound kind of cool, but in fact __a strong majority of calls to async functions in JS and C\# projects on Github are immediately `await`'d__.

...

## Why (Part 2)

The idea of enforcing atomicity on a chain of continuations might seem unnecessary: a bit of added complexity for little benefit.
There has been some research on the impact of concurrency bugs in JS (For example, "A Comprehensive Study on Real World Concurrency Bugs in Node.js" [IEEE](https://ieeexplore.ieee.org/document/8115663), [ACM](https://dl.acm.org/doi/10.5555/3155562.3155628), [.pdf](http://www.tcse.cn/~wsdou/papers/2017-ase-nodecb.pdf)).

As a subtler bit of evidence that there's an interesting tricky trade-off between atomicity and interruptibility, in widely used standard libraries (like Node.js and .NET Core) there are lots of "duplicate" functions of the form `XXX` and `XXX\_sync` (or `XXX` and `XXX\_async`).
It seems at first glance that only the async version should be necessary; application code can always `await` an async call to block the current continuation chain.
But in fact sometimes one really wants to block the whole application until some set of actions are done.
Providing duplicate sync and async versions of library functions is a deeply unsatisfying way to accomplish this.
Having a generic atomic block is much nicer.

## Limitations

This library works by modifying __all__ function definitions and calls.
The intention is that code modified by this library can still interact normally with unmodified JS code.
However, unmodified code will not pass along the context information and therefore all control flows that pass through unmodified code will not respect this library's atomic blocks.

No effort has been made to pass the context through callback-style APIs.
The most obvious way to do this would be to explicitly identify functions that take asynchronous callbacks (like setTimeout), which would be extremely tedious and prone to missing some.
I guess __every__ call could be modified to check for waiting, but that seems a little extreme.

I haven't thought much about _generator functions_ yet.
Currently the library ignores them.
It's possible that they could be modified in a sensible way.

## Status and Caveats

This is a research project; use in production code is strongly discouraged.
Some effort has been made to make code transformed with this plugin interact with normal un-trnasformed JS reasonably well.
However, the plugin does some pretty weird surgery on function definitions and calls, so I'm not 100% confident that it won't interact poorly with something.

