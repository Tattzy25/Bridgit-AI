import AblyService, { SessionState, TranslationMessage } from "./ably";
import WebRTCService from "./webrtc";
import AudioRecorderService from "./recorder";
import DeepLService from "./deepl";
import OpenRouterService from "./openrouter";
import NeonService from "./neon";
import ElevenLabsService from "./elevenlabs";
import STTService from "./stt";

export type FSMState =
  | "idle"
  | "connecting"
  | "connected"
  | "hosting"
  | "joining"
  | "recording"
  | "processing"
  | "translating"
  | "awaiting_send"
  | "sending"
  | "speaking"
  | "error"
  | "disconnected";

export type FSMEvent =
  | "START_HOST"
  | "START_JOIN"
  | "JOIN_SUCCESS"
  | "CONNECTION_ESTABLISHED"
  | "START_RECORDING"
  | "STOP_RECORDING"
  | "AUDIO_READY"
  | "TRANSLATION_COMPLETE"
  | "SEND_TRANSLATION"
  | "SKIP_SEND"
  | "SPEECH_COMPLETE"
  | "ERROR"
  | "DISCONNECT"
  | "RESET";

export interface FSMContext {
  sessionId?: string;
  userId: string;
  username: string;
  isHost: boolean;
  mode: "just-me" | "talk-together";
  participants: string[];
  currentRecording?: Blob;
  lastTranslation?: TranslationMessage;
  pendingTranslation?: {
    originalText: string;
    translatedText: string;
    audioBuffer?: ArrayBuffer;
  };
  error?: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface FSMTransition {
  from: FSMState;
  event: FSMEvent;
  to: FSMState;
  action?: (context: FSMContext, data?: any) => Promise<void>;
  guard?: (context: FSMContext, data?: any) => boolean;
}

export class TranslationFSM {
  private currentState: FSMState = "idle";
  private context: FSMContext;
  private transitions: FSMTransition[] = [];
  private eventCallbacks: Map<
    string,
    (state: FSMState, context: FSMContext) => void
  > = new Map();
  private recorder: AudioRecorderService;

  constructor(initialContext: Omit<FSMContext, "participants">) {
    this.context = {
      ...initialContext,
      participants: [],
    };

    this.recorder = new AudioRecorderService();
    this.setupTransitions();
    this.setupEventHandlers();
  }

