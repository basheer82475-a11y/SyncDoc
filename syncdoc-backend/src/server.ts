import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to SyncDoc Backend"
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`SyncDoc server running on port ${PORT}`);
});