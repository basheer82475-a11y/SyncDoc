import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);

// Home route
app.get("/", (_req, res) => {
  res.json({
    message: "Welcome to SyncDoc Backend",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`SyncDoc server running on port ${PORT}`);
});