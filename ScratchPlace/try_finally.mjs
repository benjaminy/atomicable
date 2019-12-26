function main()
{
    for( var i = 0; i < 10; i++)
    {
        try
        {
            if( i % 2 == 0 )
                continue;
        }
        finally
        {
            console.log( "F", i );
        }
        console.log( "A", i );
    }
}

main();
