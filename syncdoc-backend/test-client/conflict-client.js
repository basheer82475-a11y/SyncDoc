const { io } = require("socket.io-client");

const socket = io("http://127.0.0.1:5000", {
  transports: ["polling"],
  reconnection: false,
});

const documentId = "document-1";

socket.on("connect", () => {
  console.log("Conflict test client connected:", socket.id);

  socket.emit("join-document", documentId);

  setTimeout(() => {
    const operation = {
      operationId: `conflict-test-${Date.now()}`,
      type: "UPDATE_BLOCK",
      documentId,
      blockId: "shared-block",
      content: "Conflicting update",
      userId: "conflict-user",
      timestamp: Date.now(),
    };

    console.log("Sending conflict test operation:");

    console.log(operation);

    socket.emit("edit-operation", {
      documentId,
      operation,
    });
  }, 1000);
});

socket.on("operation-confirmed", (data) => {
  console.log("\nOperation confirmed:");
  console.log(data);
});

socket.on("operation-error", (error) => {
  console.log("\nOperation error:");
  console.log(error);
});

socket.on("document-state", (data) => {
  console.log("\nDocument state:");
  console.log(data);
});