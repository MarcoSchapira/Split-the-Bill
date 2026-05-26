import type { RequestHandler } from "express";
import { currentUser } from "./currentUser";
import { loginSchema, registerSchema } from "./auth.types";
import { loginUser, registerUser } from "./auth.service";

export const register: RequestHandler = async (req, res) => {
  const result = await registerUser(registerSchema.parse(req.body));
  res.status(201).json(result);
};

export const login: RequestHandler = async (req, res) => {
  const result = await loginUser(loginSchema.parse(req.body));
  res.json(result);
};

export const me: RequestHandler = (req, res) => {
  res.json({ user: currentUser(req) });
};
