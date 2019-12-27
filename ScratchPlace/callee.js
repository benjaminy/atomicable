
const blah = Symbol( "Blah" );

function foo()
{
    console.log( arguments.callee[ blah ] );
    delete arguments.callee[ blah ];
}

function main()
{
    foo[ blah ] = 42;
    foo();
    console.log( foo[ blah ] );
    foo[ blah ] = 43;
    foo();
    console.log( foo[ blah ] );
}

main();
