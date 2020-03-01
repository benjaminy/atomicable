
function nonasync()
{
    return 42;
}

async function normal()
{
    return 43;
}

async function promise()
{
    return Promise.resolve().then( () => 44 );
}

async function array()
{
    return [ Promise.resolve().then( () => 45 ) ];
}

async function main()
{
    console.log( "nonasync      ", nonasync() );
    console.log( "await nonasync", await nonasync() );
    console.log( "normal        ", normal() );
    console.log( "await normal  ", await normal() );
    console.log( "await promise ", await promise() );
    console.log( "await array   ", await array() );
}

main().then( () => console.log( "That's all folks" ) );
