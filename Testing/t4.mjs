// This is a micro-benchmark that performs a large number of async calls
// and awaits.

const N = 20;

async function whole_bunch_of_calls( x )
{
    if( x < 1 )
    {
        return 1;
    }
    const y = await whole_bunch_of_calls( x - 1 );
    const z = await whole_bunch_of_calls( x - 1 );
    return y + z;
}

async function main()
{
    const result = await whole_bunch_of_calls( N );
    console.log( "RESULT:", result );
}

const timestamp_before = new Date();
const p = main();
// const p = __atomicable_main( main );
p.then(
    () => { console.log( "Test's all done.", ( new Date() - timestamp_before ) ) }
);
