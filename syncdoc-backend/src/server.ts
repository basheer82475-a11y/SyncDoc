import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import { connectDatabase } from "./config/database";
import documentRoutes from "./routes/documentRoutes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to SyncDoc Backend"
  });
});

app.use("/api/documents", documentRoutes);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDatabase();

  app.listen(PORT, () => {
    console.log(`SyncDoc server running on port ${PORT}`);
  });
};

startServer();