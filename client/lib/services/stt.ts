import OpenRouterService from "./openrouter";

export interface STTResult {
  text: string;
  confidence: number;
  language: string;
  duration: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
    confidence: number;
  }>;
}

export interface STTOptions {
  language?: string;
  enablePunctuation?: boolean;
  enableWordTimestamps?: boolean;
  maxRetries?: number;
}

export class SpeechToTextService {
  constructor() {}

  async transcribeAudio(
    audioBlob: Blob,
    options: STTOptions = {},
  ): Promise<STTResult> {
    try {
      // Convert audio blob to base64 for processing
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = this.arrayBufferToBase64(arrayBuffer);

      // Use OpenRouter for advanced speech recognition
      const transcription = await this.transcribeWithOpenRouter(
        base64Audio,
        audioBlob.type,
        options,
      );

      return transcription;
    } catch (error) {
      console.error("STT transcription failed:", error);
      throw error;
    }
  }

  private async transcribeWithOpenRouter(
    base64Audio: string,
    mimeType: string,
    options: STTOptions,
  ): Promise<STTResult> {
    try {
      const prompt = `Transcribe the following audio data to text. The audio is in ${mimeType} format.
      
      ${options.language ? `Expected language: ${options.language}` : "Detect language automatically"}
      ${options.enablePunctuation ? "Include proper punctuation." : ""}
      ${options.enableWordTimestamps ? "Include word-level timestamps if possible." : ""}
      
      Return the result in JSON format with the following structure:
      {
        "text": "transcribed text here",
        "confidence": 0.95,
        "language": "detected or specified language code",
        "duration": "audio duration in seconds"
      }
      
      Audio data (base64): ${base64Audio.substring(0, 1000)}...`;

      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": window.location.origin,
            "X-Title": "Bridgit-AI Speech Recognition",
          },
          body: JSON.stringify({
            model: "openai/whisper-large-v3",
            messages: [
              {
                role: "system",
                content:
                  "You are a professional speech-to-text transcription AI. Provide accurate transcriptions with confidence scores.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            max_tokens: 1000,
            temperature: 0.1,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`OpenRouter STT failed: ${response.status}`);
      }

      const data = await response.json();
      const resultText = data.choices[0]?.message?.content;

      if (!resultText) {
        throw new Error("No transcription result from OpenRouter");
      }

      // Try to parse JSON response
      try {
        const parsed = JSON.parse(resultText);
        return {
          text: parsed.text || resultText,
          confidence: parsed.confidence || 0.8,
          language: parsed.language || options.language || "en",
          duration: parsed.duration || 0,
        };
      } catch (parseError) {
        // If not JSON, treat as plain text transcription
        return {
          text: resultText.trim(),
          confidence: 0.8,
          language: options.language || "en",
          duration: 0,
        };
      }
    } catch (error) {
      console.error("OpenRouter STT failed:", error);
      throw error;
    }
  }

  // Fallback STT using Web Speech API
  async transcribeWithWebSpeechAPI(
    audioBlob: Blob,
    options: STTOptions = {},
  ): Promise<STTResult> {
    return new Promise((resolve, reject) => {
      if (
        !("webkitSpeechRecognition" in window) &&
        !("SpeechRecognition" in window)
      ) {
        reject(new Error("Web Speech API not supported"));
        return;
      }

      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = options.language || "en-US";

      recognition.onresult = (event: any) => {
        const result = event.results[0];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence || 0.8;

        resolve({
          text: transcript,
          confidence,
          language: options.language || "en",
          duration: 0,
        });
      };

      recognition.onerror = (event: any) => {
        reject(new Error(`Web Speech API error: ${event.error}`));
      };

      recognition.onend = () => {
        // Recognition ended
      };

      // Create audio URL from blob and play it to trigger recognition
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onplay = () => {
        recognition.start();
      };

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };

      audio.play().catch(reject);
    });
  }

