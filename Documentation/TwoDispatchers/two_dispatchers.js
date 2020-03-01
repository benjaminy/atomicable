
const N = 3;

async function helloFriends( thing, i )
{
    console.log( "Callback", thing, i );
    if( i < 3 )
        await helloFriends( thing, i + 1 );
}

function main()
{
    setImmediate( helloFriends, "A", 1 );
    setImmediate( helloFriends, "B", 1 );
    setImmediate( helloFriends, "C", 1 );
}

main();
