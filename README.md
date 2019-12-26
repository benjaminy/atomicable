# atomicable
Atomic Blocks for Async Functions in JS

## A Small Example

Here is a small and silly example of what this library does.

```javascript
function delayed_console_log( message )
{
    return new Promise(
        ( resolve ) => {
            setTimeout( 1, () => {
                console.log( message );
                resolve();
            } );
        }
    )
}

async function abc()
{
    atomicable:
    {
        delayed_console_log( "A" );
        delayed_console_log( "B" );
        delayed_console_log( "C" );
    }
}
```

This library does some funky code translation (using Babel) to make it possible to write code like:


## Motivation

Async functions are a convenient way to write asynchronous code in JavaScript.
On
