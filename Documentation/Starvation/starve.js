
console.log( "starve.js Loaded" );

function firstButton()
{
    alert( "VICTORY" );
}

function secondButton()
{
    while( true ) {}
}

function thirdButton()
{
    setTimeout( thirdButton, 0 );
}

function fourthButton()
{
    console.log( "Hello" );
    setImmediate( () => Promise.resolve().then( fourthButton ) );
}
