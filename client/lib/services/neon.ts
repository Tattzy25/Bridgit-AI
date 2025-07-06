import { Pool } from "pg";

export interface SessionRecord {
  id: string;
  host_id: string;
  created_at: Date;
  ended_at?: Date;
  is_active: boolean;
  participant_count: number;
  total_translations: number;
  duration_seconds?: number;
}

export interface ParticipantRecord {
  id: string;
  session_id: string;
  user_id: string;
  username: string;
  is_host: boolean;
  joined_at: Date;
  left_at?: Date;
  status: "connected" | "disconnected";
}

export interface TranslationRecord {
  id: string;
  session_id: string;
  sender_id: string;
  original_text: string;
  translated_text: string;
  source_language: string;
  target_language: string;
  created_at: Date;
  confidence_score?: number;
  audio_url?: string;
  enhanced_by_ai: boolean;
}

export interface UserSettingsRecord {
  user_id: string;
  preferred_source_language: string;
  preferred_target_language: string;
  voice_settings: {
    volume: number;
    speed: number;
    voice_id?: string;
  };
  notification_settings: {
    translation_complete: boolean;
    session_joined: boolean;
    session_ended: boolean;
  };
  created_at: Date;
  updated_at: Date;
}

export interface VoiceProfileRecord {
  id: string;
  user_id: string;
  name: string;
  language: string;
  is_custom: boolean;
  audio_sample_url?: string;
  voice_parameters: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export class NeonDatabaseService {
  private pool: Pool;

  constructor() {
    const connectionString = import.meta.env.VITE_NEON_DATABASE_URL;
    if (!connectionString) {
      throw new Error("Neon database URL not configured");
    }

    this.pool = new Pool({
      connectionString,
      ssl: true,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.initializeTables();
  }

  private async initializeTables(): Promise<void> {
    const client = await this.pool.connect();

    try {
      // Sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id VARCHAR(255) PRIMARY KEY,
          host_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ended_at TIMESTAMP,
          is_active BOOLEAN DEFAULT true,
          participant_count INTEGER DEFAULT 1,
          total_translations INTEGER DEFAULT 0,
          duration_seconds INTEGER
        );
      `);

      // Participants table
      await client.query(`
        CREATE TABLE IF NOT EXISTS participants (
          id VARCHAR(255) PRIMARY KEY,
          session_id VARCHAR(255) NOT NULL REFERENCES sessions(id),
          user_id VARCHAR(255) NOT NULL,
          username VARCHAR(255) NOT NULL,
          is_host BOOLEAN DEFAULT false,
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          left_at TIMESTAMP,
          status VARCHAR(50) DEFAULT 'connected'
        );
      `);

      // Translations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS translations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id VARCHAR(255) NOT NULL REFERENCES sessions(id),
          sender_id VARCHAR(255) NOT NULL,
          original_text TEXT NOT NULL,
          translated_text TEXT NOT NULL,
          source_language VARCHAR(10) NOT NULL,
          target_language VARCHAR(10) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          confidence_score DECIMAL(3,2),
          audio_url TEXT,
          enhanced_by_ai BOOLEAN DEFAULT false
        );
      `);

      // User settings table
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_settings (
          user_id VARCHAR(255) PRIMARY KEY,
          preferred_source_language VARCHAR(10) DEFAULT 'en',
          preferred_target_language VARCHAR(10) DEFAULT 'es',
          voice_settings JSONB DEFAULT '{"volume": 80, "speed": 100}',
          notification_settings JSONB DEFAULT '{"translation_complete": true, "session_joined": true, "session_ended": true}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Voice profiles table
      await client.query(`
        CREATE TABLE IF NOT EXISTS voice_profiles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          language VARCHAR(10) NOT NULL,
          is_custom BOOLEAN DEFAULT false,
          audio_sample_url TEXT,
          voice_parameters JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create indexes for better performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_sessions_host_id ON sessions(host_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active);
        CREATE INDEX IF NOT EXISTS idx_participants_session_id ON participants(session_id);
        CREATE INDEX IF NOT EXISTS idx_participants_user_id ON participants(user_id);
        CREATE INDEX IF NOT EXISTS idx_translations_session_id ON translations(session_id);
        CREATE INDEX IF NOT EXISTS idx_translations_sender_id ON translations(sender_id);
        CREATE INDEX IF NOT EXISTS idx_voice_profiles_user_id ON voice_profiles(user_id);
      `);
    } catch (error) {
      console.error("Failed to initialize database tables:", error);
    } finally {
      client.release();
    }
  }

  // Session methods
  async createSession(hostId: string): Promise<SessionRecord> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `INSERT INTO sessions (id, host_id) VALUES ($1, $2) RETURNING *`,
        [sessionId, hostId],
      );

      return result.rows[0];
    } catch (error) {
      console.error("Failed to create session:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getSession(sessionId: string): Promise<SessionRecord | null> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `SELECT * FROM sessions WHERE id = $1`,
        [sessionId],
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error("Failed to get session:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async endSession(sessionId: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      // Get session duration
      const sessionResult = await client.query(
        `SELECT created_at FROM sessions WHERE id = $1`,
        [sessionId],
      );

      if (sessionResult.rows.length > 0) {
        const createdAt = sessionResult.rows[0].created_at;
        const durationSeconds = Math.floor(
          (Date.now() - createdAt.getTime()) / 1000,
        );

        // Update session
        await client.query(
          `UPDATE sessions SET ended_at = CURRENT_TIMESTAMP, is_active = false, duration_seconds = $1 WHERE id = $2`,
          [durationSeconds, sessionId],
        );

        // Update all participants
        await client.query(
          `UPDATE participants SET left_at = CURRENT_TIMESTAMP, status = 'disconnected' WHERE session_id = $1 AND left_at IS NULL`,
          [sessionId],
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Failed to end session:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Participant methods
  async addParticipant(
    sessionId: string,
    userId: string,
    username: string,
    isHost: boolean = false,
  ): Promise<ParticipantRecord> {
    const participantId = `participant_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      // Add participant
      const result = await client.query(
        `INSERT INTO participants (id, session_id, user_id, username, is_host) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [participantId, sessionId, userId, username, isHost],
      );

      // Update participant count
      await client.query(
        `UPDATE sessions SET participant_count = (SELECT COUNT(*) FROM participants WHERE session_id = $1 AND left_at IS NULL) WHERE id = $1`,
        [sessionId],
      );

      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Failed to add participant:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async removeParticipant(sessionId: string, userId: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      // Update participant
      await client.query(
        `UPDATE participants SET left_at = CURRENT_TIMESTAMP, status = 'disconnected' WHERE session_id = $1 AND user_id = $2`,
        [sessionId, userId],
      );

      // Update participant count
      await client.query(
        `UPDATE sessions SET participant_count = (SELECT COUNT(*) FROM participants WHERE session_id = $1 AND left_at IS NULL) WHERE id = $1`,
        [sessionId],
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Failed to remove participant:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getSessionParticipants(
    sessionId: string,
  ): Promise<ParticipantRecord[]> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `SELECT * FROM participants WHERE session_id = $1 ORDER BY joined_at`,
        [sessionId],
      );

      return result.rows;
    } catch (error) {
      console.error("Failed to get session participants:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Translation methods
  async saveTranslation(
    translation: Omit<TranslationRecord, "id" | "created_at">,
  ): Promise<TranslationRecord> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `INSERT INTO translations (session_id, sender_id, original_text, translated_text, source_language, target_language, confidence_score, audio_url, enhanced_by_ai) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          translation.session_id,
          translation.sender_id,
          translation.original_text,
          translation.translated_text,
          translation.source_language,
          translation.target_language,
          translation.confidence_score,
          translation.audio_url,
          translation.enhanced_by_ai,
        ],
      );

      // Update session translation count
      await client.query(
        `UPDATE sessions SET total_translations = total_translations + 1 WHERE id = $1`,
        [translation.session_id],
      );

      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Failed to save translation:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getSessionTranslations(
    sessionId: string,
    limit: number = 50,
  ): Promise<TranslationRecord[]> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `SELECT * FROM translations WHERE session_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [sessionId, limit],
      );

      return result.rows;
    } catch (error) {
      console.error("Failed to get session translations:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  // User settings methods
  async getUserSettings(userId: string): Promise<UserSettingsRecord | null> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `SELECT * FROM user_settings WHERE user_id = $1`,
        [userId],
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error("Failed to get user settings:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateUserSettings(
    userId: string,
    settings: Partial<Omit<UserSettingsRecord, "user_id" | "created_at">>,
  ): Promise<UserSettingsRecord> {
    const client = await this.pool.connect();

    try {
      const setClause = Object.keys(settings)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(", ");

      const values = [userId, ...Object.values(settings)];

      const result = await client.query(
        `INSERT INTO user_settings (user_id, ${Object.keys(settings).join(", ")}) 
         VALUES ($1, ${Object.keys(settings)
           .map((_, i) => `$${i + 2}`)
           .join(", ")})
         ON CONFLICT (user_id) DO UPDATE SET ${setClause}, updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        values,
      );

      return result.rows[0];
    } catch (error) {
      console.error("Failed to update user settings:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Voice profile methods
  async createVoiceProfile(
    profile: Omit<VoiceProfileRecord, "id" | "created_at" | "updated_at">,
  ): Promise<VoiceProfileRecord> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `INSERT INTO voice_profiles (user_id, name, language, is_custom, audio_sample_url, voice_parameters) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          profile.user_id,
          profile.name,
          profile.language,
          profile.is_custom,
          profile.audio_sample_url,
          JSON.stringify(profile.voice_parameters),
        ],
      );

      return result.rows[0];
    } catch (error) {
      console.error("Failed to create voice profile:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserVoiceProfiles(userId: string): Promise<VoiceProfileRecord[]> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `SELECT * FROM voice_profiles WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId],
      );

      return result.rows;
    } catch (error) {
      console.error("Failed to get user voice profiles:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getActiveSessionCount(): Promise<number> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `SELECT COUNT(*) as count FROM sessions WHERE is_active = true`,
      );

      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error("Failed to get active session count:", error);
      return 0;
    } finally {
      client.release();
    }
  }

  async getUserSessionHistory(
    userId: string,
    limit: number = 20,
  ): Promise<SessionRecord[]> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `SELECT s.* FROM sessions s
         JOIN participants p ON s.id = p.session_id
         WHERE p.user_id = $1
         ORDER BY s.created_at DESC
         LIMIT $2`,
        [userId, limit],
      );

      return result.rows;
    } catch (error) {
      console.error("Failed to get user session history:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async cleanup(): Promise<void> {
    // Clean up old inactive sessions (older than 24 hours)
    const client = await this.pool.connect();

    try {
      await client.query(
        `DELETE FROM sessions WHERE is_active = false AND ended_at < NOW() - INTERVAL '24 hours'`,
      );
    } catch (error) {
      console.error("Failed to cleanup old sessions:", error);
    } finally {
      client.release();
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }
}

export default new NeonDatabaseService();
