const { io } = require("socket.io-client");

const socket = io("http://localhost:5000");

const documentId = "document-1";

socket.on("connect", () => {
  console.log("Connected to server");
  console.log("Socket ID:", socket.id);

  // Join a document room
  socket.emit("join-document", documentId);
});

// Receive the current document state
socket.on("document-state", (data) => {
  console.log("\nCurrent document state:");
  console.log(JSON.stringify(data, null, 2));
});

// Notify when another user joins
socket.on("user-joined", (data) => {
  console.log("\nAnother user joined:");
  console.log(data);
});

// Receive an operation from another user
socket.on("operation-applied", (data) => {
  console.log("\nOperation received from another user:");
  console.log(JSON.stringify(data, null, 2));
});

// Receive confirmation for our own operation
socket.on("operation-confirmed", (data) => {
  console.log("\nOur operation was confirmed:");
  console.log(JSON.stringify(data, null, 2));
});

// Receive operation errors
socket.on("operation-error", (data) => {
  console.error("\nOperation error:");
  console.error(data);
});

socket.on("disconnect", () => {
  console.log("Disconnected from server");
});