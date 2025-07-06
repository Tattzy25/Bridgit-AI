interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  samples: Array<{
    sample_id: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    hash: string;
  }>;
  category: string;
  fine_tuning: {
    is_allowed_to_fine_tune: boolean;
    finetuning_state: string;
    verification_attempts: any[];
    verification_failures: string[];
    verification_attempts_count: number;
    slice_ids: string[];
    manual_verification: any;
    manual_verification_requested: boolean;
  };
  labels: Record<string, string>;
  description: string;
  preview_url: string;
  available_for_tiers: string[];
  settings: {
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
  };
  sharing: {
    status: string;
    history_item_sample_id: string;
    original_voice_id: string;
    public_owner_id: string;
    liked_by_count: number;
    cloned_by_count: number;
    name: string;
    description: string;
    labels: Record<string, string>;
    created_at: string;
    notice_period: number;
  };
  high_quality_base_model_ids: string[];
  safety_control: string;
  voice_verification: {
    requires_verification: boolean;
    is_verified: boolean;
    verification_failures: string[];
    verification_attempts_count: number;
    language: string;
  };
  owner_id: string;
  permission_on_resource: string;
}

interface TTSRequest {
  text: string;
  voice_id: string;
  model_id?: string;
  voice_settings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
  pronunciation_dictionary_locators?: Array<{
    pronunciation_dictionary_id: string;
    version_id: string;
  }>;
}

interface VoiceCloneRequest {
  name: string;
  description?: string;
  files: File[];
  labels?: Record<string, string>;
}

export class ElevenLabsService {
  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`/api/elevenlabs${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }
    if (response.headers.get("content-type")?.includes("application/json")) {
      return response.json();
    }
    return response as any;
  }

  async textToSpeech(
    text: string,
    voiceId: string,
    options: {
      modelId?: string;
      stability?: number;
      similarityBoost?: number;
      style?: number;
      useSpeakerBoost?: boolean;
    } = {},
  ): Promise<ArrayBuffer> {
    const request: TTSRequest = {
      text,
      voice_id: voiceId,
      model_id: options.modelId || "eleven_multilingual_v2",
      voice_settings: {
        stability: options.stability ?? 0.5,
        similarity_boost: options.similarityBoost ?? 0.75,
        style: options.style ?? 0.0,
        use_speaker_boost: options.useSpeakerBoost ?? true,
      },
    };
    try {
      const response = await this.makeRequest<Response>(
        `/text-to-speech/${voiceId}`,
        {
          method: "POST",
          body: JSON.stringify(request),
        },
      );
      return await response.arrayBuffer();
    } catch (error) {
      console.error("TTS failed:", error);
      throw error;
    }
  }

  async streamTextToSpeech(
    text: string,
    voiceId: string,
    onChunk: (chunk: ArrayBuffer) => void,
    options: {
      modelId?: string;
      stability?: number;
      similarityBoost?: number;
      style?: number;
      useSpeakerBoost?: boolean;
    } = {},
  ): Promise<void> {
    const request: TTSRequest = {
      text,
      voice_id: voiceId,
      model_id: options.modelId || "eleven_multilingual_v2",
      voice_settings: {
        stability: options.stability ?? 0.5,
        similarity_boost: options.similarityBoost ?? 0.75,
        style: options.style ?? 0.0,
        use_speaker_boost: options.useSpeakerBoost ?? true,
      },
    };

    try {
      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${voiceId}/stream`,
        {
          method: "POST",
          headers: {
            "xi-api-key": this.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
        },
      );

