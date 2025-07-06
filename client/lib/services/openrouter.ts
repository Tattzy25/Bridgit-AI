interface OpenRouterRequest {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterService {
  private async makeRequest<T>(endpoint: string, body: any): Promise<T> {
    const response = await fetch(`/api/openrouter${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Title": "Bridgit-AI Proxy"
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }
    return response.json();
  }

  async enhanceTranslation(
    originalText: string,
    translatedText: string,
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<string> {
    const request: OpenRouterRequest = {
      model: "anthropic/claude-3.5-sonnet",
      messages: [
        {
          role: "system",
          content: `You are a professional translation enhancement AI. Your task is to improve machine translations while preserving meaning, context, and cultural nuances. \n\nGuidelines:\n- Maintain the original meaning exactly\n- Improve naturalness and fluency\n- Consider cultural context\n- Preserve tone and formality level\n- Return only the enhanced translation, no explanations`,
        },
        {
          role: "user",
          content: `Original text (${sourceLanguage}): "${originalText}"
          Machine translation (${targetLanguage}): "${translatedText}"
          \nPlease enhance this translation for naturalness and cultural appropriateness:`,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    };
    try {
      const data: OpenRouterResponse = await this.makeRequest<OpenRouterResponse>("/chat/completions", request);
      return data.choices[0]?.message?.content?.trim() || translatedText;
    } catch (error) {
      console.error("OpenRouter enhancement failed:", error);
      return translatedText;
    }
  }

  async detectLanguage(text: string): Promise<string> {
    const request: OpenRouterRequest = {
      model: "meta-llama/llama-3.1-8b-instruct:free",
      messages: [
        {
          role: "system",
          content:
            "You are a language detection AI. Return only the ISO 639-1 language code (2 letters) for the detected language. Examples: 'en' for English, 'es' for Spanish, 'fr' for French.",
        },
        {
          role: "user",
          content: `Detect the language of this text: "${text}"`,
        },
      ],
      max_tokens: 10,
      temperature: 0.1,
    };
    try {
      const data: OpenRouterResponse = await this.makeRequest<OpenRouterResponse>("/chat/completions", request);
      const detectedLang = data.choices[0]?.message?.content?.trim().toLowerCase();
      if (detectedLang && /^[a-z]{2}$/.test(detectedLang)) {
        return detectedLang;
      }
      return "en";
    } catch (error) {
      console.error("Language detection failed:", error);
      return "en";
    }
  }

  async generateVoiceCloneInstructions(audioSample: string): Promise<string> {
    const request: OpenRouterRequest = {
      model: "anthropic/claude-3.5-sonnet",
      messages: [
        {
          role: "system",
          content:
            "You are a voice cloning analysis AI. Analyze voice characteristics and provide technical parameters for voice synthesis.",
        },
        {
          role: "user",
          content: `Generate voice cloning parameters for this audio sample: ${audioSample}`,
        },
      ],
      max_tokens: 300,
      temperature: 0.2,
    };
    try {
      const data: OpenRouterResponse = await this.makeRequest<OpenRouterResponse>("/chat/completions", request);
      return data.choices[0]?.message?.content?.trim() || "";
    } catch (error) {
      console.error("Voice analysis failed:", error);
      return "";
    }
  }
}

export default new OpenRouterService();
