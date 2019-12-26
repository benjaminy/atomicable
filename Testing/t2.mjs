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
    // atomicish:
    {
        await delayedMessage( 0, "A"+msg );
        await delayedMessage( 0, "B"+msg );
        await delayedMessage( 0, "C"+msg );
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
