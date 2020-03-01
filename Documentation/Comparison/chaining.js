const FS = require( "fs" );
const FSP = FS.promises;

function main()
{
    usage();
    const input_file_names  = process.argv.slice( 2, process.argv.length - 1 );
    const output_file_name = process.argv[ process.argv.length - 1 ];
    // console.log( input_file_names, output_file_name );
    // callbackStyle( input_file_names, output_file_name );
    promiseStyle( input_file_names, output_file_name );
    // asyncStyle( input_file_names, output_file_name );
}

function callbackStyle( input_names, output_name )
{
    var cat_monster = "";
    function reader( err, data )
    {
        cat_monster += data;
        if( input_names.length > 0 )
        {
            const name = input_names.shift();
            FS.readFile( name, {}, reader );
        }
        else
        {
            FS.open( output_name, "w", 0o666, ( err, fd ) => {
                if( err ) {
                    // codflmdfklndfklngldk
                }
                FS.write( fd, cat_monster, 0, "utf8", ( err, bytes_written, str ) => {
                    console.log( "VICTORY!" );
                } );
            } );
        }
    }

    const name = input_names.shift();
    FS.readFile( name, {}, reader );
}

function promiseStyle( input_names, output_name )
{
    var cat_monster = "";
    function reader( data )
    {
        cat_monster += data;
        if( input_names.length > 0 )
        {
            const name = input_names.shift();
            console.log()
            FSP.readFile( name ).then( reader );
        }
        else
        {
            FSP.open( output_name, "w" ).then( ( fd ) => {
                return FSP.writeFile( fd, cat_monster )
            } ).then( ( bytes_written, str ) => {
                console.log( "VICTORY!" );
            } ).catch( ( err ) => {
                // error handling
            } );
        }
    }

    reader( "" );
}

async function asyncStyle( input_names, output_name )
{
    var cat_monster = "";
    while( input_names.length > 0 )
    {
        const name = input_names.shift();
        try {
            const data = await FSP.readFile( name );
        }
        catch ( err ) {
            // handle error
        }
        cat_monster += data;
    }
    const fd = await FSP.open( output_name, "w" );
    await FSP.writeFile( fd, cat_monster );
    console.log( "VICTORY!" );
}

function usage()
{
    if( process.argv.length < 4 )
    {
        console.log( "Must give at least one input file and and output file" );
        process.exit( 1 );
    }
}

main();
