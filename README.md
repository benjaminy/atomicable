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

## A Little Theory

Vanilla JS does not have any thread-like primitive.
From its beginning JS has supported non-parallel concurrency via the event dispatcher (I prefer "event _dispatcher_" to "event _loop_" because I think it describes what it does better).
Original JS used callbacks to register continuations, then came Promises, then Generator Functions and Async Functions.
These are all ways to register continuations whose execution can be interleaved with unrelated bits of application code.

One weakness of JS's continuation-based approach to concurrency is that it does not make it easy to distinguish between intentional concurrency, coninuations used to avoid blocking/starvation, and incidental concurrency.
For example, consider the following tiny snippets of code:

```javascript
    var x1 = await thing1();
    var x2 = await thing2();
```

```javascript
    var p  = thing1();
    var x2 = await thing2();
    var x1 = await p;
```

In the first case `thing1` and `thing2` are serialized, but continuations from unrelated code can still be interleaved arbitrarily with whatever chain of continuations those functions create.
In the second case `thing1` and `thing2` are run concurrently.
Note that I _do not_ mean concurrent in the sense of parallel, like running simultaneous on multicores.
But their chains continuations can be interleaved with each other.
In particular if `thing1` and `thing2` do some long-latency things (like make network requests), those things can be overlapped in time.

The thing that's slightly weird about async functions is that _every_ call to an async function by default creates the possibility of concurrency.
The programmer has to add the additional `await` syntax to prevent that concurrency.
Which might sound kind of cool, but in fact __a strong majority of calls to async functions in JS and C\# projects on Github are immediately `await`'d__.

## Limitations

This library works by modifying all function definitions and calls.
The intention is that code modified by this library can still interact normally with unmodified JS code.
However, unmodified code will not pass along the context information and therefore all control flows that passes through unmodified code will not respect this library's atomic blocks.

No effort has been made to pass the context through callback-style APIs.
The most obvious way to do this would be to explicitly identify functions that take asynchronous callbacks (like setTimeout), which would be extremely tedious and prone to missing some.


## Status and Caveats

This is a research project; use in production code is strongly discouraged.
Some effort has been taken to make code transformed with this plugin interact with normal un-trnasformed JS reasonably well.
Of course, un-transformed JS code does not pass along the context reference, so doesn't participate in the atomicity system at all.


Because the function call rewriting adds an extra parameter, 