  private setupTransitions(): void {
    this.transitions = [
      // From idle
      {
        from: "idle",
        event: "START_HOST",
        to: "connecting",
        action: this.handleStartHost.bind(this),
      },
      {
        from: "idle",
        event: "START_JOIN",
        to: "connecting",
        action: this.handleStartJoin.bind(this),
      },

      // From connecting
      {
        from: "connecting",
        event: "CONNECTION_ESTABLISHED",
        to: "hosting",
        guard: (context) => context.isHost,
      },
      {
        from: "connecting",
        event: "JOIN_SUCCESS",
        to: "connected",
        guard: (context) => !context.isHost,
      },
      {
        from: "connecting",
        event: "ERROR",
        to: "error",
        action: this.handleError.bind(this),
      },

      // From hosting/connected
      {
        from: "hosting",
        event: "START_RECORDING",
        to: "recording",
        action: this.handleStartRecording.bind(this),
      },
      {
        from: "connected",
        event: "START_RECORDING",
        to: "recording",
        action: this.handleStartRecording.bind(this),
      },

      // From recording
      {
        from: "recording",
        event: "STOP_RECORDING",
        to: "processing",
        action: this.handleStopRecording.bind(this),
      },
      {
        from: "recording",
        event: "ERROR",
        to: "error",
        action: this.handleError.bind(this),
      },

      // From processing
      {
        from: "processing",
        event: "AUDIO_READY",
        to: "translating",
        action: this.handleAudioReady.bind(this),
      },
      {
        from: "processing",
        event: "ERROR",
        to: "error",
        action: this.handleError.bind(this),
      },

      // From translating
      {
        from: "translating",
        event: "TRANSLATION_COMPLETE",
        to: "awaiting_send",
        guard: (context) => context.mode === "just-me",
        action: this.handleTranslationComplete.bind(this),
      },
      {
        from: "translating",
        event: "TRANSLATION_COMPLETE",
        to: "speaking",
        guard: (context) => context.mode === "talk-together",
        action: this.handleTranslationCompleteAutoPlay.bind(this),
      },
      {
        from: "translating",
        event: "ERROR",
        to: "error",
        action: this.handleError.bind(this),
      },

      // From awaiting_send (Just Me mode only)
      {
        from: "awaiting_send",
        event: "SEND_TRANSLATION",
        to: "sending",
        action: this.handleSendTranslation.bind(this),
      },
      {
        from: "awaiting_send",
        event: "SKIP_SEND",
        to: this.context.isHost ? "hosting" : "connected",
        action: this.handleSkipSend.bind(this),
      },

      // From sending
      {
        from: "sending",
        event: "SPEECH_COMPLETE",
        to: this.context.isHost ? "hosting" : "connected",
      },
      {
        from: "sending",
        event: "ERROR",
        to: "error",
        action: this.handleError.bind(this),
      },

      // From speaking (Talk Together mode)
      {
        from: "speaking",
        event: "SPEECH_COMPLETE",
        to: this.context.isHost ? "hosting" : "connected",
      },
      {
        from: "speaking",
        event: "ERROR",
        to: "error",
        action: this.handleError.bind(this),
      },

      // From error
      {
        from: "error",
        event: "RESET",
        to: this.context.isHost ? "hosting" : "connected",
        action: this.handleReset.bind(this),
      },

      // From any state - disconnect
      {
        from: "hosting",
        event: "DISCONNECT",
        to: "disconnected",
        action: this.handleDisconnect.bind(this),
      },
      {
        from: "connected",
        event: "DISCONNECT",
        to: "disconnected",
        action: this.handleDisconnect.bind(this),
      },
      {
        from: "recording",
        event: "DISCONNECT",
        to: "disconnected",
        action: this.handleDisconnect.bind(this),
      },
      {
        from: "processing",
        event: "DISCONNECT",
        to: "disconnected",
        action: this.handleDisconnect.bind(this),
      },
      {
        from: "translating",
        event: "DISCONNECT",
        to: "disconnected",
        action: this.handleDisconnect.bind(this),
      },
      {
        from: "awaiting_send",
        event: "DISCONNECT",
        to: "disconnected",
        action: this.handleDisconnect.bind(this),
      },
      {
        from: "sending",
        event: "DISCONNECT",
        to: "disconnected",
        action: this.handleDisconnect.bind(this),
      },
      {
        from: "speaking",
        event: "DISCONNECT",
        to: "disconnected",
        action: this.handleDisconnect.bind(this),
      },

      // From disconnected
      {
        from: "disconnected",
        event: "RESET",
        to: "idle",
        action: this.handleReset.bind(this),
      },
    ];
  }

  private setupEventHandlers(): void {
    // Ably session events
    AblyService.onSessionUpdate((sessionState: SessionState) => {
      if (sessionState.isActive) {
        this.context.participants = sessionState.participants.map((p) => p.id);
        this.emitStateChange();
      }
    });

    // Ably translation events
    AblyService.onTranslationReceived((translation: TranslationMessage) => {
      if (translation.senderId !== this.context.userId) {
        this.context.lastTranslation = translation;
        this.playTranslationAudio(translation);
      }
    });

    // WebRTC events
    WebRTCService.onPeerEvent("*", (event) => {
      if (event.type === "connected") {
        this.send("CONNECTION_ESTABLISHED");
      } else if (event.type === "error") {
        this.send("ERROR", { error: event.data?.error });
      }
    });

    // Recorder events
    this.recorder.on("stop", (recording: Blob) => {
      this.context.currentRecording = recording;
      this.send("AUDIO_READY");
    });

    this.recorder.on("error", (error: any) => {
      this.send("ERROR", { error: error.message });
    });
  }

