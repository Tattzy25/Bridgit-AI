// Production-ready API exports for Bridgit-AI
export { default as BridgitAIOrchestrator } from "./services/orchestrator";
export type {
  OrchestratorConfig,
  SessionInfo,
  ConnectionStatus,
} from "./services/orchestrator";

export { default as TranslationFSM } from "./services/fsm";
export type { FSMState, FSMEvent, FSMContext } from "./services/fsm";

export { default as AblyService } from "./services/ably";
export type {
  SessionParticipant,
  TranslationMessage,
  SessionState,
  WebRTCSignal,
} from "./services/ably";

export { default as WebRTCService } from "./services/webrtc";
export type { AudioStreamConfig, PeerConnectionEvent } from "./services/webrtc";

export { default as AudioRecorderService } from "./services/recorder";
export type {
  RecorderConfig,
  AudioChunk,
  RecorderState,
} from "./services/recorder";

export { default as DeepLService } from "./services/deepl";
export { default as OpenRouterService } from "./services/openrouter";

export { default as NeonService } from "./services/neon";
export type {
  SessionRecord,
  ParticipantRecord,
  TranslationRecord,
  UserSettingsRecord,
  VoiceProfileRecord,
} from "./services/neon";

// Legacy exports for backward compatibility (will be removed)
export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  audioData?: Blob;
}

export interface TranslationResponse {
  translatedText: string;
  audioUrl?: string;
  confidence: number;
}

export interface VoiceRecognitionResult {
  text: string;
  confidence: number;
  isComplete: boolean;
}

export interface TTSRequest {
  text: string;
  language: string;
  voiceId?: string;
}

export type TranslationState =
  | "idle"
  | "listening"
  | "processing"
  | "translating"
  | "speaking"
  | "error";

// Production-ready factory function
export function createBridgitAI(config: {
  userId: string;
  username: string;
  sourceLanguage?: string;
  targetLanguage?: string;
}): BridgitAIOrchestrator {
  return new BridgitAIOrchestrator({
    userId: config.userId,
    username: config.username,
    defaultSourceLanguage: config.sourceLanguage || "en",
    defaultTargetLanguage: config.targetLanguage || "es",
  });
}

// Environment configuration validation
export function validateEnvironment(): {
  isValid: boolean;
  missing: string[];
  warnings: string[];
} {
  const required = [
    "VITE_ABLY_API_KEY",
    "VITE_DEEPL_API_KEY",
    "VITE_OPENROUTER_API_KEY",
    "VITE_NEON_DATABASE_URL",
  ];

  const optional = ["VITE_SENTRY_DSN", "VITE_ANALYTICS_ID"];

  const missing = required.filter((key) => !import.meta.env[key]);
  const warnings = optional.filter((key) => !import.meta.env[key]);

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  };
}

// Service health check
export async function checkServiceHealth(): Promise<{
  overall: "healthy" | "degraded" | "unhealthy";
  services: Record<string, boolean>;
  details: Record<string, string>;
}> {
  const results: Record<string, boolean> = {};
  const details: Record<string, string> = {};

  // Test Ably connection
  try {
    results.ably = AblyService.isConnected();
    details.ably = results.ably ? "Connected" : "Disconnected";
  } catch (error) {
    results.ably = false;
    details.ably = `Error: ${error.message}`;
  }

  // Test DeepL
  try {
    await DeepLService.getUsage();
    results.deepl = true;
    details.deepl = "API accessible";
  } catch (error) {
    results.deepl = false;
    details.deepl = `Error: ${error.message}`;
  }

  // Test OpenRouter
  try {
    await OpenRouterService.detectLanguage("test");
    results.openrouter = true;
    details.openrouter = "API accessible";
  } catch (error) {
    results.openrouter = false;
    details.openrouter = `Error: ${error.message}`;
  }

  // Test Neon Database
  try {
    await NeonService.getActiveSessionCount();
    results.database = true;
    details.database = "Connected";
  } catch (error) {
    results.database = false;
    details.database = `Error: ${error.message}`;
  }

  // Test WebRTC capability
  try {
    const devices = await WebRTCService.getAudioDevices();
    results.webrtc = devices.length > 0;
    details.webrtc = results.webrtc
      ? `${devices.length} audio devices`
      : "No audio devices";
  } catch (error) {
    results.webrtc = false;
    details.webrtc = `Error: ${error.message}`;
  }

  const healthyCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;

  let overall: "healthy" | "degraded" | "unhealthy";
  if (healthyCount === totalCount) {
    overall = "healthy";
  } else if (healthyCount >= totalCount * 0.6) {
    overall = "degraded";
  } else {
    overall = "unhealthy";
  }

  return { overall, services: results, details };
}

// Error reporting for production monitoring
export function reportError(error: Error, context?: Record<string, any>): void {
  console.error("Bridgit-AI Error:", error);

  // In production, integrate with Sentry or similar service
  if (import.meta.env.VITE_SENTRY_DSN) {
    // Sentry.captureException(error, { extra: context });
  }

  // Could also send to custom analytics endpoint
  if (import.meta.env.PROD) {
    fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      }),
    }).catch(console.error);
  }
}

// Performance monitoring
export function trackPerformance(
  operation: string,
  duration: number,
  metadata?: Record<string, any>,
): void {
  if (import.meta.env.PROD) {
    // Send to analytics service
    fetch("/api/analytics/performance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation,
        duration,
        metadata,
        timestamp: new Date().toISOString(),
      }),
    }).catch(console.error);
  }

  console.log(`Performance: ${operation} took ${duration}ms`, metadata);
}
