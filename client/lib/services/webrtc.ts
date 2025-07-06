import AblyService, { WebRTCSignal } from "./ably";

export interface AudioStreamConfig {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  sampleRate: number;
  channelCount: number;
}

export interface PeerConnectionEvent {
  type:
    | "connected"
    | "disconnected"
    | "error"
    | "stream-received"
    | "stream-lost";
  peerId: string;
  data?: any;
}

export class WebRTCService {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private eventCallbacks: Map<string, (event: PeerConnectionEvent) => void> =
    new Map();
  private isInitialized = false;

  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ],
  };

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Listen for WebRTC signals from Ably
    AblyService.onWebRTCSignal(this.handleSignal.bind(this));
    this.isInitialized = true;
  }

  async startAudioStream(
    config: Partial<AudioStreamConfig> = {},
  ): Promise<MediaStream> {
    const audioConfig: AudioStreamConfig = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000,
      channelCount: 1,
      ...config,
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: audioConfig.echoCancellation,
          noiseSuppression: audioConfig.noiseSuppression,
          autoGainControl: audioConfig.autoGainControl,
          sampleRate: audioConfig.sampleRate,
          channelCount: audioConfig.channelCount,
        },
        video: false,
      });

      return this.localStream;
    } catch (error) {
      console.error("Failed to get audio stream:", error);
      throw new Error("Microphone access denied");
    }
  }

  async createPeerConnection(
    peerId: string,
    isInitiator: boolean = false,
  ): Promise<void> {
    if (this.peerConnections.has(peerId)) {
      console.warn(`Peer connection for ${peerId} already exists`);
      return;
    }

    const peerConnection = new RTCPeerConnection(this.rtcConfig);
    this.peerConnections.set(peerId, peerConnection);

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, this.localStream!);
      });
    }

    // Handle incoming streams
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      this.emitEvent({
        type: "stream-received",
        peerId,
        data: { stream: remoteStream },
      });
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        AblyService.sendWebRTCSignal({
          type: "ice-candidate",
          senderId: AblyService.getCurrentUserId()!,
          targetId: peerId,
          data: event.candidate,
        });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;

      if (state === "connected") {
        this.emitEvent({ type: "connected", peerId });
      } else if (state === "disconnected" || state === "failed") {
        this.emitEvent({ type: "disconnected", peerId });
        this.closePeerConnection(peerId);
      }
    };

    // If this peer is the initiator, create and send offer
    if (isInitiator) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      await AblyService.sendWebRTCSignal({
        type: "offer",
        senderId: AblyService.getCurrentUserId()!,
        targetId: peerId,
        data: offer,
      });
    }
  }

  private async handleSignal(signal: WebRTCSignal): Promise<void> {
    const { senderId, type, data } = signal;
    let peerConnection = this.peerConnections.get(senderId);

    try {
      switch (type) {
        case "offer":
          if (!peerConnection) {
            await this.createPeerConnection(senderId, false);
            peerConnection = this.peerConnections.get(senderId)!;
          }

          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(data),
          );
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);

          await AblyService.sendWebRTCSignal({
            type: "answer",
            senderId: AblyService.getCurrentUserId()!,
            targetId: senderId,
            data: answer,
          });
          break;

        case "answer":
          if (peerConnection) {
            await peerConnection.setRemoteDescription(
              new RTCSessionDescription(data),
            );
          }
          break;

        case "ice-candidate":
          if (peerConnection) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data));
          }
          break;
      }
    } catch (error) {
      console.error(`Error handling WebRTC signal (${type}):`, error);
      this.emitEvent({
        type: "error",
        peerId: senderId,
        data: { error: error.message },
      });
    }
  }

  async connectToPeer(peerId: string): Promise<void> {
    await this.createPeerConnection(peerId, true);
  }

  closePeerConnection(peerId: string): void {
    const peerConnection = this.peerConnections.get(peerId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(peerId);
      this.emitEvent({ type: "disconnected", peerId });
    }
  }

  stopAudioStream(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.localStream = null;
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getPeerConnection(peerId: string): RTCPeerConnection | undefined {
    return this.peerConnections.get(peerId);
  }

  getAllPeerConnections(): Map<string, RTCPeerConnection> {
    return new Map(this.peerConnections);
  }

  onPeerEvent(
    peerId: string,
    callback: (event: PeerConnectionEvent) => void,
  ): () => void {
    this.eventCallbacks.set(peerId, callback);

    return () => {
      this.eventCallbacks.delete(peerId);
    };
  }

  private emitEvent(event: PeerConnectionEvent): void {
    const callback = this.eventCallbacks.get(event.peerId);
    if (callback) {
      callback(event);
    }

    // Also emit to global listeners if needed
    this.eventCallbacks.forEach((cb, peerId) => {
      if (peerId === "*") {
        // Global listener
        cb(event);
      }
    });
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

  async switchAudioDevice(deviceId: string): Promise<void> {
    if (this.localStream) {
      this.stopAudioStream();
    }

    await this.startAudioStream({
      // @ts-ignore - deviceId is valid for getUserMedia
      deviceId: { exact: deviceId },
    });

    // Update all peer connections with new stream
    for (const [peerId, peerConnection] of this.peerConnections) {
      if (this.localStream) {
        // Remove old tracks
        const senders = peerConnection.getSenders();
        senders.forEach((sender) => {
          if (sender.track) {
            peerConnection.removeTrack(sender);
          }
        });

        // Add new tracks
        this.localStream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, this.localStream!);
        });
      }
    }
  }

  getConnectionStats(peerId: string): Promise<RTCStatsReport | null> {
    const peerConnection = this.peerConnections.get(peerId);
    if (!peerConnection) return Promise.resolve(null);

    return peerConnection.getStats();
  }

  async enableEchoCancellation(enabled: boolean): Promise<void> {
    // This would require restarting the stream with new constraints
    if (this.localStream) {
      const track = this.localStream.getAudioTracks()[0];
      if (track) {
        await track.applyConstraints({
          echoCancellation: enabled,
        });
      }
    }
  }

  disconnect(): void {
    this.stopAudioStream();

    // Close all peer connections
    this.peerConnections.forEach((peerConnection, peerId) => {
      this.closePeerConnection(peerId);
    });

    this.eventCallbacks.clear();
  }
}

export default new WebRTCService();
