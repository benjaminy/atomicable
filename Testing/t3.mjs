import fs from "fs";

/*
 * This might seem pointless because we end up with an async-flavored
 * interface in either case.  BUT the idea is that readFileSync might be
 * more efficient at the OS level in some non-trivial way.  I have no
 * idea if this is the case in the actual Node standard library, but
 * there are certainly cases where OS-level blocking syscalls are more
 * efficient than a functionally equivalent non-blocking interface.
 */
async function readFile( ...params )
{
    if( __atomicish_mode )
    {
        console.log( "Calling blocking readFile" );
        return fs.readFileSync( ...params );
    }
    else
    {
        console.log( "Calling non-blocking readFile" );
        return await fs.readFile( ...params );
    }
}
