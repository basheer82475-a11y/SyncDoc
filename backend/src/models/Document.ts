import mongoose, { Document, Schema } from "mongoose";

export interface IDocument extends Document {
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IDocument>("Document", documentSchema);