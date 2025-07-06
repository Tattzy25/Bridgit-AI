import express from "express";
// import { ElevenLabsClient } from "@elevenlabs/elevenlabs-node";

const router = express.Router();

// The ElevenLabs SDK is not available. This endpoint is currently disabled.
// router.post("/text-to-speech/:voiceId", async (req, res) => {
//   const apiKey = process.env.ELEVENLABS_API_KEY;
//   if (!apiKey) return res.status(500).json({ error: "ElevenLabs API key not configured" });
//   const { voiceId } = req.params;
//   const { text, model_id, voice_settings, pronunciation_dictionary_locators } = req.body;
//   try {
//     const client = new ElevenLabsClient({ apiKey });
//     const stream = await client.textToSpeech({
//       voiceId,
//       text,
//       modelId: model_id,
//       voiceSettings: voice_settings,
//       pronunciationDictionaryLocators: pronunciation_dictionary_locators,
//       outputFormat: "mp3"
//     });
//     res.setHeader("Content-Type", "audio/mpeg");
//     stream.pipe(res);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

export default router;