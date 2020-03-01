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

const HAVE_ATOMIC_CTX = Symbol( "Have atomic ctx" );
const NO_ATOMIC_CTX   = Symbol( "No atomic ctx" );
const body_stack     = [ NO_ATOMIC_CTX ];

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
const magic_fn   = () => runtimeLib( T.identifier( "MAGIC_FN_TAG" ) );
const hidden_ctx = T.identifier( "__atomicish_ctx" );
const params_id  = T.identifier( "params" );
const params_spread = () => T.spreadElement( params_id );

/*
Function/Method Calls

IF NO ATOMIC CTX, NO CHANGE
OTHERWISE:
----------------------------------------------------------------
e1( x, y, z )

~>

( ( callee ) => {
    if( MAGIC_FN_TAG in callee )
        callee[ MAGIC_FN_TAG ].x = __ctx;
    return callee( x, y, z );
} )
( e1 )
----------------------------------------------------------------
e1.property( x, y, z )

~>

( ( callee ) => {
    if( MAGIC_FN_TAG in callee.prop )
        callee.property[ MAGIC_FN_TAG ].x = __ctx;
    return callee.property( x, y, z );
} )
( e1 )
----------------------------------------------------------------
e1[ property ]( x, y, z )

~>

( ( callee, prop ) => {
    if( MAGIC_FN_TAG in callee[ prop ] )
        callee[ prop ][ MAGIC_FN_TAG ].x = __ctx;
    return callee[ prop ]( x, y, z );
} )
( e1, property )
----------------------------------------------------------------
*/
function exitCallExpression( path )
{
    if( body_stack[ 0 ] === NO_ATOMIC_CTX )
    {
        return;
    }
    assert( body_stack[ 0 ] === HAVE_ATOMIC_CTX );

    const callee_id = T.identifier( "callee" );
    var wrapper_formals = [ callee_id ];
    var wrapper_actuals = [ path.node.callee ];
    var callee_prop = null;

    if( T.isMemberExpression( path.node.callee ) )
    {
        callee_prop     = path.node.callee.property;
        wrapper_actuals = [ path.node.callee.object ];
        if( path.node.callee.computed )
        {
            callee_prop = T.identifier( "prop" );
            wrapper_formals = [ callee_id, callee_prop ];
            wrapper_actuals = [ path.node.callee.object, path.node.callee.property ];
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
                T.blockStatement( [
                    T.ifStatement(
                        T.binaryExpression( "in", magic_fn(), callee_exp() ),
                        assignStmt(
                            T.memberExpression(
                                T.memberExpression( callee_exp(), magic_fn(), true ),
                                T.identifier( "x" )
                            ),
                            hidden_ctx
                        )
                    ),
                    T.returnStatement(
                        T.callExpression( callee_exp(), path.node.arguments )
                    )
                ] )
            ),
            wrapper_actuals
        )
    );

    path.skip();
}

/*
IF NO ATOMIC CTX, NO CHANGE
OTHERWISE:
----------------------------------------------------------------
await body

~>

await ( ( async () =>
  {
    await Runtime.wait( __ctx );
    try { return await body; }
    finally { await Runtime.wait( __ctx ) }
  } ) () )

REMINDER: Need the wrapper await/async because "await exp" is an expression.
*/
function exitAwaitExpression( path )
{
    if( body_stack[ 0 ] === NO_ATOMIC_CTX )
    {
        return;
    }
    assert( body_stack[ 0 ] === HAVE_ATOMIC_CTX );

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

IF NO ATOMIC CTX, NO CHANGE
OTHERWISE:
----------------------------------------------------------------
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

function enterLabeledStatement( path )
{
    if( path.node.label.name === "__atomicable_have_context" )
    {
        body_stack.unshift( HAVE_ATOMIC_CTX );
    }
    if( path.node.label.name === "__atomicable_no_context" )
    {
        body_stack.unshift( NO_ATOMIC_CTX );
    }
}

function exitLabeledStatement( path )
{
    if( ( path.node.label.name === "__atomicable_have_context" )
        || ( path.node.label.name === "__atomicable_no_context" ) )
    {
        const b = body_stack.shift();
        assert( b ===  ( path.node.label.name === "__atomicable_have_context"
                         ? HAVE_ATOMIC_CTX : NO_ATOMIC_CTX ) );
        path.replaceWith( path.node.body );
        path.skip();
        return;
    }

    if( !( path.node.label.name === "atomicish" ) )
    {
        return;
    }

    if( body_stack[ 0 ] === NO_ATOMIC_CTX )
    {
        path.replaceWith( path.node.body );
        path.skip();
        return;
    }
    assert( body_stack[ 0 ] === HAVE_ATOMIC_CTX );

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
    );

    path.skip();
}

var just_started_fun_defn = false;
/*
Intermediate step:
f(...)
{
    __have_ctx: {
        body copy 1
    }
    __no_ctx: {
        body copy 2
    }
}
*/
function funBody( body )
{
    return T.blockStatement( [
        T.labeledStatement( T.identifier( "__atomicable_have_context" ), body ),
        T.labeledStatement( T.identifier( "__atomicable_no_context" ), T.cloneNode( body ) )
    ] );
}