      if (!response.ok) {
        throw new Error(`Streaming TTS failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body reader available");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        onChunk(value.buffer);
      }
    } catch (error) {
      console.error("Streaming TTS failed:", error);
      throw error;
    }
  }

  async getVoices(): Promise<ElevenLabsVoice[]> {
    try {
      const response = await this.makeRequest<{ voices: ElevenLabsVoice[] }>(
        "/voices",
      );
      return response.voices;
    } catch (error) {
      console.error("Failed to get voices:", error);
      throw error;
    }
  }

  async getVoice(voiceId: string): Promise<ElevenLabsVoice> {
    try {
      return await this.makeRequest<ElevenLabsVoice>(`/voices/${voiceId}`);
    } catch (error) {
      console.error("Failed to get voice:", error);
      throw error;
    }
  }

  async cloneVoice(
    name: string,
    audioFiles: File[],
    description?: string,
    labels?: Record<string, string>,
  ): Promise<ElevenLabsVoice> {
    try {
      const formData = new FormData();
      formData.append("name", name);

      if (description) {
        formData.append("description", description);
      }

      if (labels) {
        formData.append("labels", JSON.stringify(labels));
      }

      audioFiles.forEach((file) => {
        formData.append("files", file);
      });

      const response = await this.makeRequest<ElevenLabsVoice>("/voices/add", {
        method: "POST",
        body: formData,
      });

      return response;
    } catch (error) {
      console.error("Voice cloning failed:", error);
      throw error;
    }
  }

  async editVoiceSettings(
    voiceId: string,
    settings: {
      stability?: number;
      similarityBoost?: number;
      style?: number;
      useSpeakerBoost?: boolean;
    },
  ): Promise<void> {
    try {
      await this.makeRequest(`/voices/${voiceId}/settings/edit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stability: settings.stability,
          similarity_boost: settings.similarityBoost,
          style: settings.style,
          use_speaker_boost: settings.useSpeakerBoost,
        }),
      });
    } catch (error) {
      console.error("Failed to edit voice settings:", error);
      throw error;
    }
  }

  async deleteVoice(voiceId: string): Promise<void> {
    try {
      await this.makeRequest(`/voices/${voiceId}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("Failed to delete voice:", error);
      throw error;
    }
  }

  async getVoiceSettings(voiceId: string): Promise<{
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
  }> {
    try {
      return await this.makeRequest(`/voices/${voiceId}/settings`);
    } catch (error) {
      console.error("Failed to get voice settings:", error);
      throw error;
    }
  }

  async generateRandomVoice(
    gender: "male" | "female",
    accent?: string,
    age?: "young" | "middle_aged" | "old",
    accentStrength?: number,
  ): Promise<ArrayBuffer> {
    try {
      const response = await this.makeRequest<Response>("/voice-generation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gender,
          accent,
          age,
          accent_strength: accentStrength ?? 1.0,
        }),
      });

      return await response.arrayBuffer();
    } catch (error) {
      console.error("Voice generation failed:", error);
      throw error;
    }
  }

  async getUserSubscription(): Promise<{
    tier: string;
    character_count: number;
    character_limit: number;
    can_extend_character_limit: boolean;
    allowed_to_extend_character_limit: boolean;
    next_character_count_reset_unix: number;
    voice_limit: number;
    max_voice_add_edits: number;
    voice_add_edit_counter: number;
    professional_voice_limit: number;
    can_extend_voice_limit: boolean;
    can_use_instant_voice_cloning: boolean;
    can_use_professional_voice_cloning: boolean;
    currency: string;
    status: string;
  }> {
    try {
      return await this.makeRequest("/user/subscription");
    } catch (error) {
      console.error("Failed to get user subscription:", error);
      throw error;
    }
  }

  async getHistory(): Promise<
    Array<{
      history_item_id: string;
      request_id: string;
      voice_id: string;
      voice_name: string;
      text: string;
      date_unix: number;
      character_count_change_from: number;
      character_count_change_to: number;
      content_type: string;
      state: string;
      settings: {
        stability: number;
        similarity_boost: number;
        style: number;
        use_speaker_boost: boolean;
      };
      feedback: {
        thumbs_up: boolean;
        feedback: string;
        emotions: boolean;
        inaccurate_clone: boolean;
        glitches: boolean;
        audio_quality: boolean;
        other: boolean;
        review_status: string;
      };
    }>
  > {
    try {
      const response = await this.makeRequest<{
        history: Array<any>;
        last_history_item_id: string;
        has_more: boolean;
      }>("/history");
      return response.history;
    } catch (error) {
      console.error("Failed to get history:", error);
      throw error;
    }
  }

  async downloadHistoryItem(historyItemId: string): Promise<ArrayBuffer> {
    try {
      const response = await this.makeRequest<Response>(
        `/history/${historyItemId}/audio`,
      );
      return await response.arrayBuffer();
    } catch (error) {
      console.error("Failed to download history item:", error);
      throw error;
    }
  }

  // Helper method to play audio from ArrayBuffer
  playAudioBuffer(audioBuffer: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        reject(new Error("Failed to play audio"));
      };

      audio.play().catch(reject);
    });
  }

  // Helper method to stream and play audio in real-time
  async streamAndPlay(
    text: string,
    voiceId: string,
    options?: {
      modelId?: string;
      stability?: number;
      similarityBoost?: number;
      style?: number;
      useSpeakerBoost?: boolean;
    },
  ): Promise<void> {
    const audioChunks: ArrayBuffer[] = [];
    let audioContext: AudioContext | null = null;
    let source: AudioBufferSourceNode | null = null;

    try {
      audioContext = new AudioContext();

      await this.streamTextToSpeech(
        text,
        voiceId,
        async (chunk) => {
          audioChunks.push(chunk);

          // Concatenate all chunks and play
          const totalLength = audioChunks.reduce(
            (sum, chunk) => sum + chunk.byteLength,
            0,
          );
          const concatenated = new Uint8Array(totalLength);
          let offset = 0;

          for (const chunk of audioChunks) {
            concatenated.set(new Uint8Array(chunk), offset);
            offset += chunk.byteLength;
          }

          try {
            const audioBuffer = await audioContext!.decodeAudioData(
              concatenated.buffer,
            );
            source = audioContext!.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext!.destination);
            source.start();
          } catch (decodeError) {
            // Chunk might not be complete yet, continue collecting
          }
        },
        options,
      );
    } catch (error) {
      console.error("Stream and play failed:", error);
      throw error;
    } finally {
      if (audioContext) {
        audioContext.close();
      }
    }
  }
}

export default new ElevenLabsService();
