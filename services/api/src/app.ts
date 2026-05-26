import express from "express";
import cors from "cors";
import healthRoutes from "./routes/health.routes";
import authRoutes from "./auth/auth.routes";
import groupRoutes from "./groups/group.routes";
import friendRoutes from "./friends/friend.routes";
import invitationRoutes from "./invitations/invitation.routes";
import billRoutes from "./bills/bill.routes";
import dashboardRoutes from "./dashboard/dashboard.routes";
import activityRoutes from "./activity/activity.routes";
import { errorHandler, notFoundHandler } from "./http/errors";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/health", healthRoutes);
app.use("/auth", authRoutes);
app.use("/groups", groupRoutes);
app.use("/friends", friendRoutes);
app.use("/", invitationRoutes);
app.use("/bills", billRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/activity", activityRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
