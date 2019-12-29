function sleep( milliseconds )
{
    return new Promise(
        resolve => setTimeout( resolve, milliseconds )
    );
}

async function delayedMessage( milliseconds, msg )
{
    await sleep( milliseconds );
    console.log( msg );
}

async function abc( msg )
{
    atomicish:
    {
        await delayedMessage( 10, "A"+msg );
        await delayedMessage( 10, "B"+msg );
        await delayedMessage( 10, "C"+msg );
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
    () => { console.log( "Test's all done.", ( new Date() - timestamp_before ) ) }
);
