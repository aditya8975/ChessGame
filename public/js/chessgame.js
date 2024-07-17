const socket = io();

let chess;
let playerRole;

document.addEventListener('DOMContentLoaded', (event) => {
    chess = new Chess();
    const boardElement = document.querySelector(".chessboard");
    const whiteTimerElement = document.getElementById("white-timer");
    const blackTimerElement = document.getElementById("black-timer");

    let draggedPiece = null;
    let sourceSquare = null;

    const renderBoard = () => {
        const board = chess.board();
        boardElement.innerHTML = "";
        board.forEach((row, rowIndex) => {
            row.forEach((square, squareIndex) => {
                const squareElement = document.createElement("div");
                squareElement.classList.add("square",
                    (rowIndex + squareIndex) % 2 === 0 ? "light" : "dark"
                );
                squareElement.dataset.row = rowIndex;
                squareElement.dataset.col = squareIndex;

                if (square) {
                    const pieceElement = document.createElement("div");
                    pieceElement.classList.add("piece",
                        square.color === 'w' ? "white" : "black"
                    );
                    pieceElement.innerText = getPieceUnicode(square.type, square.color);
                    pieceElement.draggable = playerRole === square.color;

                    pieceElement.addEventListener("dragstart", (e) => {
                        if (pieceElement.draggable) {
                            draggedPiece = pieceElement;
                            sourceSquare = { row: rowIndex, col: squareIndex };
                            e.dataTransfer.setData("text/plain", "");
                        }
                    });

                    pieceElement.addEventListener("dragend", () => {
                        draggedPiece = null;
                        sourceSquare = null;
                    });

                    squareElement.appendChild(pieceElement);
                }

                squareElement.addEventListener("dragover", (e) => {
                    e.preventDefault();
                });

                squareElement.addEventListener("drop", (e) => {
                    e.preventDefault();
                    if (draggedPiece) {
                        const targetSquare = {
                            row: parseInt(squareElement.dataset.row),
                            col: parseInt(squareElement.dataset.col),
                        };
                        handleMove(sourceSquare, targetSquare);
                    }
                });

                boardElement.appendChild(squareElement);
            });
        });

        if (playerRole === 'b') {
            boardElement.classList.add("flipped");
        } else {
            boardElement.classList.remove("flipped");
        }
    };

    const startTimer = (playerColor) => {
        clearInterval(intervalId);
        activeTimer = playerColor;

        intervalId = setInterval(() => {
            if (activeTimer === 'w') {
                timers.white--;
            } else if (activeTimer === 'b') {
                timers.black--;
            }

            updateTimers(timers);

            if (timers.white <= 0) {
                clearInterval(intervalId);
                socket.emit("gameOver", "Black wins on time!");
            } else if (timers.black <= 0) {
                clearInterval(intervalId);
                socket.emit("gameOver", "White wins on time!");
            }
        }, 1000);
    };





    const handleMove = (source, target) => {
        const move = {
            from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
            to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`
        };
    
        // Add promotion field only if the move is a pawn move to the last rank
        const piece = chess.get(move.from);
        if (piece && piece.type === 'p' && (move.to[1] === '8' || move.to[1] === '1')) {
            move.promotion = 'q'; // Default to queen promotion
        }
    
        socket.emit("move", move);
        const result = chess.move(move);
        if (result) {
            renderBoard();
            startTimer(chess.turn() === 'w' ? 'black' : 'white'); // start opponent's timer
        } else {
            alert('Invalid move');
        }
    };
    
    socket.on('move', (move) => {
        chess.move(move);
        renderBoard();
        startTimer(chess.turn() === 'w' ? 'black' : 'white'); // start opponent's timer
    });

    const getPieceUnicode = (type, color) => {
        const pieceSymbols = {
            'p': '♙', 
            'r': '♖',
            'n': '♘', 
            'b': '♗',
            'q': '♕', 
            'k': '♔', 
            'P': '♟',
            'R': '♜',
            'N': '♞', 
            'B': '♝',
            'Q': '♛', 
            'K': '♚'  
        };
        return pieceSymbols[type];
    };

    const updateTimers = (timers) => {
        const formatTime = (seconds) => {
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
        };

        whiteTimerElement.textContent = `White: ${formatTime(timers.white)}`;
        blackTimerElement.textContent = `Black: ${formatTime(timers.black)}`;
    };

    socket.on('playerRole', (role) => {
        playerRole = role;
        renderBoard();
    });

    socket.on('spectatorRole', () => {
        playerRole = null;
        renderBoard();
    });

    socket.on('move', (move) => {
        chess.move(move);
        renderBoard();
    });

    socket.on('boardState', (fen) => {
        chess.load(fen);
        renderBoard();
    });

    socket.on('message', (msg) => {
        alert(msg.text);
    });

    socket.on('timerUpdate', (timers) => {
        updateTimers(timers);
    });

    socket.on('gameOver', (message) => {
        alert(message);
    });

    renderBoard();
});
