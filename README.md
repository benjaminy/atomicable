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
    atomicish:
    {
        await delayed_console_log( "A" );
        await delayed_console_log( "B" );
        await delayed_console_log( "C" );
    }
}
```

If this is interpreted as normal JavaScript code, the output of "A", "B" and "C" could be interleaved with whatever other concurrent asynchronous continuations.
This library makes it so that other concurrent continuations will pause themselves while any code is running in an "atomicish" block.

## How? (Part 1)

There are two parts of this library: a Babel plugin and a small runtime library.
The Babel plugin rewrites function calls, function definitions, await expressions and blocks labeled "atomicish".
Await expressions are modified to check if some concurrent async flow is in atomicish mode; if so, that await pauses itself until that atomicish block is finished.
The function definitions and calls are modified to pass along a context reference so that async continuation flows that are "inside" atomicish blocks can be distinguished from those that are not.

## Why? (Part 1)

_Atomicity violations_ is a broad category of concurrency bugs.
Classic data races are the simplest kind of atomicity violation, where two (or more) threads access the same shared memory locations without appropriate synchronization, like mutex release/acquire.
(At least one of the accesses must be a write).
Classic data races are not a thing in normal JavaScript, because it doesn't have shared-memory multithreading (unless shared memory between Workers has become a thing?).

But atomicity violations at a coarser granularity are absolutely possible.
These can occur when a programmer (usually unintentionally) assumes that a chain of continuations happen in sequence without the state of the program being modified by some other continuation.
The sequence of calls to delayed_console_log are an example (again, a pretty silly one) of such a chain.

## Status and Caveats

This is a research project; use in production code is strongly discouraged.
Some effort has been taken to make code transformed with this plugin interact with normal un-trnasformed JS reasonably well.
Of course, un-transformed JS code does not pass along the context reference, so doesn't participate in the atomicity system at all.

No effort has been made to pass the context through callback-style APIs.
The most obvious way to do this would be to explicitly identify functions that take asynchronous callbacks (like setTimeout), which would be extremely tedious and prone to missing some.
