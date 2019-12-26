import assert        from "assert";
import babel         from "@babel/core";
import ModuleImports from "@babel/helper-module-imports";

const T = babel.types;

/*

This plugin transforms the following pieces of syntax:

* calls:
  Pass along the hidden atomic context variable (when appropriate)

* awaits:
  Add checking for atomic mode before/after awaits

* atomic labels:
  Enter/exit atomic mode around blocks labeled 'atomicish'

* async function definitions:
  

*/

const BODY_NOT_ASYNC = Symbol( "body not async" );
const BODY_ASYNC     = Symbol( "body async" );
const body_stack     = [ BODY_NOT_ASYNC ];

const assignStmt = ( lhs, rhs ) =>
      T.expressionStatement( T.assignmentExpression( "=", lhs, rhs ) );
const blockJustRet = ( exp ) => T.blockStatement( [ T.returnStatement( exp ) ] );

function runtimeLib( ...member )
{
    return T.memberExpression(
        T.identifier( "_AtomicableRuntime" ),
        ...member
    );
}
const magic = () => runtimeLib( T.identifier( "MAGIC_FN_TAG" ) );
const hidden_ctx = T.identifier( "__atomicish_ctx" );
const params_id  = T.identifier( "params" );
const params_spread = () => T.spreadElement( params_id );

/*
Function/Method Calls
----------------------------------------------------------------
e1( x, y, z )

~>

( ( callee, ...params ) =>
    MAGIC_FN_TAG in callee
        ? callee[ MAGIC_FN_TAG ]( __ctx, ...params )
        : callee( ...params ) )
    ( e1, x, y, z )
----------------------------------------------------------------
e1.prop( x, y, z )

~>

( ( callee, ...params ) =>
    MAGIC_FN_TAG in callee.prop
        ? callee.prop[ MAGIC_FN_TAG ]( __ctx, ...params )
        : callee.prop( ...params ) )
    ( e1, x, y, z )
----------------------------------------------------------------
e1[ e2 ]( x, y, z )

~>

( ( callee, prop, ...params ) =>
    MAGIC_FN_TAG in callee[ prop ]
        ? callee[ prop ][ MAGIC_FN_TAG ]( __ctx, ...params )
        : callee[ prop ]( ...params ) )
    ( e1, e2, x, y, z )
----------------------------------------------------------------
REMINDER: Using '...params' is fine; the original AST doesn't have param names
*/
function exitCallExpression( path )
{
    const callee_id = T.identifier( "callee" );
    var wrapper_formals = [ callee_id, T.restElement( params_id ) ];
    var wrapper_actuals = [ path.node.callee, ...path.node.arguments ];

    var callee_prop = null;
    if( T.isMemberExpression( path.node.callee ) )
    {
        callee_prop     = path.node.callee.property;
        wrapper_actuals = [ path.node.callee.object, ...path.node.arguments ];
        if( path.node.callee.computed )
        {
            callee_prop = T.identifier( "prop" );
            wrapper_formals = [ callee_id, callee_prop, T.restElement( params_id ) ];
            wrapper_actuals = [
                path.node.callee.object, path.node.callee.property, ...path.node.arguments ];
        }
    }

    function callee_exp()
    {
        return callee_prop ? T.memberExpression(
            callee_id, callee_prop, path.node.callee.computed )
            : callee_id;
    }

    path.replaceWith(
        T.callExpression(
            T.arrowFunctionExpression(
                wrapper_formals,
                T.ConditionalExpression (
                    T.binaryExpression( "in", magic(), callee_exp() ),
                    T.callExpression(
                        T.memberExpression( callee_exp(), magic(), true ),
                        [ hidden_ctx, params_spread() ]
                    ),
                    T.callExpression( callee_exp(), [ params_spread() ] )
                )
            ),
            wrapper_actuals
        )
    );

    path.skip();
}

