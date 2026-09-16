import { Request, Response } from "express";

export const register = async (req: Request, res: Response) => {
  try {
    res.status(201).json({
      message: "Register API is working",
    });
  } catch (error) {
    res.status(500).json({
      message: "Registration failed",
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    res.status(200).json({
      message: "Login API is working",
    });
  } catch (error) {
    res.status(500).json({
      message: "Login failed",
    });
  }
};

export const getMe = async (req: Request, res: Response) => {
  res.status(200).json({
    message: "User profile API is working",
  });
};