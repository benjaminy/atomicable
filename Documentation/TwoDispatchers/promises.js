
Promise.resolve().then(
    () => console.log( "A1" ) ).then(
    () => console.log( "A2" ) ).then(
    () => console.log( "A3" ) );

Promise.resolve().then(
    () => console.log( "B1" ) ).then(
    () => console.log( "B2" ) ).then(
    () => console.log( "B3" ) );