  // Real-time streaming STT (for live microphone input)
  startRealtimeTranscription(
    onResult: (result: Partial<STTResult>) => void,
    onError: (error: Error) => void,
    options: STTOptions = {},
  ): () => void {
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      onError(new Error("Web Speech API not supported"));
      return () => {};
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = options.language || "en-US";

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const confidence = event.results[i][0].confidence || 0.8;

        if (event.results[i].isFinal) {
          finalTranscript += transcript;
          onResult({
            text: finalTranscript,
            confidence,
            language: options.language || "en",
          });
        } else {
          interimTranscript += transcript;
          onResult({
            text: interimTranscript,
            confidence: confidence * 0.5, // Lower confidence for interim results
            language: options.language || "en",
          });
        }
      }
    };

    recognition.onerror = (event: any) => {
      onError(new Error(`Real-time STT error: ${event.error}`));
    };

    recognition.onend = () => {
      // Auto-restart for continuous recognition
      if (recognition.continuous) {
        try {
          recognition.start();
        } catch (error) {
          // Recognition might already be running
        }
      }
    };

    recognition.start();

    // Return stop function
    return () => {
      recognition.continuous = false;
      recognition.stop();
    };
  }

  // Helper methods
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  async convertAudioFormat(
    audioBlob: Blob,
    targetFormat: "wav" | "mp3" | "flac" = "wav",
  ): Promise<Blob> {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // For WAV conversion
      if (targetFormat === "wav") {
        const length = audioBuffer.length;
        const sampleRate = audioBuffer.sampleRate;
        const channels = audioBuffer.numberOfChannels;

        const buffer = new ArrayBuffer(44 + length * channels * 2);
        const view = new DataView(buffer);

        // WAV header
        const writeString = (offset: number, string: string) => {
          for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
          }
        };

        writeString(0, "RIFF");
        view.setUint32(4, 36 + length * channels * 2, true);
        writeString(8, "WAVE");
        writeString(12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, channels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * channels * 2, true);
        view.setUint16(32, channels * 2, true);
        view.setUint16(34, 16, true);
        writeString(36, "data");
        view.setUint32(40, length * channels * 2, true);

        // Convert samples
        const offset = 44;
        for (let i = 0; i < length; i++) {
          for (let channel = 0; channel < channels; channel++) {
            const sample = Math.max(
              -1,
              Math.min(1, audioBuffer.getChannelData(channel)[i]),
            );
            view.setInt16(
              offset + (i * channels + channel) * 2,
              sample < 0 ? sample * 0x8000 : sample * 0x7fff,
              true,
            );
          }
        }

        await audioContext.close();
        return new Blob([buffer], { type: "audio/wav" });
      }

      await audioContext.close();
      return audioBlob; // Return original if conversion not implemented
    } catch (error) {
      console.error("Audio format conversion failed:", error);
      return audioBlob; // Return original on error
    }
  }

  // Language detection from audio
  async detectLanguageFromAudio(audioBlob: Blob): Promise<string> {
    try {
      // First, do a quick transcription with language detection
      const result = await this.transcribeAudio(audioBlob, {
        enablePunctuation: false,
      });

      // If we got a language from transcription, return it
      if (result.language && result.language !== "en") {
        return result.language;
      }

      // Otherwise, use text-based language detection on the transcribed text
      if (result.text) {
        return await OpenRouterService.detectLanguage(result.text);
      }

      return "en"; // Default fallback
    } catch (error) {
      console.error("Language detection from audio failed:", error);
      return "en"; // Default fallback
    }
  }

  // Batch transcription for multiple audio files
  async transcribeBatch(
    audioBlobs: Blob[],
    options: STTOptions = {},
  ): Promise<STTResult[]> {
    const results: STTResult[] = [];
    const maxConcurrent = 3; // Limit concurrent requests

    for (let i = 0; i < audioBlobs.length; i += maxConcurrent) {
      const batch = audioBlobs.slice(i, i + maxConcurrent);
      const batchPromises = batch.map((blob) =>
        this.transcribeAudio(blob, options),
      );

      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        console.error(
          `Batch transcription failed for batch starting at index ${i}:`,
          error,
        );
        // Add error placeholders to maintain array length
        for (let j = 0; j < batch.length; j++) {
          results.push({
            text: "",
            confidence: 0,
            language: options.language || "en",
            duration: 0,
          });
        }
      }
    }

    return results;
  }
}

export default new SpeechToTextService();
