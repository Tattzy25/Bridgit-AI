import express from "express";
import DeepL from "deepl";

const router = express.Router();

router.post("/translate", async (req, res) => {
  const { text, target_lang, source_lang, formality, preserve_formatting, tag_handling } = req.body;
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "DeepL API key not configured" });
  try {
    const translator = new DeepL.Translator(apiKey);
    const result = await translator.translateText(text, source_lang, target_lang, {
      formality,
      preserveFormatting: preserve_formatting,
      tagHandling: tag_handling
    });
    res.json({ translations: Array.isArray(result) ? result.map(r => ({ detected_source_language: r.detectedSourceLang, text: r.text })) : [{ detected_source_language: result.detectedSourceLang, text: result.text }] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/usage", async (_req, res) => {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "DeepL API key not configured" });
  try {
    const translator = new DeepL.Translator(apiKey);
    const usage = await translator.getUsage();
    res.json({ character_count: usage.character.count, character_limit: usage.character.limit });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/languages", async (req, res) => {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "DeepL API key not configured" });
  const type = req.query.type;
  try {
    const translator = new DeepL.Translator(apiKey);
    if (type === "source") {
      const langs = await translator.getSourceLanguages();
      res.json(langs);
    } else {
      const langs = await translator.getTargetLanguages();
      res.json(langs);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;