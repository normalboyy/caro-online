const socket = io();

const SIZE = 30;

// Màn hình
const nameScreen = document.getElementById("nameScreen");
const lobbyScreen = document.getElementById("lobbyScreen");
const gameScreen = document.getElementById("gameScreen");

// Nhập tên
const startNameInput = document.getElementById("startNameInput");
const startNameBtn = document.getElementById("startNameBtn");

// Lobby
const lobbyPlayerName = document.getElementById("lobbyPlayerName");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomInput = document.getElementById("joinRoomInput");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const changeNameBtn = document.getElementById("changeNameBtn");

// Game
const boardElement = document.getElementById("board");
const roomIdText = document.getElementById("roomIdText");
const mySymbolText = document.getElementById("mySymbolText");
const playerXText = document.getElementById("playerXText");
const playerOText = document.getElementById("playerOText");
const statusText = document.getElementById("statusText");
const inviteLink = document.getElementById("inviteLink");
const currentPlayerNameText = document.getElementById("currentPlayerNameText");

const copyRoomCodeBtn = document.getElementById("copyRoomCodeBtn");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const backLobbyBtn = document.getElementById("backLobbyBtn");
const playAgainBtn = document.getElementById("playAgainBtn");

// Popup kết quả
const resultModal = document.getElementById("resultModal");
const resultTitle = document.getElementById("resultTitle");
const resultPlayerName = document.getElementById("resultPlayerName");
const resultScore = document.getElementById("resultScore");
const resultPlayAgainBtn = document.getElementById("resultPlayAgainBtn");
const resultCloseBtn = document.getElementById("resultCloseBtn");

// Popup xác nhận chơi tiếp
const playAgainConfirmModal = document.getElementById("playAgainConfirmModal");
const playAgainRequesterName = document.getElementById("playAgainRequesterName");
const acceptPlayAgainBtn = document.getElementById("acceptPlayAgainBtn");
const rejectPlayAgainBtn = document.getElementById("rejectPlayAgainBtn");

let mySymbol = "";
let currentRoom = null;
let lastResultKey = "";
let roomId = null;
let hasJoinedRoom = false;

let playerId = localStorage.getItem("caro_player_id");

if (!playerId) {
  playerId = crypto.randomUUID();
  localStorage.setItem("caro_player_id", playerId);
}

let playerName = localStorage.getItem("caro_player_name") || "";

startNameInput.value = playerName;

// Khi mở web, luôn hiện màn hình nhập tên
showNameScreen();

function showNameScreen() {
  nameScreen.classList.remove("hidden");
  lobbyScreen.classList.add("hidden");
  gameScreen.classList.add("hidden");

  hideResultModal();
  hidePlayAgainConfirmModal();
}

function showLobbyScreen() {
  nameScreen.classList.add("hidden");
  lobbyScreen.classList.remove("hidden");
  gameScreen.classList.add("hidden");

  lobbyPlayerName.textContent = playerName;

  hideResultModal();
  hidePlayAgainConfirmModal();

  joinRoomInput.value = "";
  joinRoomInput.focus();
}

function showGameScreen() {
  nameScreen.classList.add("hidden");
  lobbyScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");

  currentPlayerNameText.textContent = playerName;
}

function createRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function normalizeRoomCode(code) {
  return code.trim().toUpperCase();
}

function startGameWithRoom(targetRoomId) {
  roomId = normalizeRoomCode(targetRoomId);

  if (!roomId) {
    alert("Mã phòng không được để trống.");
    return;
  }

  hasJoinedRoom = true;
  currentRoom = null;
  mySymbol = "";
  lastResultKey = "";

  roomIdText.textContent = roomId;
  inviteLink.value = window.location.origin + window.location.pathname + "?room=" + roomId;

  window.history.replaceState(null, "", "?room=" + roomId);

  showGameScreen();

  statusText.textContent = "Đang vào phòng...";
  boardElement.innerHTML = "";

  joinRoom();
}

function joinRoom() {
  socket.emit("joinRoom", {
    roomId: roomId,
    playerId: playerId,
    playerName: playerName
  });
}

function updateMySymbolFromRoom() {
  if (!currentRoom || !currentRoom.players) {
    return;
  }

  if (currentRoom.players.X === playerId) {
    mySymbol = "X";
  } else if (currentRoom.players.O === playerId) {
    mySymbol = "O";
  } else {
    mySymbol = "spectator";
  }

  updateMySymbolText();
}

function updateMySymbolText() {
  if (mySymbol === "X") {
    mySymbolText.textContent = "Người chơi X";
  } else if (mySymbol === "O") {
    mySymbolText.textContent = "Người chơi O";
  } else if (mySymbol === "spectator") {
    mySymbolText.textContent = "Khán giả";
  } else {
    mySymbolText.textContent = "Đang kết nối...";
  }
}

