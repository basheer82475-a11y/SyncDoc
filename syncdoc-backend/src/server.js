require("dotenv").config();

const connectDB = require("./config/db");
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Create Socket.io server
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

// Test API route
app.get("/", (req, res) => {
  res.send("SyncDoc backend is running!");
});

// Socket.io connection
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Start server
const PORT = 5000;
connectDB();
server.listen(PORT, () => {
  console.log(`SyncDoc server running on http://localhost:${PORT}`);
});