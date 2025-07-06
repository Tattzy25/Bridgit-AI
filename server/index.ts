import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { body, validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import { handleDemo } from "./routes/demo";
import deeplRouter from "./routes/deepl";
import openrouterRouter from "./routes/openrouter";
import elevenlabsRouter from "./routes/elevenlabs";

const trustedOrigins = [
  "http://localhost:3000",
  "http://localhost:8082",
  "http://localhost:8084",
  // Add your production domain(s) here
];

export function createServer() {
  const app = express();

  // Security: Rate limiting
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
  }));

  // Security: Restrict CORS
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || trustedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // JWT Auth middleware example
  app.use((req, res, next) => {
    // Example: Protect all /api routes except /api/ping
    if (req.path.startsWith("/api") && req.path !== "/api/ping") {
      const authHeader = req.headers["authorization"];
      if (!authHeader) return res.status(401).json({ error: "Missing auth token" });
      const token = authHeader.replace("Bearer ", "");
      try {
        jwt.verify(token, process.env.STACK_SECRET_SERVER_KEY || "secret");
        next();
      } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
    } else {
      next();
    }
  });

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    res.json({ message: "Hello from Express server v2!" });
  });

  // Removed demo route registration
  app.use("/api/deepl", deeplRouter);
  app.use("/api/openrouter", openrouterRouter);
  app.use("/api/elevenlabs", elevenlabsRouter);

  return app;
}
