
const N = 8;

async function helloFriends( i )
{
    console.log( "async", i );
    if( i < N )
    {
        const p1 = helloFriends( 2 * i );
        const p2 = helloFriends( 2 * i + 1 );
        await Promise.all( [ p1, p2 ] );
    }
}

async function main()
{
    await helloFriends( 1 );
}

main();
