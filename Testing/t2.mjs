function sleep( milliseconds, ...params )
{
    return new Promise(
        resolve => setTimeout( resolve, milliseconds, params )
    );
}

async function delayedLog( milliseconds, msg )
{
    await sleep( milliseconds );
    console.log( msg );
}

async function abc( msg )
{
    atomicish:
    {
        x = y;
        await delayedLog( 10, "A"+msg );
        if( x !== y )
            launch_missiles();
        await delayedLog( 10, "B"+msg );
        await delayedLog( 10, "C"+msg );
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

const timestamp_before = new Date();
__atomicable_main( main ).then(
    () => { console.log( "That's all Folks!", ( new Date() - timestamp_before ) ) }
);
