require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const collaborationSocket = require("./sockets/collaboration.socket");
const documentRoutes = require("./routes/documentRoutes");
const authRoutes = require("./routes/authRoutes");
const sharingRoutes = require("./routes/sharingRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/documents", documentRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/sharing", sharingRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.get("/", (req, res) => {
  res.send("SyncDoc backend is running!");
});

// Initialize collaboration socket
collaborationSocket(io);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  server.listen(PORT, "0.0.0.0", () => {
    console.log(
      `SyncDoc server running on http://localhost:${PORT}`
    );
  });
};

if (require.main === module) {
  startServer();
}

module.exports = { app, server, io, startServer };
