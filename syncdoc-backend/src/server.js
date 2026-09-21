


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

// Middleware
app.use(cors());
app.use(express.json());


// API Routes
app.use("/api/documents", documentRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/sharing", sharingRoutes);


// Create HTTP server
const server = http.createServer(app);

// Create Socket.io server
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Test API route
app.get("/", (req, res) => {
  res.send("SyncDoc backend is running!");
});

// Initialize collaboration socket
collaborationSocket(io);

// Start server
const PORT = process.env.PORT || 5000;

// connectDB();

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `SyncDoc server running on http://localhost:${PORT}`
  );
});