const collaborationSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Join a document room
    socket.on("join-document", (documentId) => {
      socket.join(documentId);

      console.log(
        `${socket.id} joined document room: ${documentId}`
      );

      socket.to(documentId).emit("user-joined", {
        userId: socket.id
      });
    });

    // Leave a document room
    socket.on("leave-document", (documentId) => {
      socket.leave(documentId);

      console.log(
        `${socket.id} left document room: ${documentId}`
      );
    });

    // Disconnect
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
};

module.exports = collaborationSocket;