function getOpponentSymbol(symbol) {
  return symbol === "X" ? "O" : "X";
}

function getMyScoreText() {
  if (!currentRoom || !currentRoom.scores) {
    return "0-0";
  }

  if (mySymbol !== "X" && mySymbol !== "O") {
    return (currentRoom.scores.X || 0) + "-" + (currentRoom.scores.O || 0);
  }

  const opponentSymbol = getOpponentSymbol(mySymbol);

  const myScore = currentRoom.scores[mySymbol] || 0;
  const opponentScore = currentRoom.scores[opponentSymbol] || 0;

  return myScore + "-" + opponentScore;
}

function showResultModal() {
  if (!currentRoom) {
    return;
  }

  if (currentRoom.winner === mySymbol) {
    resultTitle.textContent = "winnn";
    resultPlayerName.textContent = currentRoom.names[mySymbol] || "Người chơi " + mySymbol;
    resultScore.textContent = getMyScoreText();
  } else if (mySymbol === "X" || mySymbol === "O") {
    resultTitle.textContent = "kẻ thua cuộc";
    resultPlayerName.textContent = currentRoom.names[mySymbol] || "Người chơi " + mySymbol;
    resultScore.textContent = getMyScoreText();
  } else {
    resultTitle.textContent = "người xem";
    resultPlayerName.textContent = "Người thắng: " + currentRoom.winner;
    resultScore.textContent = getMyScoreText();
  }

  resultModal.classList.add("show");
}

function hideResultModal() {
  resultModal.classList.remove("show");
}

function showPlayAgainConfirmModal(requesterName) {
  hideResultModal();
  playAgainRequesterName.textContent = requesterName;
  playAgainConfirmModal.classList.add("show");
}

function hidePlayAgainConfirmModal() {
  playAgainConfirmModal.classList.remove("show");
}

function requestPlayAgain() {
  if (!currentRoom) {
    return;
  }

  if (currentRoom.status !== "ended") {
    alert("Ván chưa kết thúc nên chưa thể chơi tiếp.");
    return;
  }

  if (mySymbol !== "X" && mySymbol !== "O") {
    alert("Khán giả không thể yêu cầu chơi tiếp.");
    return;
  }

  hideResultModal();
  playAgainBtn.style.display = "none";
  statusText.textContent = "Đã gửi yêu cầu chơi tiếp. Đang chờ đối thủ xác nhận...";

  socket.emit("requestPlayAgain", {
    roomId: roomId,
    playerId: playerId
  });
}

function respondPlayAgain(accepted) {
  hidePlayAgainConfirmModal();

  socket.emit("respondPlayAgain", {
    roomId: roomId,
    playerId: playerId,
    accepted: accepted
  });
}

function handlePlayAgainRequest() {
  if (!currentRoom || !currentRoom.playAgainRequest) {
    hidePlayAgainConfirmModal();
    return;
  }

  const request = currentRoom.playAgainRequest;

  if (mySymbol !== "X" && mySymbol !== "O") {
    hidePlayAgainConfirmModal();
    return;
  }

  if (request.requesterPlayerId === playerId) {
    hidePlayAgainConfirmModal();
    statusText.textContent = "Đang chờ đối thủ xác nhận chơi tiếp...";
    return;
  }

  showPlayAgainConfirmModal(request.requesterName || "Đối thủ");
}

function renderRoom() {
  if (!currentRoom) {
    return;
  }

  playerXText.textContent = currentRoom.names.X || "Đang chờ...";
  playerOText.textContent = currentRoom.names.O || "Đang chờ...";

  if (currentRoom.status === "waiting") {
    statusText.textContent = "Đang chờ người chơi thứ 2 vào phòng...";
    playAgainBtn.style.display = "none";
    hideResultModal();
    hidePlayAgainConfirmModal();
  }

  if (currentRoom.status === "playing") {
    playAgainBtn.style.display = "none";
    hideResultModal();
    hidePlayAgainConfirmModal();

    if (currentRoom.turn === mySymbol) {
      statusText.textContent = "Đến lượt bạn: " + mySymbol;
    } else {
      statusText.textContent = "Đang chờ lượt: " + currentRoom.turn;
    }
  }

  if (currentRoom.status === "ended") {
    playAgainBtn.style.display = mySymbol === "X" || mySymbol === "O" ? "inline-block" : "none";

    if (currentRoom.winner === "draw") {
      statusText.textContent = "Kết quả: Hòa!";
    } else {
      if (currentRoom.winner === mySymbol) {
        statusText.textContent = "Bạn đã thắng!";
      } else if (mySymbol === "X" || mySymbol === "O") {
        statusText.textContent = "Bạn đã thua!";
      } else {
        statusText.textContent = "Người thắng là: " + currentRoom.winner;
      }

      const xScore = currentRoom.scores ? currentRoom.scores.X : 0;
      const oScore = currentRoom.scores ? currentRoom.scores.O : 0;
      const resultKey = currentRoom.id + "-" + currentRoom.winner + "-" + xScore + "-" + oScore;

      if (lastResultKey !== resultKey) {
        lastResultKey = resultKey;
        showResultModal();
      }
    }

    handlePlayAgainRequest();
  }

  renderBoard();
}

