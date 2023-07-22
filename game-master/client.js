//client.js
var io = require('socket.io-client');
var socket = io.connect('https://ws.infect.live', { reconnect: true });

var args = require('minimist')(process.argv.slice(2));
console.log(args);

function currentTime() {
    return Math.floor(new Date().getTime() / 1000)
}


if (args.join !== undefined) {
    console.log("Joining")
    socket.emit("join", {userId:args.join})
    setTimeout(()=> {process.exit()}, 2000);
    
} else if (args.scan !== undefined){
    if ( args.player === undefined) {
        console.log("Please specify --player and --scan")
    }
    socket.emit("scan", {
        userId: args.player, 
        targetId: args.scan
    })
    setTimeout(()=> {process.exit()}, 2000);
    //process.exit()
} else if (args.read !== undefined) {
    socket.on('state', function (info) {
        console.log(info)
        process.exit()
    })
} else {
    console.log("No action specified, byeeeee")
    process.exit(1)
}



//process.exit();