/*
  await body

  ~>

  await ( ( async () => {
    await Runtime.wait( __ctx );
    try { return await body; }
    finally { await Runtime.wait( __ctx ) } } )() )

REMINDER: Need the wrapper await/async because "await exp" is an expression.
*/
function exitAwaitExpression( path )
{
    assert( body_stack[ 0 ] === BODY_ASYNC );

    function call_wait()
    {
        return T.expressionStatement(
            T.awaitExpression(
                T.callExpression( runtimeLib( T.identifier( "wait" ) ), [ hidden_ctx ] )
            )
        );
    }

    path.replaceWith(
        T.awaitExpression(
            T.callExpression(
                T.arrowFunctionExpression(
                    [], // empty formals
                    T.blockStatement( [
                        call_wait(),
                        T.tryStatement(
                            blockJustRet( T.awaitExpression( path.node.argument ) ),
                            null, // empty catch block
                            T.blockStatement( [ call_wait() ] )
                        )
                    ] ),
                    true // async
                ),
                [] // empty actuals
            )
        )
    );

    path.skip();
}

/*
NOTE: Will break programs that use 'atomicish' as a label.
Hopefully that's extremely uncommon.

atomicish: {
   body
}

~>

{
    const __dumb_js_scope_workaround = __ctx;
    {
        // Shadow outer binding of __ctx
        const __ctx = await Runtime.enterAtomic( __dumb_js_scope_workaround );
        try {
            [[ body ]];
        }
        finally {
            await Runtime.exitAtomic( __ctx );
        }
    }
}
*/

function exitLabeledStatement( path )
{
    if( body_stack[ 0 ] === BODY_NOT_ASYNC
        || !( path.node.label.name === "atomicish" ) )
    {
        return;
    }
    assert( body_stack[ 0 ] === BODY_ASYNC );

    const x = T.identifier( "__dumb_js_scope_workaround" );
    path.replaceWith(
        T.blockStatement( [
            T.variableDeclaration( "const", [ T.variableDeclarator( x, hidden_ctx ) ] ),
            T.blockStatement( [
                T.variableDeclaration( "const", [
                    T.variableDeclarator(
                        hidden_ctx,
                        T.awaitExpression(
                            T.callExpression(
                                runtimeLib( T.identifier( "enterAtomic" ) ),
                                [ x ]
                            )
                        )
                    )
                ] ),
                T.tryStatement(
                    path.node.body,
                    null, // empty catch block
                    T.blockStatement( [
                        T.expressionStatement(
                            T.awaitExpression(
                                T.callExpression(
                                    runtimeLib( T.identifier( "exitAtomic" ) ),
                                    [ hidden_ctx ]
                                )
                            )
                        )
                    ] )
                )
            ] )
        ] )
    )

    path.skip();
}

function enterFunctionDefn( path )
{
    body_stack.unshift( path.node.async ? BODY_ASYNC : BODY_NOT_ASYNC );
}

function exitFunHelper( path )
{
    const body_state = body_stack.shift();
    if( ( body_state === BODY_ASYNC && !path.node.async )
        || ( body_state === BODY_NOT_ASYNC && path.node.async ) )
    {
        throw new Error( "Translation state fubar'd" );
    }
    return !path.node.async;
}

/*
NOTE: Could use cloneNode to make two copies of the body, which would
eliminate the need to check for null __ctx in other contexts.  Probably
one copy of the body is better for now.
*/

/*
NOTE: Adding a parameter to the beginning of the parameter list will
probably break programs that explicitly access the 'arguments' variable.
AFAIK modifying 'arguments' directly does not work.  Probably could go
through and modify all references to it, but that seems like a lot of
work for little benefit for a prototype.
*/
/*
FUN_DEFN_HELPER( fun_name, params, body, ?is_async? ) =
( () => {
    ?async? temp( __ctx, params )
    {
        [[ body ]]
    }
    function fun_name( ...params ) { return temp( null, ...params ); }
    fun_name[ MAGIC_FN_TAG ] = temp;
    return fun_name;
} )()
*/
function funDefnHelper( fun_id, params, body, is_async )
{
    const temp_id = T.identifier( "temp" );
    params.unshift( hidden_ctx );

    return T.callExpression(
        T.arrowFunctionExpression(
            [], // empty formals
            T.blockStatement( [
                T.functionDeclaration(
                    temp_id,
                    params,
                    body,
                    false, // generator
                    is_async
                ),
                T.functionDeclaration(
                    fun_id,
                    [ T.restElement( params_id ) ],
                    blockJustRet(
                        T.callExpression( temp_id, [ T.nullLiteral(), params_spread() ] )
                    ),
                    false, //generator
                    false // async
                ),
                assignStmt( T.memberExpression( fun_id, magic(), true ), temp_id ),
                T.returnStatement( fun_id )
            ] )
        ),
        [] // empty actuals
    );
}

