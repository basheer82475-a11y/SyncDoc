const { io } = require("socket.io-client");

const socket = io("http://127.0.0.1:5000", {
  transports: ["polling"],
  reconnection: false,
});


const documentId = "document-1";

socket.on("connect", () => {
  console.log("Client 1 connected:", socket.id);

  socket.emit("join-document", documentId);

  setTimeout(() => {
   const operation = {
  operationId: `client1-operation-${Date.now()}`,
  type: "UPDATE_BLOCK",
  documentId,
  blockId: "shared-block",
  content: "Updated by Client 1",
  position: null,
  userId: "client-1",
  timestamp: Date.now(),
};

    console.log("\nClient 1 sending operation:");
    console.log(operation);

    socket.emit("edit-operation", {
      documentId,
      operation,
    });
  }, 3000);
});

socket.on("document-state", (data) => {
  console.log("\nClient 1 received document state:");
  console.log(JSON.stringify(data, null, 2));
});

socket.on("user-joined", (data) => {
  console.log("\nAnother user joined:");
  console.log(data);
});

socket.on("operation-applied", (data) => {
  console.log("\nClient 1 received operation from another client:");
  console.log(JSON.stringify(data, null, 2));
});

socket.on("operation-confirmed", (data) => {
  console.log("\nClient 1 operation confirmed:");
  console.log(JSON.stringify(data, null, 2));
});

socket.on("operation-error", (data) => {
  console.error("\nOperation error:");
  console.error(data);
});

socket.on("connect_error", (error) => {
  console.error("\nClient 1 connection error:");
  console.error(error.message);
});

socket.on("disconnect", (reason) => {
  console.log("\nClient 1 disconnected:", reason);
});