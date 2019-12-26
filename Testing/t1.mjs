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

async function test1()
{
    const p1 = delayedMessage( 2, "Hello" );
    // atomicish:
    {
        delayedMessage( 1, "3" );
        delayedMessage( 2, "2" );
        delayedMessage( 3, "1" );
        await delayedMessage( 4, "Goodbye" );
    }
    await p1;
}

__atomicable_main( test1 ).then( () => { console.log( "Test's all done." ) } );