/*
 * XXX: I think non-async functions should pass along the hidden context
 * ... have to keep thinking about it.
 * ... on the other hand normal functions can't await so it's a little weird
 * ... on the third hand JS is so dynamic that maybe it's common to have non-async
 *   wrappers (in some loose sense) for async functions, so it would be good to pass
 *   the context along
 */

/*
?async? function fun_name( x, y, z ) { body }

~>

const fun_name = FUN_DEFN_HELPER( fun_name, [ x, y, z ], body, ?async? );
*/


function exitFunctionDeclaration( path )
{
    exitFunHelper( path );
    if( path.node.generator )
        return;

    path.replaceWith(
        T.variableDeclaration( "const", [
            T.variableDeclarator(
                path.node.id,
                funDefnHelper(
                    path.node.id, path.node.params, path.node.body, path.node.async )
            )
        ] )
    );

    path.skip();
}

/*
( expression ) ?async? ?fun_name?( x, y, z ) body

~>

FUN_DEFN_HELPER( fun_name ? "anon", [ x, y, z ], body, ?async? )
*/

function exitFunctionExpression( path )
{
    exitFunHelper( path );
    if( path.node.generator )
        return;

    const fun_id = path.node.id ? path.node.id : T.identifier( "anon" );
    path.replaceWith( funDefnHelper(
        fun_id, path.node.params, path.node.body, path.node.async ) );

    path.skip();
}

/*
REMINDER: body can be _expression_ or blockStatement
( anon expression ) ?async? ( x, y, z ) => body

~>

FUN_DEFN_HELPER( "anon", [ x, y, z ], { return body; }, ?async? )
*/

function exitArrowFunctionExpression( path )
{
    exitFunHelper( path );

    const body = T.isExpression( path.node.body )
          ? blockJustRet( path.node.body )
          : path.node.body;
    path.replaceWith( funDefnHelper(
        T.identifier( "anon" ), path.node.params, body, path.node.async ) );

    path.skip();
}

function enterIdentifier( path )
{
    // console.log( "ID", path.node.name );
    if( path.node.name === hidden_ctx.name )
    {
        throw new Error( "Application code trying to access " + hidden_ctx.name );
    }
    if( path.node.name === "__atomicable_main" )
    {
        path.replaceWith( runtimeLib( T.identifier( "main" ) ) );
    }
    if( body_stack[ 0 ] === BODY_ASYNC
        && path.node.name === "__atomicish_mode" )
    {
        path.replaceWith(
            T.callExpression(
                runtimeLib( T.identifier( "inAtomicMode" ) ),
                [ hidden_ctx ]
            )
        );
        path.skip();
    }
}

function enterProgram( path, { file, opts } )
{
    // console.log(  );
    ModuleImports.addNamespace( path, "./runtime_lib.mjs", { nameHint: "_AtomicableRuntime" } );
}

function atomicishPlugin()
{
    return {
        visitor:
        {
            Program             : enterProgram,
            Identifier          : enterIdentifier,
            CallExpression      : { exit : exitCallExpression },
            AwaitExpression     : { exit : exitAwaitExpression },
            LabeledStatement    : { exit : exitLabeledStatement },
            FunctionDeclaration : { enter: enterFunctionDefn,
                                    exit : exitFunctionDeclaration },
            FunctionExpression  : { enter: enterFunctionDefn,
                                    exit : exitFunctionExpression },
            ArrowFunctionExpression :
                                  { enter: enterFunctionDefn,
                                    exit : exitArrowFunctionExpression }
        }
    };
}

export default atomicishPlugin;
