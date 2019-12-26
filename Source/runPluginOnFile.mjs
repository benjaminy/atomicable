import babel from "@babel/core";
import atomicishPlugin from "./atomicable_babel_plugin.mjs";

function main()
{
    // console.log( process.argv );
    const result = babel.transformFileSync(
        process.argv[ 2 ], { plugins: [ atomicishPlugin ] } )
    console.log( result.code );
}

main();
