import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import healthRoutes from "./routes/health.routes";
import authRoutes from "./auth/auth.routes";
import groupRoutes from "./groups/group.routes";
import friendRoutes from "./friends/friend.routes";
import invitationRoutes from "./invitations/invitation.routes";
import billRoutes from "./bills/bill.routes";
import dashboardRoutes from "./dashboard/dashboard.routes";
import activityRoutes from "./activity/activity.routes";
import { requireCsrf } from "./auth/csrf.middleware";
import { getWebOrigin, shouldTrustProxy } from "./config";
import { errorHandler, notFoundHandler } from "./http/errors";

const app = express();

if (shouldTrustProxy()) {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
  }),
);
app.use(
  cors({
    origin: getWebOrigin(),
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(requireCsrf);

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: "RATE_LIMITED", message: "Too many authentication attempts. Try again later." },
  },
});

const invitationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: "RATE_LIMITED", message: "Too many invitations sent. Try again later." },
  },
});

app.use("/auth/login", authRateLimit);
app.use("/auth/register", authRateLimit);
app.use("/auth/refresh", authRateLimit);
app.use("/friend-invitations", invitationRateLimit);
app.use("/groups/:groupId/invitations", invitationRateLimit);

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
