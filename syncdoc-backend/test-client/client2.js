const { io } = require("socket.io-client");

const socket = io("http://127.0.0.1:5000");

const documentId = "document-1";

socket.on("connect", () => {
  console.log("Client 2 connected:", socket.id);

  socket.emit("join-document", documentId);

  setTimeout(() => {
   const operation = {
  operationId: `client2-operation-${Date.now()}`,
  type: "UPDATE_BLOCK",
  documentId,
  blockId: "shared-block",
  content: "Updated by Client 2",
  position: null,
  userId: "client-2",
  timestamp: Date.now(),
};
    console.log("\nClient 2 sending operation:");
    console.log(operation);

    socket.emit("edit-operation", {
      documentId,
      operation,
    });
  }, 5000);
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
  console.error("\nClient 2 operation error:");
  console.error(data);
});

socket.on("connect_error", (error) => {
  console.error("Client 2 connection error:", error.message);
});

socket.on("disconnect", (reason) => {
  console.log("Client 2 disconnected:", reason);
});