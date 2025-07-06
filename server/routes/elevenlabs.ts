import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/text-to-speech/:voiceId", async (req, res) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ElevenLabs API key not configured" });
  const { voiceId } = req.params;
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(req.body)
    });
    res.status(response.ok ? 200 : 500);
    response.body.pipe(res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;