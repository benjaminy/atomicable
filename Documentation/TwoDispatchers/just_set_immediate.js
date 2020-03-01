
const N = 3;

function helloFriends( thing, i )
{
    console.log( "Callback", thing, i );
    if( i < 3 )
        setImmediate( helloFriends, thing, i + 1 )
}

function main()
{
    setImmediate( helloFriends, "A", 1 );
    setImmediate( helloFriends, "B", 1 );
    setImmediate( helloFriends, "C", 1 );
}

main();
