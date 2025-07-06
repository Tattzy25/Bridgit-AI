import TranslationFSM, { FSMState } from "./fsm";
import AblyService from "./ably";
import WebRTCService from "./webrtc";
import AudioRecorderService from "./recorder";
import DeepLService from "./deepl";
import OpenRouterService from "./openrouter";
import NeonService from "./neon";

export interface OrchestratorConfig {
  userId: string;
  username: string;
  defaultSourceLanguage: string;
  defaultTargetLanguage: string;
}

export interface SessionInfo {
  id: string;
  isHost: boolean;
  participantCount: number;
  isActive: boolean;
  translations: number;
}

export interface ConnectionStatus {
  ably: boolean;
  webrtc: boolean;
  database: boolean;
  recorder: boolean;
}

export class BridgitAIOrchestrator {
  private fsm: TranslationFSM;
  private config: OrchestratorConfig;
  private isInitialized = false;

  constructor(config: OrchestratorConfig) {
    this.config = config;
    this.fsm = new TranslationFSM({
      userId: config.userId,
      username: config.username,
      isHost: false,
      sourceLanguage: config.defaultSourceLanguage,
      targetLanguage: config.defaultTargetLanguage,
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Test all service connections
      await this.validateServices();

      // Load user settings from database
      await this.loadUserSettings();

      this.isInitialized = true;
      console.log("Bridgit-AI Orchestrator initialized successfully");
    } catch (error) {
      console.error("Failed to initialize orchestrator:", error);
      throw error;
    }
  }

  private async validateServices(): Promise<void> {
    const validationPromises = [
      this.validateAbly(),
      this.validateWebRTC(),
      this.validateDatabase(),
      this.validateTranslationServices(),
    ];

    try {
      await Promise.all(validationPromises);
    } catch (error) {
      throw new Error(`Service validation failed: ${error.message}`);
    }
  }

  private async validateAbly(): Promise<void> {
    if (!AblyService.isConnected()) {
      throw new Error("Ably connection failed");
    }
  }

  private async validateWebRTC(): Promise<void> {
    try {
      // Test microphone access
      const devices = await WebRTCService.getAudioDevices();
      if (devices.length === 0) {
        throw new Error("No audio devices found");
      }
    } catch (error) {
      throw new Error(`WebRTC validation failed: ${error.message}`);
    }
  }

  private async validateDatabase(): Promise<void> {
    try {
      // Test database connection with a simple query
      await NeonService.getActiveSessionCount();
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  private async validateTranslationServices(): Promise<void> {
    try {
      // Test DeepL connection
      await DeepLService.getUsage();

      // Test OpenRouter with a simple detection
      await OpenRouterService.detectLanguage("Hello world");
    } catch (error) {
      console.warn("Translation services validation warning:", error);
      // Non-critical for initialization
    }
  }

  private async loadUserSettings(): Promise<void> {
    try {
      const settings = await NeonService.getUserSettings(this.config.userId);
      if (settings) {
        this.fsm.updateLanguages(
          settings.preferred_source_language,
          settings.preferred_target_language,
        );
      }
    } catch (error) {
      console.warn("Failed to load user settings:", error);
      // Use defaults
    }
  }

  // Session Management
  async startHostSession(): Promise<string> {
    if (!this.isInitialized) {
      throw new Error("Orchestrator not initialized");
    }

    await this.fsm.send("START_HOST");
    const sessionId = this.fsm.getCurrentSessionId();

    if (!sessionId) {
      throw new Error("Failed to create session");
    }

    return sessionId;
  }

  async joinSession(sessionId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Orchestrator not initialized");
    }

    await this.fsm.send("START_JOIN", { sessionId });
  }

  async endSession(): Promise<void> {
    await this.fsm.send("DISCONNECT");
  }

  // Translation Operations
  async startRecording(): Promise<void> {
    if (!this.fsm.canStartRecording()) {
      throw new Error("Cannot start recording in current state");
    }

    await this.fsm.send("START_RECORDING");
  }

  async stopRecording(): Promise<void> {
    if (!this.fsm.canStopRecording()) {
      throw new Error("Cannot stop recording in current state");
    }

    await this.fsm.send("STOP_RECORDING");
  }

  async translateText(
    text: string,
    targetLanguage?: string,
    sourceLanguage?: string,
  ): Promise<{
    translatedText: string;
    enhancedText: string;
    detectedLanguage: string;
  }> {
    const context = this.fsm.getContext();
    const srcLang = sourceLanguage || context.sourceLanguage;
    const tgtLang = targetLanguage || context.targetLanguage;

    try {
      // Translate with DeepL
      const translation = await DeepLService.translateText(
        text,
        tgtLang,
        srcLang,
      );

      // Enhance with OpenRouter AI
      const enhancedText = await OpenRouterService.enhanceTranslation(
        text,
        translation.text,
        srcLang,
        tgtLang,
      );

      return {
        translatedText: translation.text,
        enhancedText,
        detectedLanguage: translation.detectedSourceLanguage,
      };
    } catch (error) {
      console.error("Translation failed:", error);
      throw error;
    }
  }

  // Language Management
  async setLanguages(
    sourceLanguage: string,
    targetLanguage: string,
  ): Promise<void> {
    this.fsm.updateLanguages(sourceLanguage, targetLanguage);

    // Save to user settings
    try {
      await NeonService.updateUserSettings(this.config.userId, {
        preferred_source_language: sourceLanguage,
        preferred_target_language: targetLanguage,
      });
    } catch (error) {
      console.warn("Failed to save language preferences:", error);
    }
  }

  async getSupportedLanguages(): Promise<{
    source: Array<{ code: string; name: string }>;
    target: Array<{ code: string; name: string }>;
  }> {
    try {
      return await DeepLService.getSupportedLanguages();
    } catch (error) {
      console.error("Failed to get supported languages:", error);
      // Return default languages as fallback
      return {
        source: [
          { code: "EN", name: "English" },
          { code: "ES", name: "Spanish" },
          { code: "FR", name: "French" },
          { code: "DE", name: "German" },
        ],
        target: [
          { code: "EN", name: "English" },
          { code: "ES", name: "Spanish" },
          { code: "FR", name: "French" },
          { code: "DE", name: "German" },
        ],
      };
    }
  }

  async detectLanguage(text: string): Promise<string> {
    try {
      return await OpenRouterService.detectLanguage(text);
    } catch (error) {
      console.warn("Language detection failed:", error);
      return "en"; // Default fallback
    }
  }

  // Voice Management
  async getVoiceProfiles(): Promise<any[]> {
    try {
      return await NeonService.getUserVoiceProfiles(this.config.userId);
    } catch (error) {
      console.error("Failed to get voice profiles:", error);
      return [];
    }
  }

  async createVoiceProfile(
    name: string,
    language: string,
    audioSample: Blob,
  ): Promise<void> {
    try {
      // Convert audio sample to base64 for analysis
      const arrayBuffer = await audioSample.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      // Get AI analysis of voice characteristics
      const voiceParams =
        await OpenRouterService.generateVoiceCloneInstructions(base64);

      // Save to database
      await NeonService.createVoiceProfile({
        user_id: this.config.userId,
        name,
        language,
        is_custom: true,
        voice_parameters: JSON.parse(voiceParams || "{}"),
      });
    } catch (error) {
      console.error("Failed to create voice profile:", error);
      throw error;
    }
  }

  // Device Management
  async getAudioDevices(): Promise<MediaDeviceInfo[]> {
    return await WebRTCService.getAudioDevices();
  }

  async switchAudioDevice(deviceId: string): Promise<void> {
    await WebRTCService.switchAudioDevice(deviceId);
  }

  // Status and Monitoring
  getConnectionStatus(): ConnectionStatus {
    return {
      ably: AblyService.isConnected(),
      webrtc: WebRTCService.getLocalStream() !== null,
      database: true, // Assume connected if no errors
      recorder: true, // Assume available if no errors
    };
  }

  getCurrentState(): FSMState {
    return this.fsm.getState();
  }

  getCurrentSession(): SessionInfo | null {
    const context = this.fsm.getContext();
    if (!context.sessionId) return null;

    return {
      id: context.sessionId,
      isHost: context.isHost,
      participantCount: context.participants.length,
      isActive: this.fsm.isConnected(),
      translations: 0, // This would be tracked separately
    };
  }

  async getSessionHistory(limit: number = 20): Promise<any[]> {
    try {
      return await NeonService.getUserSessionHistory(this.config.userId, limit);
    } catch (error) {
      console.error("Failed to get session history:", error);
      return [];
    }
  }

  async getSessionTranslations(sessionId: string): Promise<any[]> {
    try {
      return await NeonService.getSessionTranslations(sessionId);
    } catch (error) {
      console.error("Failed to get session translations:", error);
      return [];
    }
  }

  // Event Handling
  onStateChange(callback: (state: FSMState, context: any) => void): () => void {
    return this.fsm.onStateChange(callback);
  }

  onTranslationReceived(callback: (translation: any) => void): () => void {
    return AblyService.onTranslationReceived(callback);
  }

  onConnectionChange(callback: (status: ConnectionStatus) => void): () => void {
    // Mock implementation - in production you'd listen to actual connection events
    const interval = setInterval(() => {
      callback(this.getConnectionStatus());
    }, 5000);

    return () => clearInterval(interval);
  }

  // Cleanup
  async destroy(): Promise<void> {
    try {
      await this.fsm.destroy();
      await AblyService.disconnect();
      WebRTCService.disconnect();
      await NeonService.disconnect();
      this.isInitialized = false;
    } catch (error) {
      console.error("Error during orchestrator cleanup:", error);
    }
  }

  // Error Recovery
  async recover(): Promise<void> {
    try {
      await this.fsm.send("RESET");
      console.log("FSM reset successfully");
    } catch (error) {
      console.error("Recovery failed:", error);
      throw error;
    }
  }

  // Health Check
  async healthCheck(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    services: Record<string, boolean>;
    errors: string[];
  }> {
    const services = this.getConnectionStatus();
    const errors: string[] = [];

    if (!services.ably) errors.push("Ably connection lost");
    if (!services.webrtc) errors.push("WebRTC not available");
    if (!services.database) errors.push("Database connection lost");
    if (!services.recorder) errors.push("Audio recorder not available");

    const healthyCount = Object.values(services).filter(Boolean).length;
    const totalCount = Object.keys(services).length;

    let status: "healthy" | "degraded" | "unhealthy";
    if (healthyCount === totalCount) {
      status = "healthy";
    } else if (healthyCount >= totalCount / 2) {
      status = "degraded";
    } else {
      status = "unhealthy";
    }

    return { status, services, errors };
  }
}

export default BridgitAIOrchestrator;
