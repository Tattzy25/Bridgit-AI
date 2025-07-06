interface DeepLTranslateRequest {
  text: string[];
  target_lang: string;
  source_lang?: string;
  formality?: "default" | "more" | "less" | "prefer_more" | "prefer_less";
  preserve_formatting?: boolean;
  tag_handling?: "xml" | "html";
}

interface DeepLTranslateResponse {
  translations: Array<{
    detected_source_language: string;
    text: string;
  }>;
}

interface DeepLUsageResponse {
  character_count: number;
  character_limit: number;
}

interface DeepLLanguage {
  language: string;
  name: string;
  supports_formality?: boolean;
}

export class DeepLService {
  private async makeRequest<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`/api/deepl${endpoint}`, {
      method: endpoint === "/translate" ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json"
      },
      body: endpoint === "/translate" ? JSON.stringify(data) : undefined
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepL API error: ${response.status} - ${errorText}`);
    }
    return response.json();
  }

  async translateText(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string,
    options: {
      formality?: "default" | "more" | "less";
      preserveFormatting?: boolean;
    } = {},
  ): Promise<{
    text: string;
    detectedSourceLanguage: string;
  }> {
    try {
      const request: DeepLTranslateRequest = {
        text: [text],
        target_lang: this.normalizeLanguageCode(targetLanguage),
        formality: options.formality || "default",
        preserve_formatting: options.preserveFormatting || true,
      };
      if (sourceLanguage) {
        request.source_lang = this.normalizeLanguageCode(sourceLanguage);
      }
      const response = await this.makeRequest<DeepLTranslateResponse>(
        "/translate",
        request,
      );
      const translation = response.translations[0];
      if (!translation) {
        throw new Error("No translation returned from DeepL");
      }
      return {
        text: translation.text,
        detectedSourceLanguage: translation.detected_source_language,
      };
    } catch (error) {
      console.error("DeepL translation failed:", error);
      throw error;
    }
  }

  async getUsage(): Promise<DeepLUsageResponse> {
    try {
      return await this.makeRequest<DeepLUsageResponse>("/usage", {});
    } catch (error) {
      console.error("Failed to get DeepL usage:", error);
      throw error;
    }
  }

  async getSupportedLanguages(): Promise<{
    source: DeepLLanguage[];
    target: DeepLLanguage[];
  }> {
    try {
      const [sourceLanguages, targetLanguages] = await Promise.all([
        this.makeRequest<DeepLLanguage[]>("/languages?type=source", {}),
        this.makeRequest<DeepLLanguage[]>("/languages?type=target", {}),
      ]);
      return {
        source: sourceLanguages,
        target: targetLanguages,
      };
    } catch (error) {
      console.error("Failed to get supported languages:", error);
      throw error;
    }
  }

  private normalizeLanguageCode(code: string): string {
    const codeMap: Record<string, string> = {
      en: "EN-US",
      zh: "ZH",
      pt: "PT-PT",
    };
    return codeMap[code.toLowerCase()] || code.toUpperCase();
  }

  async batchTranslate(
    texts: string[],
    targetLanguage: string,
    sourceLanguage?: string,
  ): Promise<Array<{ text: string; detectedSourceLanguage: string }>> {
    try {
      const request: DeepLTranslateRequest = {
        text: texts,
        target_lang: this.normalizeLanguageCode(targetLanguage),
        preserve_formatting: true,
      };
      if (sourceLanguage) {
        request.source_lang = this.normalizeLanguageCode(sourceLanguage);
      }
      const response = await this.makeRequest<DeepLTranslateResponse>(
        "/translate",
        request,
      );
      return response.translations.map((translation) => ({
        text: translation.text,
        detectedSourceLanguage: translation.detected_source_language,
      }));
    } catch (error) {
      console.error("DeepL batch translation failed:", error);
      throw error;
    }
  }
}

export default new DeepLService();
