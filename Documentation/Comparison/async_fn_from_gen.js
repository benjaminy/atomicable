function convertGenToAsyncFn( gen_fn )
{
    return function( ...params )
    {
        const gen = gen_fn( ...params );
        function runner( val )
        {
            const obj = gen.next( val );
            if( obj.done )
            {
                return Promise.resolve( obj.value );
            }
            else
            {
                return Promise.resolve( obj.value ).then( runner );
            }
        }
        return runner();
    }
}

function promiseFlavoredTimeout( time_ms, ...params )
{
    return new Promise(
        ( resolve, reject ) => setTimeout( resolve, time_ms, params ) );
}

function* hellos()
{
    yield promiseFlavoredTimeout( 1000 );
    console.log( "A1" );
    yield promiseFlavoredTimeout( 1000 );
    console.log( "A2" );
    yield promiseFlavoredTimeout( 1000 );
    console.log( "A3" );
}

const hellos2 = convertGenToAsyncFn( hellos )

hellos2();
