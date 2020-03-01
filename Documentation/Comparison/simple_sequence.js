
function main()
{
    try {
        setTimeout(
            ( thing ) => {
                console.log( "Later:", thing );
                throw new Error( "Oh Noes!" );
            },
            3000,
            42 );
        console.log( "After some stuff" );
    }
    catch( err ) {
        console.log( "O RLY?", err );
    }
    console.log( "After all that" );
}

main();
