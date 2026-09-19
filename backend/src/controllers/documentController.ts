import { Request, Response } from "express";
import Document from "../models/Document";

export const createDocument = async (req: Request, res: Response) => {
  try {
    const { title, content } = req.body;

    if (!title) {
      return res.status(400).json({
        message: "Title is required",
      });
    }

    const document = await Document.create({
      title,
      content: content || "",
    });

    res.status(201).json({
      message: "Document created successfully",
      document,
    });
  } catch (error) {
    console.error("Error creating document:", error);

    res.status(500).json({
      message: "Failed to create document",
    });
  }
};

export const getDocuments = async (req: Request, res: Response) => {
  try {
    const documents = await Document.find().sort({ createdAt: -1 });

    res.status(200).json({
      documents,
    });
  } catch (error) {
    console.error("Error fetching documents:", error);

    res.status(500).json({
      message: "Failed to fetch documents",
    });
  }
};