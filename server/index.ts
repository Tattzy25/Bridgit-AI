import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import deeplRouter from "./routes/deepl";
import openrouterRouter from "./routes/openrouter";
import elevenlabsRouter from "./routes/elevenlabs";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    res.json({ message: "Hello from Express server v2!" });
  });

  app.get("/api/demo", handleDemo);
  app.use("/api/deepl", deeplRouter);
  app.use("/api/openrouter", openrouterRouter);
  app.use("/api/elevenlabs", elevenlabsRouter);

  return app;
}
