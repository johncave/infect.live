//client.js
var io = require('socket.io-client');
var socket = io.connect('https://ws.infect.live', { reconnect: true });

function currentTime() {
    return Math.floor(new Date().getTime() / 1000)
}


const db = require('better-sqlite3')('sqlite.db');



// Set up DB tables 
let row = db.prepare("select name from sqlite_master WHERE type='table' AND name='game';").get();
//console.log(row)
if (row == undefined) {
    // Started = time in epoch, state = "in_progress" or "done"
    db.prepare("CREATE TABLE game(id INTEGER PRIMARY KEY AUTOINCREMENT, started INT, state TEXT)").run()
    db.prepare("CREATE TABLE player(id TEXT PRIMARY KEY)").run()
    // result = "zombies" / "healthy"
    db.prepare("CREATE TABLE scan(player_id TEXT, target_id TEXT, game_id INT, result TEXT, time INT)").run()
    // State = "zombies" / "healthy"
    db.prepare("CREATE TABLE game_players(game_id INT, player_id INT, total_score INT, score INT, state TEXT, join_time INT)").run()
}



// Add a connect listener
socket.on('connect', function (info) {
    console.log('Connected to socket server!');
});
socket.on('join', function (info) {
    console.log('User joined', info, info.userId)
    // Register the user
    let row = db.prepare('INSERT OR REPLACE INTO player(id) VALUES (?)').run(info.userId)
    // Join the user to the game
    console.log("Registered user", row)

    // Check if a game is in progress
    let game = db.prepare("SELECT * FROM game WHERE state = 'in_progress'").get()
    console.log("Game", game)
    let gameid = 0
    let first_player = false
    if (game == undefined) { // No game?
        let newgame = db.prepare("INSERT into game(state, started) VALUES ('in_progress', ?)").run(currentTime())
        console.log("Created game", newgame)
        gameid = newgame.lastInsertRowid
        game = newgame
        first_player = true
    } else {
        gameid = game.id
    }

    let player_joined = db.prepare("SELECT * from game_players WhERE player_id = ? AND game_id = ?").get(info.userId, gameid)
    if (player_joined === undefined) {
        // Assign the new player to the smallest team
        let counts = db.prepare("select (SELECT count(1) FROM game_players WHERE game_id = ? AND state = 'humans') as humans, (SELECT count(1) FROM game_players WHERE game_id = ? AND state = 'zombies') as zombies").get(game.id, game.id)
        console.log("counts", counts)
        let state = "zombies"
        if (counts.humans < counts.zombies) {
            state = "humans"
        }

        console.log("Assigning user to team", state, first_player)

        // Register the player to the game 
        let p2g = db.prepare("INSERT INTO game_players(game_id, player_id, score, total_score, state, join_time) VALUES (?, ?, 0, 0, ?, ?)").run(gameid, info.userId, state, currentTime())
        console.log("Added user to game", p2g)
    } else {
        console.log("Player already in-game")
    }

});
socket.on('scan', function (info) {
    console.log('User scanned', info)
    let game = db.prepare("SELECT * from game where state = 'in_progress'").get()
    console.log("Game", game)
    if ( game === undefined ) {
        console.log("No game in progress - ignoring scan")
        return
    }

    let player = db.prepare("SELECT * from game_players WHERE player_id = ? AND game_id = ?").get(info.userId, game.id)
    console.log("Player", player)

    let target = db.prepare("SELECT * from game_players WHERE player_id = ? AND game_id = ?").get(info.targetId, game.id)
    console.log("Target", target)


    if (player.state != target.state) {
        let update = db.prepare("update game_players SET state = ? WHERE player_id = ? AND game_id = ?").run(player.state, info.targetId, game.id)
        let player_update = db.prepare("update game_players set score = score + 1, total_score = total_score + 1 WHERE player_id = ?").run(player.player_id)
        let scan = db.prepare("INSERT INTO scan(player_id, target_id, game_id, result, time) VALUES (?, ?, ?, ?, ?)").run(info.userId, info.targetId, game.id, player.state, currentTime())
        console.log("Scan recorded")
    } else {
        console.log("Scan ignored - already on same team")
    }

});

setInterval(function () {
    if (socket.connected) {
        console.log("Sending update", currentTime())
        let gameover = false
        let game = db.prepare("select * from game where state = 'in_progress'").get()
        if (game == undefined) {
            game = db.prepare("select * from game order by started DESC LIMIT 1").get()
            gameover = true
        } else { // If there is a game in progress, check if it should be over
            console.log("game", game)
            let counts = db.prepare("select (SELECT count(1) FROM game_players WHERE game_id = ? AND state = 'humans') as humans, (SELECT count(1) FROM game_players WHERE game_id = ? AND state = 'zombies') as zombies").get(game.id, game.id)
            console.log("counts", counts)
            if ((counts.humans + counts.zombies) > 2 && (counts.zombies == 0 || counts.humans == 0)) {
                let endgame = db.prepare("UPDATE game SET state = 'done' WHERE id = ?").run(game.id)
                console.log("End game!")
                gameover = true
            }
        }

        let players = db.prepare("SELECT * from game_players WHERE game_id = ?").all(game.id)
        let out = []
        players.forEach((player) => {
            out.push({
                userId: player.player_id,
                team: player.state,
                score: player.score,
                totalScore: player.total_score
            })
        })

        let scans = db.prepare("SELECT * FROM scan WHERE game_id = ? ORDER BY time DESC").all(game.id)
        let scans_out = []
        //console.log(scans)
        scans.forEach((scan) => {
            scans_out.push({
                playerId: scan.player_id,
                targetId: scan.target_id,
                result: scan.result,
                time: scan.time
            })
        })

        //console.log(players)
        socket.emit('state', {
            gameID: game.id,
            gameOver: gameover,
            players: out,
            scans: scans_out,

        })
    } else {
        console.log("Waiting for connect...")
    }
}, 2500)

// socket.emit('state', 'me', 'test msg');


