export interface RecorderConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  bufferSize: number;
  format: "wav" | "webm" | "mp3";
  maxDuration: number; // in seconds
  silenceThreshold: number; // 0-100
  silenceDetectionTime: number; // in ms
}

export interface AudioChunk {
  data: ArrayBuffer;
  timestamp: number;
  duration: number;
  isFinal: boolean;
}

export interface RecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioLevel: number;
  silenceDetected: boolean;
}

export class AudioRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private recordedChunks: Blob[] = [];
  private startTime: number = 0;
  private animationId: number | null = null;

  private config: RecorderConfig = {
    sampleRate: 48000,
    channels: 1,
    bitDepth: 16,
    bufferSize: 4096,
    format: "webm",
    maxDuration: 300, // 5 minutes
    silenceThreshold: 5,
    silenceDetectionTime: 2000, // 2 seconds
  };

  private state: RecorderState = {
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioLevel: 0,
    silenceDetected: false,
  };

  private eventCallbacks: Map<string, (...args: any[]) => void> = new Map();

  constructor(config?: Partial<RecorderConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  async initialize(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.setupAudioContext();
      this.setupMediaRecorder();
    } catch (error) {
      console.error("Failed to initialize recorder:", error);
      throw new Error("Microphone access denied");
    }
  }

  private setupAudioContext(): void {
    if (!this.stream) return;

    this.audioContext = new AudioContext({
      sampleRate: this.config.sampleRate,
    });

    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.config.bufferSize;
    this.analyser.smoothingTimeConstant = 0.8;

    source.connect(this.analyser);
  }

  private setupMediaRecorder(): void {
    if (!this.stream) return;

    const mimeType = this.getMimeType();
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType,
      audioBitsPerSecond: 128000,
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
        this.emitEvent("data", {
          data: event.data,
          timestamp: Date.now(),
          duration: this.getDuration(),
          isFinal: this.mediaRecorder?.state === "inactive",
        });
      }
    };

    this.mediaRecorder.onstart = () => {
      this.state.isRecording = true;
      this.startTime = Date.now();
      this.startMonitoring();
      this.emitEvent("start");
    };

    this.mediaRecorder.onstop = () => {
      this.state.isRecording = false;
      this.stopMonitoring();
      this.emitEvent("stop", this.getRecording());
    };

    this.mediaRecorder.onpause = () => {
      this.state.isPaused = true;
      this.emitEvent("pause");
    };

    this.mediaRecorder.onresume = () => {
      this.state.isPaused = false;
      this.emitEvent("resume");
    };

    this.mediaRecorder.onerror = (event) => {
      console.error("MediaRecorder error:", event);
      this.emitEvent("error", event.error);
    };
  }

  private getMimeType(): string {
    const formats = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/wav",
    ];

    for (const format of formats) {
      if (MediaRecorder.isTypeSupported(format)) {
        return format;
      }
    }

    throw new Error("No supported audio format found");
  }

  async startRecording(): Promise<void> {
    if (!this.mediaRecorder) {
      await this.initialize();
    }

    if (this.mediaRecorder?.state === "recording") {
      console.warn("Recording already in progress");
      return;
    }

    this.recordedChunks = [];
    this.mediaRecorder?.start(100); // Collect data every 100ms
  }

  stopRecording(): Blob | null {
    if (this.mediaRecorder?.state === "recording") {
      this.mediaRecorder.stop();
      return this.getRecording();
    }
    return null;
  }

  pauseRecording(): void {
    if (this.mediaRecorder?.state === "recording") {
      this.mediaRecorder.pause();
    }
  }

  resumeRecording(): void {
    if (this.mediaRecorder?.state === "paused") {
      this.mediaRecorder.resume();
    }
  }

  private getRecording(): Blob {
    return new Blob(this.recordedChunks, {
      type: this.mediaRecorder?.mimeType || "audio/webm",
    });
  }

  private startMonitoring(): void {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let silenceStart = 0;

    const monitor = () => {
      if (!this.state.isRecording) return;

      this.analyser!.getByteFrequencyData(dataArray);

      // Calculate audio level (RMS)
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / bufferLength);
      this.state.audioLevel = (rms / 255) * 100;

      // Update duration
      this.state.duration = this.getDuration();

      // Detect silence
      const isSilent = this.state.audioLevel < this.config.silenceThreshold;
      const now = Date.now();

      if (isSilent) {
        if (silenceStart === 0) {
          silenceStart = now;
        } else if (now - silenceStart > this.config.silenceDetectionTime) {
          if (!this.state.silenceDetected) {
            this.state.silenceDetected = true;
            this.emitEvent("silence");
          }
        }
      } else {
        silenceStart = 0;
        if (this.state.silenceDetected) {
          this.state.silenceDetected = false;
          this.emitEvent("speech");
        }
      }

      // Auto-stop if max duration reached
      if (this.state.duration >= this.config.maxDuration * 1000) {
        this.stopRecording();
        this.emitEvent("maxDuration");
      }

      this.emitEvent("monitor", { ...this.state });
      this.animationId = requestAnimationFrame(monitor);
    };

    monitor();
  }

  private stopMonitoring(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private getDuration(): number {
    return this.startTime ? Date.now() - this.startTime : 0;
  }

  getState(): RecorderState {
    return { ...this.state };
  }

  async convertToWav(blob: Blob): Promise<Blob> {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const channels = audioBuffer.numberOfChannels;

    // Create WAV file
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

    return new Blob([buffer], { type: "audio/wav" });
  }

  on(event: string, callback: (...args: any[]) => void): () => void {
    this.eventCallbacks.set(event, callback);
    return () => this.eventCallbacks.delete(event);
  }

  private emitEvent(event: string, data?: any): void {
    const callback = this.eventCallbacks.get(event);
    if (callback) {
      callback(data);
    }
  }

  async getAudioDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((device) => device.kind === "audioinput");
    } catch (error) {
      console.error("Failed to get audio devices:", error);
      return [];
    }
  }

  async switchDevice(deviceId: string): Promise<void> {
    const wasRecording = this.state.isRecording;

    if (wasRecording) {
      this.stopRecording();
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }

    // Reinitialize with new device
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: deviceId },
        sampleRate: this.config.sampleRate,
        channelCount: this.config.channels,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.setupAudioContext();
    this.setupMediaRecorder();

    if (wasRecording) {
      await this.startRecording();
    }
  }

  destroy(): void {
    this.stopRecording();
    this.stopMonitoring();

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }

    if (this.audioContext) {
      this.audioContext.close();
    }

    this.eventCallbacks.clear();
  }
}

export default AudioRecorderService;