  async send(event: FSMEvent, data?: any): Promise<void> {
    const transition = this.transitions.find(
      (t) => t.from === this.currentState && t.event === event,
    );

    if (!transition) {
      console.warn(`No transition found for ${this.currentState} -> ${event}`);
      return;
    }

    // Check guard condition
    if (transition.guard && !transition.guard(this.context, data)) {
      console.warn(
        `Guard condition failed for ${this.currentState} -> ${event}`,
      );
      return;
    }

    const previousState = this.currentState;
    this.currentState = transition.to;

    console.log(`FSM: ${previousState} -> ${this.currentState} (${event})`);

    // Execute action
    if (transition.action) {
      try {
        await transition.action(this.context, data);
      } catch (error) {
        console.error(`Action failed for ${event}:`, error);
        this.currentState = "error";
        this.context.error = error.message;
      }
    }

    this.emitStateChange();
  }

  // Action handlers
  private async handleStartHost(): Promise<void> {
    try {
      this.context.isHost = true;
      this.context.sessionId = await AblyService.createSession();

      // Save session to database
      await NeonService.createSession(this.context.userId);
      await NeonService.addParticipant(
        this.context.sessionId,
        this.context.userId,
        this.context.username,
        true,
      );

      // Start WebRTC for audio streaming
      await WebRTCService.startAudioStream();

      this.send("CONNECTION_ESTABLISHED");
    } catch (error) {
      this.send("ERROR", { error: error.message });
    }
  }

  private async handleStartJoin(
    context: FSMContext,
    data: { sessionId: string },
  ): Promise<void> {
    try {
      this.context.isHost = false;
      this.context.sessionId = data.sessionId;

      await AblyService.joinSession(data.sessionId, this.context.username);

      // Add participant to database
      await NeonService.addParticipant(
        data.sessionId,
        this.context.userId,
        this.context.username,
        false,
      );

      // Start WebRTC for audio streaming
      await WebRTCService.startAudioStream();

      this.send("JOIN_SUCCESS");
    } catch (error) {
      this.send("ERROR", { error: error.message });
    }
  }

  private async handleStartRecording(): Promise<void> {
    try {
      await this.recorder.initialize();
      await this.recorder.startRecording();

      // Update participant status
      await AblyService.updateParticipantStatus("speaking");
    } catch (error) {
      this.send("ERROR", { error: error.message });
    }
  }

  private async handleStopRecording(): Promise<void> {
    try {
      const recording = this.recorder.stopRecording();
      if (recording) {
        this.context.currentRecording = recording;
      }

      // Update participant status
      await AblyService.updateParticipantStatus("connected");

      this.send("AUDIO_READY");
    } catch (error) {
      this.send("ERROR", { error: error.message });
    }
  }

  private async handleAudioReady(): Promise<void> {
    if (!this.context.currentRecording) {
      this.send("ERROR", { error: "No recording available" });
      return;
    }

    try {
      // Convert speech to text using STT service
      const sttResult = await STTService.transcribeAudio(
        this.context.currentRecording,
        {
          language: this.context.sourceLanguage,
          enablePunctuation: true,
        },
      );

      if (!sttResult.text.trim()) {
        this.send("ERROR", { error: "No speech detected in recording" });
        return;
      }

      // Store the transcribed text for translation
      this.context.pendingTranslation = {
        originalText: sttResult.text,
        translatedText: "",
      };

      this.send("TRANSLATION_COMPLETE");
    } catch (error) {
      this.send("ERROR", { error: `STT failed: ${error.message}` });
    }
  }

