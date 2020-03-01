function main( fin )
{
    setTimeout( im_a_callback, 1000, fin );
}

function im_a_callback( fin )
{
    console.log( "You called a callback" );
    promiseFlavoredTimeout( 1000, fin ).then( im_a_promise_continuation );
    // promiseFlavoredTimeout( 1000, fin ).then( () => {
    //    console.log( fin );
    // } );
}

function im_a_promise_continuation( [ fin ] )
{
    console.log( "You .then'd a Promise" );
    return im_an_async_function( fin );
}

async function im_an_async_function( fin )
{
    await promiseFlavoredTimeout( 1000 );
    console.log( "You called an async function" );
    await promiseFlavoredTimeout( 1000 );
    fin();
}

/*
 * Convert callback-style setTimeout to Promise-style
 */
function promiseFlavoredTimeout( time_ms, ...params )
{
    return new Promise(
        ( resolve, reject ) => setTimeout( resolve, time_ms, params ) );

    // An alternate universe less confusing API for new Promise():
    // const [ p, resolve, reject ] = new Promise();
    // setTimeout( resolve, time_ms, params );
    // return p;
}

main( () => console.log( "That's all Folks!" ) );
