import Ably from "ably";

export interface SessionParticipant {
  id: string;
  username: string;
  isHost: boolean;
  joinedAt: number;
  status: "connected" | "disconnected" | "speaking" | "listening";
}

export interface TranslationMessage {
  id: string;
  sessionId: string;
  senderId: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: number;
  audioUrl?: string;
}

export interface SessionState {
  id: string;
  hostId: string;
  participants: SessionParticipant[];
  isActive: boolean;
  createdAt: number;
  lastActivity: number;
}

export interface WebRTCSignal {
  type: "offer" | "answer" | "ice-candidate";
  senderId: string;
  targetId: string;
  data: any;
}

export class AblyService {
  private client: Ably.Realtime;
  private currentSessionId?: string;
  private currentUserId?: string;

  constructor() {
    const apiKey = import.meta.env.VITE_ABLY_API_KEY;
    if (!apiKey) {
      throw new Error("Ably API key not configured");
    }

    this.client = new Ably.Realtime({
      key: apiKey,
      clientId: this.generateClientId(),
    });

    this.currentUserId = this.client.options.clientId || undefined;
  }

  private generateClientId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  async createSession(): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.currentSessionId = sessionId;

    const sessionChannel = this.client.channels.get(`session:${sessionId}`);

    // Initialize session state
    const initialState: SessionState = {
      id: sessionId,
      hostId: this.currentUserId!,
      participants: [
        {
          id: this.currentUserId!,
          username: "@Host", // This should come from user context
          isHost: true,
          joinedAt: Date.now(),
          status: "connected",
        },
      ],
      isActive: true,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    await sessionChannel.publish("session:created", initialState);
    return sessionId;
  }

  async joinSession(sessionId: string, username: string): Promise<void> {
    this.currentSessionId = sessionId;
    const sessionChannel = this.client.channels.get(`session:${sessionId}`);

    const participant: SessionParticipant = {
      id: this.currentUserId!,
      username,
      isHost: false,
      joinedAt: Date.now(),
      status: "connected",
    };

    await sessionChannel.publish("participant:joined", participant);
  }

  async leaveSession(): Promise<void> {
    if (!this.currentSessionId || !this.currentUserId) return;

    const sessionChannel = this.client.channels.get(
      `session:${this.currentSessionId}`,
    );
    await sessionChannel.publish("participant:left", {
      participantId: this.currentUserId,
      timestamp: Date.now(),
    });

    await sessionChannel.detach();
    this.currentSessionId = undefined;
  }

  onSessionUpdate(callback: (state: SessionState) => void): () => void {
    if (!this.currentSessionId) return () => {};

    const sessionChannel = this.client.channels.get(
      `session:${this.currentSessionId}`,
    );

    const unsubscribeFunctions: Array<() => void> = [];

    // Subscribe to session events
    sessionChannel.subscribe("session:created", (message) => {
      callback(message.data as SessionState);
    });

    sessionChannel.subscribe("participant:joined", (message) => {
      // Handle participant joined - you'd update the session state
    });

    sessionChannel.subscribe("participant:left", (message) => {
      // Handle participant left
    });

    sessionChannel.subscribe("session:ended", (message) => {
      // Handle session ended
    });

    return () => {
      unsubscribeFunctions.forEach((fn) => fn());
      sessionChannel.unsubscribe();
    };
  }

  async sendTranslation(translation: TranslationMessage): Promise<void> {
    if (!this.currentSessionId) {
      throw new Error("No active session");
    }

    const translationChannel = this.client.channels.get(
      `translations:${this.currentSessionId}`,
    );
    await translationChannel.publish("translation:sent", translation);
  }

  onTranslationReceived(
    callback: (translation: TranslationMessage) => void,
  ): () => void {
    if (!this.currentSessionId) return () => {};

    const translationChannel = this.client.channels.get(
      `translations:${this.currentSessionId}`,
    );

    translationChannel.subscribe("translation:sent", (message) => {
      callback(message.data as TranslationMessage);
    });

    return () => {
      translationChannel.unsubscribe("translation:sent");
    };
  }

  // WebRTC signaling through Ably
  async sendWebRTCSignal(signal: WebRTCSignal): Promise<void> {
    if (!this.currentSessionId) {
      throw new Error("No active session");
    }

    const signalingChannel = this.client.channels.get(
      `webrtc:${this.currentSessionId}`,
    );
    await signalingChannel.publish("webrtc:signal", signal);
  }

  onWebRTCSignal(callback: (signal: WebRTCSignal) => void): () => void {
    if (!this.currentSessionId) return () => {};

    const signalingChannel = this.client.channels.get(
      `webrtc:${this.currentSessionId}`,
    );

    signalingChannel.subscribe("webrtc:signal", (message) => {
      const signal = message.data as WebRTCSignal;
      // Only process signals intended for this user
      if (signal.targetId === this.currentUserId) {
        callback(signal);
      }
    });

    return () => {
      signalingChannel.unsubscribe("webrtc:signal");
    };
  }

  async updateParticipantStatus(
    status: SessionParticipant["status"],
  ): Promise<void> {
    if (!this.currentSessionId || !this.currentUserId) return;

    const sessionChannel = this.client.channels.get(
      `session:${this.currentSessionId}`,
    );

    await sessionChannel.publish("participant:status", {
      participantId: this.currentUserId,
      status,
      timestamp: Date.now(),
    });
  }

  async endSession(): Promise<void> {
    if (!this.currentSessionId) return;

    const sessionChannel = this.client.channels.get(
      `session:${this.currentSessionId}`,
    );

    await sessionChannel.publish("session:ended", {
      endedBy: this.currentUserId,
      timestamp: Date.now(),
    });

    await this.leaveSession();
  }

  async getSessionHistory(sessionId: string): Promise<TranslationMessage[]> {
    try {
      const translationChannel = this.client.channels.get(
        `translations:${sessionId}`,
      );

      const history = await translationChannel.history({ limit: 100 });
      return history.items
        .map((item) => item.data as TranslationMessage)
        .reverse(); // Most recent first
    } catch (error) {
      console.error("Failed to get session history:", error);
      return [];
    }
  }

  isConnected(): boolean {
    return this.client.connection.state === "connected";
  }

  getCurrentSessionId(): string | undefined {
    return this.currentSessionId;
  }

  getCurrentUserId(): string | undefined {
    return this.currentUserId;
  }

  async disconnect(): Promise<void> {
    if (this.currentSessionId) {
      await this.leaveSession();
    }
    this.client.close();
  }
}

export default new AblyService();
