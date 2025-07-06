import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/chat/completions", async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OpenRouter API key not configured" });
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": req.headers["origin"] || "",
        "X-Title": req.headers["x-title"] || "Bridgit-AI Proxy"
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.ok ? 200 : 500).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;