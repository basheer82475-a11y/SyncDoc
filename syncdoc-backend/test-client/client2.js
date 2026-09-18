const { io } = require("socket.io-client");

const socket = io("http://localhost:5000");

const documentId = "document-1";

socket.on("connect", () => {
  console.log("Client 2 connected");
  console.log("Socket ID:", socket.id);

  socket.emit("join-document", documentId);
});

socket.on("document-state", (data) => {
  console.log("\nClient 2 received document state:");
  console.log(JSON.stringify(data, null, 2));
});

socket.on("user-joined", (data) => {
  console.log("\nClient 2 detected another user:");
  console.log(data);
});

socket.on("operation-applied", (data) => {
  console.log("\nClient 2 received operation:");
  console.log(JSON.stringify(data, null, 2));
});

socket.on("operation-confirmed", (data) => {
  console.log("\nClient 2 operation confirmed:");
  console.log(JSON.stringify(data, null, 2));
});

socket.on("operation-error", (data) => {
  console.error("\nOperation error:");
  console.error(data);
});