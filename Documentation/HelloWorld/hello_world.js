const os       = require( "os" );
const net      = require( "net" );
const readline = require( "readline" );
const watch    = require( "node-watch" );

const HOST = "0.0.0.0"; // 127.0.0.1 for more awesomer security
const PORT = 4150;

const rl = readline.createInterface(
    {
        input: process.stdin,
        output: process.stdout
    } );

function main()
{
    setInterval(
        () => { console.log( w[ Math.floor( Math.random() * w.length ) ] ) },
        8000 );

    watch(
        "./",
        { recursive: true },
        function( evt, name )
        {
            console.log( "VIRUS ALERT: %s changed", name );
        } );

    rl.question(
        "What's your favorite restaurant in COS? ",
        ( answer ) => {
            console.log( "OMG I LOVE", answer.toUpperCase() );
            rl.close();
        } );
}

function listNetworkInterfaces()
{
    console.log( "My IP address is probably one of these: " );

    const interfaces = os.networkInterfaces();

    Object.keys( interfaces ).forEach( ( interface_name ) => {
        var alias = 0;

        interfaces[ interface_name ].forEach( ( interface ) => {
            if( "IPv4" !== interface.family || interface.internal !== false )
            {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                return;
            }

            if( alias >= 1 )
            {
                // this single interface has multiple ipv4 addresses
                console.log( interface_name + ':' + alias, interface.address );
            } else {
                // this interface has only one ipv4 adress
                console.log( interface.address, "\t", interface_name );
            }
            ++alias;
        } );
    } );

    net.createServer( function( sock ) {
        console.log(
            "Accepted connection from", sock.remoteAddress,
            "on ephemeral port", sock.remotePort );

        sock.on( "data", function( data ) {
            const str = data.toString();
            console.log( "INCOMING (", sock.remoteAddress, ")", str );
            sock.write( "How do you feel about \"" + str.trim() + "\"?" );
        } );

        sock.on( "close", function( data ) {
            console.log( "Farewell", sock.remoteAddress );
        } );

    } ).listen( PORT, HOST );

    console.log( "Server listening on port", PORT );

    rl.question( "", () => main() );
}

listNetworkInterfaces();

// Array of extremely important words
const w = [ "bamboozled", "bazinga", "bevy", "bifurcate", "bilirubin", "bobolink", "buccaneer", "bulgur", "bumfuzzle", "canoodle", "cantankerous", "carbuncle", "caterwaul", "cattywampus", "cheeky", "conniption", "coot", "didgeridoo", "dingy", "doodle", "doohickey", "eschew", "fiddledeedee", "finagle", "flanker", "floozy", "fungible", "girdle", "gobsmacked", "grog", "gumption", "gunky", "hitherto", "hoi polloi", "hornswoggle", "hullabaloo", "indubitably", "janky", "kahuna", "katydid", "kerplunk", "kinkajou", "knickers", "lackadaisical", "loopy", "manscape", "monkey", "mugwump", "namby-pamby", "noggin", "pantaloons", "passel", "persnickety", "popinjay", "prestidigitation", "proctor", "rapscallion", "rookery", "rumpus", "scootch", "scuttlebutt", "shebang", "Shih Tzu", "smegma", "snarky", "snuffle", "spelunker", "spork", "sprocket", "squeegee", "succubus", "tater", "tuber", "tuchis", "viper", "waddle", "walkabout", "wasabi", "weasel", "wenis", "whatnot", "wombat", "wonky", "zeitgeist" ];
