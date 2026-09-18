
const {
  createDocumentAST,
} = require("../services/collaboration/ast.service");

const {
  applyOperation,
} = require("../services/collaboration/operation-processor.service");
// Temporary in-memory state for active document rooms
const documentStates = {};

const collaborationSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Join a document room
    socket.on("join-document", (documentId) => {
      socket.join(documentId);

      // Create an empty AST for a new active document
      if (!documentStates[documentId]) {
        documentStates[documentId] = createDocumentAST([]);
      }

      console.log(
        `${socket.id} joined document room: ${documentId}`
      );

      // Send the current AST to the joining user
      socket.emit("document-state", {
        documentId,
        ast: documentStates[documentId],
      });

      // Notify other users in the same room
      socket.to(documentId).emit("user-joined", {
        userId: socket.id,
      });
    });

    // Receive an editing operation
    socket.on(
      "edit-operation",
      ({ documentId, operation }) => {
        try {
          // Create state if it does not exist
          if (!documentStates[documentId]) {
            documentStates[documentId] = createDocumentAST([]);
          }

          // Apply operation to the server AST
          const updatedAST = applyOperation(
            documentStates[documentId],
            operation
          );

          // Save updated AST in memory
          documentStates[documentId] = updatedAST;

          console.log("Operation received:", operation);

          // Broadcast operation to other users
          socket.to(documentId).emit("operation-applied", {
            operation,
            ast: updatedAST,
          });

          // Confirm operation to the sender
          socket.emit("operation-confirmed", {
            operation,
            ast: updatedAST,
          });
        } catch (error) {
          console.error("Operation error:", error.message);

          socket.emit("operation-error", {
            message: error.message,
          });
        }
      }
    );

    // Leave a document room
    socket.on("leave-document", (documentId) => {
      socket.leave(documentId);

      console.log(
        `${socket.id} left document room: ${documentId}`
      );
    });

    // Disconnect user
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
};

module.exports = collaborationSocket;