  private async handleTranslationComplete(): Promise<void> {
    try {
      if (!this.context.pendingTranslation?.originalText) {
        throw new Error("No text to translate");
      }

      const originalText = this.context.pendingTranslation.originalText;

      // Translate with DeepL
      const translation = await DeepLService.translateText(
        originalText,
        this.context.targetLanguage,
        this.context.sourceLanguage,
      );

      // Enhance with OpenRouter AI
      const enhancedTranslation = await OpenRouterService.enhanceTranslation(
        originalText,
        translation.text,
        this.context.sourceLanguage,
        this.context.targetLanguage,
      );

      // Generate TTS audio for the translation
      const defaultVoiceId = "21m00Tcm4TlvDq8ikWAM"; // ElevenLabs default voice
      const audioBuffer = await ElevenLabsService.textToSpeech(
        enhancedTranslation,
        defaultVoiceId,
        {
          stability: 0.5,
          similarityBoost: 0.75,
        },
      );

      // Store the complete translation with audio
      this.context.pendingTranslation = {
        originalText,
        translatedText: enhancedTranslation,
        audioBuffer,
      };

      // For Just Me mode, wait for user confirmation to send
      // The state will transition to "awaiting_send"
    } catch (error) {
      this.send("ERROR", { error: error.message });
    }
  }

  private async handleTranslationCompleteAutoPlay(): Promise<void> {
    try {
      if (!this.context.pendingTranslation?.originalText) {
        throw new Error("No text to translate");
      }

      const originalText = this.context.pendingTranslation.originalText;

      // Translate with DeepL
      const translation = await DeepLService.translateText(
        originalText,
        this.context.targetLanguage,
        this.context.sourceLanguage,
      );

      // Enhance with OpenRouter AI
      const enhancedTranslation = await OpenRouterService.enhanceTranslation(
        originalText,
        translation.text,
        this.context.sourceLanguage,
        this.context.targetLanguage,
      );

      // For Talk Together mode, immediately play the translation
      const defaultVoiceId = "21m00Tcm4TlvDq8ikWAM"; // ElevenLabs default voice

      // Play audio immediately without storing
      await ElevenLabsService.streamAndPlay(
        enhancedTranslation,
        defaultVoiceId,
        {
          stability: 0.5,
          similarityBoost: 0.75,
        },
      );

      // Create translation message for session history
      const translationMessage: TranslationMessage = {
        id: `trans_${Date.now()}`,
        sessionId: this.context.sessionId!,
        senderId: this.context.userId,
        originalText,
        translatedText: enhancedTranslation,
        sourceLanguage: this.context.sourceLanguage,
        targetLanguage: this.context.targetLanguage,
        timestamp: Date.now(),
      };

      // Save to database
      if (this.context.sessionId) {
        await NeonService.saveTranslation({
          session_id: this.context.sessionId,
          sender_id: this.context.userId,
          original_text: originalText,
          translated_text: enhancedTranslation,
          source_language: this.context.sourceLanguage,
          target_language: this.context.targetLanguage,
          enhanced_by_ai: true,
        });
      }

      this.context.lastTranslation = translationMessage;
      this.send("SPEECH_COMPLETE");
    } catch (error) {
      this.send("ERROR", { error: error.message });
    }
  }

  private async handleSendTranslation(): Promise<void> {
    try {
      if (!this.context.pendingTranslation) {
        throw new Error("No pending translation to send");
      }

      const { originalText, translatedText, audioBuffer } =
        this.context.pendingTranslation;

      // Create translation message
      const translationMessage: TranslationMessage = {
        id: `trans_${Date.now()}`,
        sessionId: this.context.sessionId!,
        senderId: this.context.userId,
        originalText,
        translatedText,
        sourceLanguage: this.context.sourceLanguage,
        targetLanguage: this.context.targetLanguage,
        timestamp: Date.now(),
      };

      // Send via Ably to remote participants
      if (this.context.sessionId) {
        await AblyService.sendTranslation(translationMessage);

        // Save to database
        await NeonService.saveTranslation({
          session_id: this.context.sessionId,
          sender_id: this.context.userId,
          original_text: originalText,
          translated_text: translatedText,
          source_language: this.context.sourceLanguage,
          target_language: this.context.targetLanguage,
          enhanced_by_ai: true,
        });
      }

      // Play the audio locally for confirmation
      if (audioBuffer) {
        await ElevenLabsService.playAudioBuffer(audioBuffer);
      }

      this.context.lastTranslation = translationMessage;
      this.context.pendingTranslation = undefined;

      this.send("SPEECH_COMPLETE");
    } catch (error) {
      this.send("ERROR", { error: error.message });
    }
  }