function enterFun( path )
{
    if( just_started_fun_defn )
    {
        just_started_fun_defn = false;
        return true;
    }
    if( path.node.generator ) return true;
    just_started_fun_defn = true;
    return false;
}

function enterFunctionDeclaration( path )
{
    if( enterFun( path ) ) return;
    const n = path.node;
    path.replaceWith(
        T.functionDeclaration( n.id, n.params, funBody( n.body ), n.generator, n.async ) );
}

function enterFunctionExpression( path )
{
    if( enterFun( path ) ) return;
    const n = path.node;
    path.replaceWith(
        T.functionExpression( n.id, n.params, funBody( n.body ), n.generator, n.async ) );
}

function enterArrowFunctionExpression( path )
{
    if( enterFun( path ) ) return;
    const n = path.node;
    const body = T.isExpression( n.body ) ? blockJustRet( n.body ) : n.body;
    path.replaceWith(
        T.arrowFunctionExpression( n.params, funBody( body ), n.async ) );
}

/*
NOTE: This transformation makes 2 copies of the function body, one for
the case where a context is passed in, one for the case without a
context.  This copying will create a code expansion that is exponential
in the depth of function definition nesting.  If this expansion ever
creates problems in practce, the answer is Lambda Lifting.

Even with lambda lifting, this does approximately double the code size.
That's not great, and maybe worth optimizing some time later.

It is possible to do the transformation without the code duplication by
checking for the existence of the context at each point of use.  But
that seems like a worse tradeoff in "normal" code.
*/


/*
FUN_DEFN_HELPER( fun_name, params, body, ?is_async? ) =
( () => {
    const magic = { x : null };
    ?async? fun_name( params )
    {
        if( magic.x )
        {
            const __ctx = magic.x;
            magic.x = null;
            [ HAVE ATOMIC CTX [ body ]]
        }
        else
        {
            [ NO ATOMIC CTX [ body ]]
        }
    }
    fun_name[ MAGIC_FN_TAG ] = magic;
    return fun_name;
} )()
*/
function funDefnHelper( fun_id, params, body, is_async )
{
    assert( T.isBlockStatement( body ) );
    assert( body.body.length === 2 );
    const have_atomic_body = body.body[ 0 ];
    const no_atomic_body   = body.body[ 1 ];
    const magic_id = T.identifier( "__atomicish_magic" );
    const x_id = T.identifier( "x" );

    return T.callExpression(
        T.arrowFunctionExpression(
            [], // empty formals
            T.blockStatement( [
                T.variableDeclaration( "const", [
                    T.variableDeclarator(
                        magic_id,
                        T.objectExpression( [ T.objectProperty( x_id, T.nullLiteral() ) ] )
                    )
                ] ),
                T.functionDeclaration(
                    fun_id,
                    params,
                    T.blockStatement( [
                        T.ifStatement(
                            T.memberExpression( magic_id, x_id ),
                            T.blockStatement( [
                                T.variableDeclaration( "const", [
                                    T.variableDeclarator(
                                        hidden_ctx,
                                        T.memberExpression( magic_id, x_id )
                                    )
                                ] ),
                                assignStmt(
                                    T.memberExpression( magic_id, x_id ),
                                    T.nullLiteral()
                                ),
                                have_atomic_body
                            ] ),
                            no_atomic_body
                        )
                    ] ),
                    false, // generator
                    is_async
                ),
                assignStmt( T.memberExpression( fun_id, magic_fn(), true ), magic_id ),
                T.returnStatement( fun_id )
            ] )
        ),
        [] // empty actuals
    );
}

/*
?async? function fun_name( x, y, z ) { body }

~>

const fun_name = FUN_DEFN_HELPER( fun_name, [ x, y, z ], body, ?async? );
*/


function exitFunctionDeclaration( path )
{
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

    path.replaceWith( funDefnHelper(
        T.identifier( "anon" ), path.node.params, path.node.body, path.node.async ) );
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
    if( path.node.name === "__atomicish_mode" )
    {
        if( body_stack[ 0 ] === HAVE_ASYNC_CTX )
        {
            path.replaceWith(
                T.callExpression(
                    runtimeLib( T.identifier( "inAtomicMode" ) ),
                    [ hidden_ctx ]
                )
            );
            path.skip();
        }
        else
        {
            path.replaceWith( T.booleanLiteral( false ) );
        }
    }
}

function enterProgram( path, { file, opts } )
{
    // console.log(  );
    ModuleImports.addNamespace( path, "../Source/atomicable_runtime.mjs", { nameHint: "_AtomicableRuntime" } );
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
            LabeledStatement    : { enter: enterLabeledStatement,
                                    exit : exitLabeledStatement },
            FunctionDeclaration : { enter: enterFunctionDeclaration,
                                    exit : exitFunctionDeclaration },
            FunctionExpression  : { enter: enterFunctionExpression,
                                    exit : exitFunctionExpression },
            ArrowFunctionExpression :
                                  { enter: enterArrowFunctionExpression,
                                    exit : exitArrowFunctionExpression }
        }
    };
}

export default atomicishPlugin;
