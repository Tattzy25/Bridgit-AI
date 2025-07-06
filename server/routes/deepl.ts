import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/translate", async (req, res) => {
  const { text, target_lang, source_lang, formality, preserve_formatting, tag_handling } = req.body;
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "DeepL API key not configured" });

  const formData = new URLSearchParams();
  if (Array.isArray(text)) text.forEach((t) => formData.append("text", t));
  else if (text) formData.append("text", text);
  if (target_lang) formData.append("target_lang", target_lang);
  if (source_lang) formData.append("source_lang", source_lang);
  if (formality) formData.append("formality", formality);
  if (preserve_formatting !== undefined) formData.append("preserve_formatting", preserve_formatting ? "1" : "0");
  if (tag_handling) formData.append("tag_handling", tag_handling);

  try {
    const response = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: { "Authorization": `DeepL-Auth-Key ${apiKey}` },
      body: formData
    });
    const data = await response.json();
    res.status(response.ok ? 200 : 500).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/usage", async (_req, res) => {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "DeepL API key not configured" });
  try {
    const response = await fetch("https://api-free.deepl.com/v2/usage", {
      method: "POST",
      headers: { "Authorization": `DeepL-Auth-Key ${apiKey}` }
    });
    const data = await response.json();
    res.status(response.ok ? 200 : 500).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/languages", async (req, res) => {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "DeepL API key not configured" });
  const type = req.query.type;
  try {
    const response = await fetch(`https://api-free.deepl.com/v2/languages?type=${type}`, {
      method: "GET",
      headers: { "Authorization": `DeepL-Auth-Key ${apiKey}` }
    });
    const data = await response.json();
    res.status(response.ok ? 200 : 500).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;