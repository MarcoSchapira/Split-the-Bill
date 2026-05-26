import express from "express";
import cors from "cors";
import healthRoutes from "./routes/health.routes";
import authRoutes from "./auth/auth.routes";
import groupRoutes from "./groups/group.routes";
import { errorHandler, notFoundHandler } from "./http/errors";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/health", healthRoutes);
app.use("/auth", authRoutes);
app.use("/groups", groupRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