function renderBoard() {
  boardElement.innerHTML = "";

  if (!currentRoom || !currentRoom.board) {
    return;
  }

  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const cell = document.createElement("button");
      cell.classList.add("cell");

      const value = currentRoom.board[row][col];

      cell.textContent = value === "X" ? "×" : value === "O" ? "o" : "";

      if (value === "X") {
        cell.classList.add("x");
      }

      if (value === "O") {
        cell.classList.add("o");
      }

      const winCells = currentRoom.winCells || [];

      const isWinCell = winCells.some(function (item) {
        return item.row === row && item.col === col;
      });

      if (isWinCell) {
        cell.classList.add("win");
      }

      const isEmpty = value === "";
      const isMyTurn = currentRoom.turn === mySymbol;
      const isPlaying = currentRoom.status === "playing";
      const isRealPlayer = mySymbol === "X" || mySymbol === "O";

      if (!isEmpty || !isMyTurn || !isPlaying || !isRealPlayer) {
        cell.disabled = true;
      }

      cell.addEventListener("click", function () {
        makeMove(row, col);
      });

      boardElement.appendChild(cell);
    }
  }
}

function makeMove(row, col) {
  socket.emit("makeMove", {
    roomId: roomId,
    playerId: playerId,
    row: row,
    col: col
  });
}

// Socket
socket.on("joinedRoom", function (data) {
  mySymbol = data.symbol;
  updateMySymbolText();
});

socket.on("roomData", function (room) {
  if (!hasJoinedRoom) {
    return;
  }

  currentRoom = room;
  updateMySymbolFromRoom();
  renderRoom();
});

socket.on("playAgainAccepted", function () {
  hideResultModal();
  hidePlayAgainConfirmModal();
  alert("Đối thủ đã đồng ý. Ván mới bắt đầu!");
});

socket.on("playAgainRejected", function (data) {
  hidePlayAgainConfirmModal();

  if (data.requesterPlayerId === playerId) {
    alert(data.rejecterName + " đã từ chối chơi tiếp.");
  }
});

// Sự kiện nhập tên
startNameBtn.addEventListener("click", function () {
  const name = startNameInput.value.trim();

  if (name === "") {
    alert("Bạn cần nhập tên trước.");
    return;
  }

  playerName = name;
  localStorage.setItem("caro_player_name", playerName);

  const urlParams = new URLSearchParams(window.location.search);
  const urlRoom = urlParams.get("room");

  if (urlRoom) {
    startGameWithRoom(urlRoom);
  } else {
    showLobbyScreen();
  }
});

startNameInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    startNameBtn.click();
  }
});

// Sự kiện lobby
createRoomBtn.addEventListener("click", function () {
  const newRoomId = createRoomId();
  startGameWithRoom(newRoomId);
});

joinRoomBtn.addEventListener("click", function () {
  const inputRoomId = joinRoomInput.value.trim();

  if (inputRoomId === "") {
    alert("Bạn cần nhập mã phòng.");
    return;
  }

  startGameWithRoom(inputRoomId);
});

joinRoomInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    joinRoomBtn.click();
  }
});

changeNameBtn.addEventListener("click", function () {
  showNameScreen();
});

// Sự kiện game
copyRoomCodeBtn.addEventListener("click", function () {
  navigator.clipboard.writeText(roomId);
  alert("Đã copy mã phòng: " + roomId);
});

copyLinkBtn.addEventListener("click", function () {
  navigator.clipboard.writeText(inviteLink.value);
  alert("Đã copy link phòng.");
});

backLobbyBtn.addEventListener("click", function () {
  hasJoinedRoom = false;
  currentRoom = null;
  mySymbol = "";
  roomId = null;

  window.history.replaceState(null, "", window.location.pathname);

  showLobbyScreen();
});

playAgainBtn.addEventListener("click", function () {
  requestPlayAgain();
});

resultPlayAgainBtn.addEventListener("click", function () {
  requestPlayAgain();
});

resultCloseBtn.addEventListener("click", function () {
  hideResultModal();
});

acceptPlayAgainBtn.addEventListener("click", function () {
  respondPlayAgain(true);
});

rejectPlayAgainBtn.addEventListener("click", function () {
  respondPlayAgain(false);
});
