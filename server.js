const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const SIZE = 30;
const WIN_COUNT = 5;

const rooms = {};

app.use(express.static(path.join(__dirname, "public")));

function createEmptyBoard() {
  const board = [];

  for (let row = 0; row < SIZE; row++) {
    board[row] = [];

    for (let col = 0; col < SIZE; col++) {
      board[row][col] = "";
    }
  }

  return board;
}

function createRoom(roomId) {
  return {
    id: roomId,
    board: createEmptyBoard(),
    turn: "X",
    status: "waiting",
    winner: "",
    winCells: [],
    lastMove: null,
    playAgainRequest: null,

    players: {
      X: null,
      O: null
    },

    names: {
      X: "",
      O: ""
    },

    playerScores: {}
  };
}

function getPlayerSymbol(room, playerId) {
  if (room.players.X === playerId) {
    return "X";
  }

  if (room.players.O === playerId) {
    return "O";
  }

  return "spectator";
}

function getScoreBySymbol(room, symbol) {
  const id = room.players[symbol];

  if (!id) {
    return 0;
  }

  return room.playerScores[id] || 0;
}

function publicRoomData(room) {
  return {
    id: room.id,
    board: room.board,
    turn: room.turn,
    status: room.status,
    winner: room.winner,
    winCells: room.winCells || [],
    lastMove: room.lastMove || null,
    playAgainRequest: room.playAgainRequest,
    players: room.players,
    names: room.names,
    scores: {
      X: getScoreBySymbol(room, "X"),
      O: getScoreBySymbol(room, "O")
    }
  };
}

function getCellsOneSide(board, row, col, dr, dc, symbol) {
  const cells = [];

  let r = row + dr;
  let c = col + dc;

  while (
    r >= 0 &&
    r < SIZE &&
    c >= 0 &&
    c < SIZE &&
    board[r][c] === symbol
  ) {
    cells.push({ row: r, col: c });
    r += dr;
    c += dc;
  }

  return cells;
}

function getWinningCells(board, row, col, symbol) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1]
  ];

  for (const direction of directions) {
    const dr = direction[0];
    const dc = direction[1];

    const cells = [
      ...getCellsOneSide(board, row, col, -dr, -dc, symbol),
      { row: row, col: col },
      ...getCellsOneSide(board, row, col, dr, dc, symbol)
    ];

    if (cells.length >= WIN_COUNT) {
      return cells;
    }
  }

  return [];
}

function checkDraw(board) {
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (board[row][col] === "") {
        return false;
      }
    }
  }

  return true;
}

function swapPlayers(room) {
  const oldX = room.players.X;
  const oldO = room.players.O;

  const oldNameX = room.names.X;
  const oldNameO = room.names.O;

  room.players.X = oldO;
  room.players.O = oldX;

  room.names.X = oldNameO;
  room.names.O = oldNameX;
}

function startNextGame(room) {
  swapPlayers(room);

  room.board = createEmptyBoard();
  room.turn = "X";
  room.status = "playing";
  room.winner = "";
  room.winCells = [];
  room.lastMove = null;
  room.playAgainRequest = null;
}

io.on("connection", (socket) => {
  console.log("Có người kết nối:", socket.id);

  socket.on("joinRoom", (data) => {
    const roomId = data.roomId;
    const playerId = data.playerId;
    const playerName = data.playerName || "Người chơi";

    if (!roomId || !playerId) {
      return;
    }

    if (!rooms[roomId]) {
      rooms[roomId] = createRoom(roomId);
    }

    const room = rooms[roomId];

    if (room.playerScores[playerId] === undefined) {
      room.playerScores[playerId] = 0;
    }

    let symbol = getPlayerSymbol(room, playerId);

    if (symbol === "spectator") {
      if (!room.players.X) {
        room.players.X = playerId;
        room.names.X = playerName;
        symbol = "X";
      } else if (!room.players.O) {
        room.players.O = playerId;
        room.names.O = playerName;
        symbol = "O";
      }
    } else {
      room.names[symbol] = playerName;
    }

    if (room.players.X && room.players.O && room.status === "waiting") {
      room.status = "playing";
    }

    socket.join(roomId);

    socket.emit("joinedRoom", {
      symbol: symbol
    });

    io.to(roomId).emit("roomData", publicRoomData(room));
  });

  socket.on("makeMove", (data) => {
    const room = rooms[data.roomId];

    if (!room) {
      return;
    }

    const symbol = getPlayerSymbol(room, data.playerId);

    if (symbol !== "X" && symbol !== "O") {
      return;
    }

    if (room.status !== "playing") {
      return;
    }

    if (room.turn !== symbol) {
      return;
    }

    const row = data.row;
    const col = data.col;

    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) {
      return;
    }

    if (room.board[row][col] !== "") {
      return;
    }

    room.board[row][col] = symbol;
    room.lastMove = {
  row: row,
  col: col,
  symbol: symbol
};

    const winningCells = getWinningCells(room.board, row, col, symbol);

    if (winningCells.length >= WIN_COUNT) {
      room.status = "ended";
      room.winner = symbol;
      room.winCells = winningCells;

      room.playerScores[data.playerId] = room.playerScores[data.playerId] + 1;
    } else if (checkDraw(room.board)) {
      room.status = "ended";
      room.winner = "draw";
      room.winCells = [];
    } else {
      room.turn = symbol === "X" ? "O" : "X";
    }

    io.to(data.roomId).emit("roomData", publicRoomData(room));
  });

  socket.on("requestPlayAgain", (data) => {
    const room = rooms[data.roomId];

    if (!room) {
      return;
    }

    const symbol = getPlayerSymbol(room, data.playerId);

    if (symbol !== "X" && symbol !== "O") {
      return;
    }

    if (room.status !== "ended") {
      return;
    }

    if (room.playAgainRequest) {
      return;
    }

    room.playAgainRequest = {
      requesterPlayerId: data.playerId,
      requesterSymbol: symbol,
      requesterName: room.names[symbol] || "Đối thủ"
    };

    io.to(data.roomId).emit("roomData", publicRoomData(room));
  });

  socket.on("respondPlayAgain", (data) => {
    const room = rooms[data.roomId];

    if (!room) {
      return;
    }

    const symbol = getPlayerSymbol(room, data.playerId);

    if (symbol !== "X" && symbol !== "O") {
      return;
    }

    if (!room.playAgainRequest) {
      return;
    }

    if (room.playAgainRequest.requesterPlayerId === data.playerId) {
      return;
    }

    if (data.accepted) {
      startNextGame(room);

      io.to(data.roomId).emit("playAgainAccepted");
      io.to(data.roomId).emit("roomData", publicRoomData(room));
    } else {
      const requesterPlayerId = room.playAgainRequest.requesterPlayerId;
      const rejecterName = room.names[symbol] || "Đối thủ";

      room.playAgainRequest = null;

      io.to(data.roomId).emit("playAgainRejected", {
        requesterPlayerId: requesterPlayerId,
        rejecterName: rejecterName
      });

      io.to(data.roomId).emit("roomData", publicRoomData(room));
    }
  });

  socket.on("disconnect", () => {
    console.log("Có người thoát:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log("Server đang chạy tại:");
  console.log("http://localhost:" + PORT);
});
