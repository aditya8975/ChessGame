const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");
const app = express();

const server = http.createServer(app);
const io = socket(server);
let chess = new Chess();
let players = {};
let currentPlayer = "w";

let timers = {
    white: 600, // 10 minutes in seconds
    black: 600
};
let activeTimer = null;
let intervalId = null;

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.render("index", { title: "Chess Game" });
});

io.on("connection", function(socket) {
    console.log("connected");
    if (!players.white) {
        players.white = socket.id;
        socket.emit("playerRole", "w");
    } else if (!players.black) {
        players.black = socket.id;
        socket.emit("playerRole", "b");
    } else {
        socket.emit("spectatorRole");
    }

    socket.emit("timerUpdate", timers);

    socket.on("disconnect", function() {
        if (socket.id === players.white) {
            delete players.white;
        } else if (socket.id === players.black) {
            delete players.black;
        }
    });

    socket.on("move", (move) => {
        try {
            if (chess.turn() === "w" && socket.id !== players.white) return;
            if (chess.turn() === "b" && socket.id !== players.black) return;

            const result = chess.move(move);
            if (result) {
                currentPlayer = chess.turn();
                io.emit("move", move);
                io.emit("boardState", chess.fen());

                if (chess.isCheckmate()) {
                    io.emit("message", { text: "Checkmate!", color: currentPlayer });
                    gameOver();
                } else if (chess.inCheck()) {
                    io.emit("message", { text: "Check!", color: currentPlayer });
                } else if (chess.isStalemate()) {
                    io.emit("message", { text: "Stalemate!", color: currentPlayer });
                    gameOver();
                } else if (chess.isDraw()) {
                    io.emit("message", { text: "Draw!", color: currentPlayer });
                    gameOver();
                }

                startTimer();
            } else {
                console.log("invalid move: ", move);
                socket.emit("InvalidMove", move);
            }
        } catch (err) {
            console.log(err);
            socket.emit("InvalidMove", move);
        }
    });

    socket.on("restartGame", () => {
        startNewGame();
    });
});

const startTimer = () => {
    if (intervalId) clearInterval(intervalId);

    intervalId = setInterval(() => {
        timers[currentPlayer === 'w' ? 'white' : 'black']--;

        io.emit("timerUpdate", timers);

        if (timers.white <= 0) {
            clearInterval(intervalId);
            io.emit("gameOver", "Black wins on time!");
            gameOver();
        } else if (timers.black <= 0) {
            clearInterval(intervalId);
            io.emit("gameOver", "White wins on time!");
            gameOver();
        }
    }, 1000);
};

const gameOver = () => {
    clearInterval(intervalId);
    intervalId = null;
};

const startNewGame = () => {
    gameOver();
    chess = new Chess();
    timers.white = 600;
    timers.black = 600;
    currentPlayer = "w";
    io.emit("boardState", chess.fen());
    io.emit("timerUpdate", timers);
    io.emit("message", { text: "New game started!", color: null });
    startTimer();
};

server.listen(3000, function() {
    console.log("listening on 3000");
});