  private async handleSkipSend(): Promise<void> {
    // Clear pending translation without sending
    this.context.pendingTranslation = undefined;
  }

  private async playTranslationAudio(
    translation: TranslationMessage,
  ): Promise<void> {
    try {
      const defaultVoiceId = "21m00Tcm4TlvDq8ikWAM"; // ElevenLabs default voice

      // Stream and play the translation audio
      await ElevenLabsService.streamAndPlay(
        translation.translatedText,
        defaultVoiceId,
        {
          stability: 0.5,
          similarityBoost: 0.75,
        },
      );
    } catch (error) {
      console.error("Failed to play translation audio:", error);
      throw error;
    }
  }

  private async handleError(
    context: FSMContext,
    data: { error: string },
  ): Promise<void> {
    this.context.error = data.error;
    console.error("FSM Error:", data.error);

    // Cleanup any ongoing operations
    if (this.recorder.getState().isRecording) {
      this.recorder.stopRecording();
    }
  }

  private async handleDisconnect(): Promise<void> {
    try {
      // Cleanup recorder
      if (this.recorder.getState().isRecording) {
        this.recorder.stopRecording();
      }
      this.recorder.destroy();

      // Cleanup WebRTC
      WebRTCService.disconnect();

      // Leave Ably session
      await AblyService.leaveSession();

      // Update database
      if (this.context.sessionId) {
        await NeonService.removeParticipant(
          this.context.sessionId,
          this.context.userId,
        );

        if (this.context.isHost) {
          await NeonService.endSession(this.context.sessionId);
        }
      }

      // Reset context
      this.context = {
        ...this.context,
        sessionId: undefined,
        participants: [],
        currentRecording: undefined,
        lastTranslation: undefined,
        pendingTranslation: undefined,
        error: undefined,
      };
    } catch (error) {
      console.error("Disconnect error:", error);
    }
  }

  private async handleReset(): Promise<void> {
    this.context.error = undefined;
    this.context.currentRecording = undefined;
  }

  // Public methods
  getState(): FSMState {
    return this.currentState;
  }

  getContext(): Readonly<FSMContext> {
    return { ...this.context };
  }

  onStateChange(
    callback: (state: FSMState, context: FSMContext) => void,
  ): () => void {
    const id = Math.random().toString(36);
    this.eventCallbacks.set(id, callback);

    return () => {
      this.eventCallbacks.delete(id);
    };
  }

  private emitStateChange(): void {
    this.eventCallbacks.forEach((callback) => {
      callback(this.currentState, { ...this.context });
    });
  }

  updateLanguages(sourceLanguage: string, targetLanguage: string): void {
    this.context.sourceLanguage = sourceLanguage;
    this.context.targetLanguage = targetLanguage;
  }

  updateMode(mode: "just-me" | "talk-together"): void {
    this.context.mode = mode;
  }

  getCurrentSessionId(): string | undefined {
    return this.context.sessionId;
  }

  isConnected(): boolean {
    return [
      "hosting",
      "connected",
      "recording",
      "processing",
      "translating",
      "speaking",
    ].includes(this.currentState);
  }

  canStartRecording(): boolean {
    return ["hosting", "connected"].includes(this.currentState);
  }

  canStopRecording(): boolean {
    return this.currentState === "recording";
  }

  canSendTranslation(): boolean {
    return this.currentState === "awaiting_send";
  }

  isAwaitingSend(): boolean {
    return this.currentState === "awaiting_send";
  }

  getPendingTranslation(): {
    originalText: string;
    translatedText: string;
  } | null {
    if (!this.context.pendingTranslation) return null;

    return {
      originalText: this.context.pendingTranslation.originalText,
      translatedText: this.context.pendingTranslation.translatedText,
    };
  }

  async destroy(): Promise<void> {
    await this.send("DISCONNECT");
    this.eventCallbacks.clear();
  }
}

export default TranslationFSM;
