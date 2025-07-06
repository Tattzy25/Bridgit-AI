import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  X,
  Settings,
  Volume2,
  Save,
  Copy,
  Plus,
  Users,
  UserPlus,
  LogOut,
  LogIn,
  Share,
  Wifi,
  WifiOff,
} from "lucide-react";

interface MainMenuProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode?: "just-me" | "talk-together";
}

type SessionType = "none" | "host" | "join" | "end";
type ConnectionStatus = "disconnected" | "connecting" | "connected";

export default function MainMenu({
  isOpen,
  onClose,
  currentMode = "just-me",
}: MainMenuProps) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [sessionType, setSessionType] = useState<SessionType>("none");
  const [hostCode, setHostCode] = useState("ABC123");
  const [joinCode, setJoinCode] = useState("");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const navigate = useNavigate();
  const location = useLocation();

  const handleModeChange = (newMode: "just-me" | "talk-together") => {
    navigate(`/${newMode}`);
    onClose();
  };

  const handleSignIn = () => {
    setIsSignedIn(true);
  };

  const handleSignUp = () => {
    setIsSignedIn(true);
  };

  const handleSignOut = () => {
    setIsSignedIn(false);
    setSessionType("none");
    setConnectionStatus("disconnected");
  };

  const handleSessionTypeChange = (type: SessionType) => {
    // Restrict remote features to Just Me mode only
    if (
      currentMode === "talk-together" &&
      (type === "host" || type === "join")
    ) {
      return; // Don't change session type for remote features in Talk Together mode
    }

    setSessionType(type);
    if (type === "host") {
      setConnectionStatus("connected");
      setHostCode(Math.random().toString(36).substring(2, 8).toUpperCase());
    } else if (type === "join") {
      setConnectionStatus("disconnected");
    } else if (type === "end") {
      setConnectionStatus("disconnected");
      setJoinCode("");
    }
  };

  const handleJoinAttempt = () => {
    if (joinCode.length === 6) {
      setConnectionStatus("connecting");
      // Simulate connection attempt
      setTimeout(() => {
        setConnectionStatus("connected");
      }, 2000);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(hostCode);
  };

  const handleShareCode = () => {
    navigator
      .share({
        title: "Join my Bridgit-AI session",
        text: `Join my real-time translation session with code: ${hostCode}`,
        url: window.location.origin,
      })
      .catch(() => {
        // Fallback if Web Share API is not supported
        handleCopyCode();
      });
  };

  const getConnectionStatusInfo = () => {
    switch (connectionStatus) {
      case "connecting":
        return { text: "Connecting...", color: "text-neon-orange" };
      case "connected":
        return { text: "Connected", color: "text-neon-green" };
      default:
        return { text: "Not Connected", color: "text-neon-red" };
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Menu */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md mx-4 z-50 animate-slide-up">
        <div className="glass rounded-2xl border border-glass-border backdrop-blur-xl p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-neon-cyan holographic">
              Bridgit-AI
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full glass border border-glass-border hover:border-neon-red/50 hover:text-neon-red transition-all duration-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Auth / Session Section */}
          {!isSignedIn ? (
            <div className="space-y-3 mb-6">
              <button
                onClick={handleSignIn}
                className="w-full cyber-button bg-gradient-to-r from-neon-cyan/20 to-neon-cyan/10 border-neon-cyan text-neon-cyan hover:shadow-neon-cyan hover:border-neon-cyan"
              >
                <LogIn className="w-5 h-5 mr-3" />
                Sign In
              </button>

              <button
                onClick={handleSignUp}
                className="w-full cyber-button bg-gradient-to-r from-neon-purple/20 to-neon-purple/10 border-neon-purple text-neon-purple hover:shadow-neon-purple hover:border-neon-purple"
              >
                <UserPlus className="w-5 h-5 mr-3" />
                Sign Up
              </button>
            </div>
          ) : (
            <>
              {/* Session Type Toggle */}
              <div className="mb-6">
                <label className="block text-xs font-medium text-muted-foreground mb-2">
                  Session Control
                </label>
                <div className="flex items-center glass rounded-full p-1 border border-glass-border">
                  <button
                    onClick={() => handleSessionTypeChange("host")}
                    className={`flex-1 px-3 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                      sessionType === "host"
                        ? "bg-neon-green/20 text-neon-green shadow-neon-green/30"
                        : "text-muted-foreground hover:text-foreground"
                    } ${currentMode === "talk-together" ? "opacity-50" : ""}`}
                  >
                    Host
                  </button>
                  <button
                    onClick={() => handleSessionTypeChange("join")}
                    className={`flex-1 px-3 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                      sessionType === "join"
                        ? "bg-neon-orange/20 text-neon-orange shadow-neon-orange/30"
                        : "text-muted-foreground hover:text-foreground"
                    } ${currentMode === "talk-together" ? "opacity-50" : ""}`}
                  >
                    Join
                  </button>
                  <button
                    onClick={() => handleSessionTypeChange("end")}
                    className={`flex-1 px-3 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                      sessionType === "end"
                        ? "bg-neon-red/20 text-neon-red shadow-neon-red/30"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    End
                  </button>
                </div>

                {/* Restriction message for Talk Together mode */}
                {currentMode === "talk-together" &&
                  (sessionType === "host" ||
                    sessionType === "join" ||
                    (sessionType === "none" &&
                      currentMode === "talk-together")) && (
                    <div className="mt-2 text-xs text-neon-orange bg-neon-orange/10 border border-neon-orange/20 rounded-lg p-2">
                      Remote connection is only available in Just Me Mode.
                    </div>
                  )}
              </div>

              {/* Session Content */}
              {sessionType === "host" && (
                <div className="mb-6">
                  <label className="block text-xs font-medium text-muted-foreground mb-2">
                    Host Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={hostCode}
                      readOnly
                      className="flex-1 px-3 py-2 glass rounded-lg border border-glass-border bg-card/30 text-foreground font-mono text-lg text-center"
                    />
                    <button
                      onClick={handleCopyCode}
                      className="px-3 py-2 glass rounded-lg border border-glass-border hover:border-neon-cyan/50 hover:text-neon-cyan transition-all duration-300"
                      title="Copy Code"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleShareCode}
                      className="px-3 py-2 glass rounded-lg border border-glass-border hover:border-neon-cyan/50 hover:text-neon-cyan transition-all duration-300"
                      title="Share Code"
                    >
                      <Share className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {sessionType === "join" && (
                <div className="mb-6">
                  <label className="block text-xs font-medium text-muted-foreground mb-2">
                    Connection Code
                  </label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => {
                      setJoinCode(e.target.value.toUpperCase());
                      if (e.target.value.length === 6) {
                        handleJoinAttempt();
                      }
                    }}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="w-full px-3 py-2 glass rounded-lg border border-glass-border bg-card/30 text-foreground font-mono text-lg text-center focus:outline-none focus:border-neon-cyan/50 focus:shadow-neon-cyan/20 transition-all duration-300"
                  />
                  <div
                    className={`mt-2 text-xs font-medium ${getConnectionStatusInfo().color} flex items-center gap-2`}
                  >
                    {connectionStatus === "connected" ? (
                      <Wifi className="w-3 h-3" />
                    ) : (
                      <WifiOff className="w-3 h-3" />
                    )}
                    {getConnectionStatusInfo().text}
                  </div>
                </div>
              )}

              {/* Sign Out Button */}
              <div className="mb-6">
                <button
                  onClick={handleSignOut}
                  className="w-full cyber-button bg-gradient-to-r from-muted/20 to-muted/10 border-muted-foreground text-muted-foreground hover:shadow-muted-foreground hover:border-muted-foreground"
                >
                  <LogOut className="w-5 h-5 mr-3" />
                  Sign Out
                </button>
              </div>
            </>
          )}

          {/* Mode Toggle */}
          <div className="mb-6">
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              Translation Mode
            </label>
            <div className="flex items-center glass rounded-full p-1 border border-glass-border">
              <button
                onClick={() => handleModeChange("just-me")}
                className={`flex-1 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  currentMode === "just-me"
                    ? "bg-neon-cyan/20 text-neon-cyan shadow-neon-cyan/30"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Just Me
              </button>
              <button
                onClick={() => handleModeChange("talk-together")}
                className={`flex-1 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  currentMode === "talk-together"
                    ? "bg-neon-cyan/20 text-neon-cyan shadow-neon-cyan/30"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Talk Together
              </button>
            </div>
          </div>

          {/* Feature Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button className="glass rounded-xl border border-glass-border hover:border-neon-blue/50 hover:shadow-neon-blue/30 p-4 flex flex-col items-center gap-2 group transition-all duration-300">
              <Volume2 className="w-6 h-6 text-neon-blue group-hover:scale-110 transition-transform duration-300" />
              <span className="text-xs font-medium text-neon-blue">
                Voice Library
              </span>
            </button>

            <button className="glass rounded-xl border border-glass-border hover:border-neon-pink/50 hover:shadow-neon-pink/30 p-4 flex flex-col items-center gap-2 group transition-all duration-300">
              <Copy className="w-6 h-6 text-neon-pink group-hover:scale-110 transition-transform duration-300" />
              <span className="text-xs font-medium text-neon-pink">
                Voice Cloning
              </span>
            </button>

            <button className="glass rounded-xl border border-glass-border hover:border-neon-green/50 hover:shadow-neon-green/30 p-4 flex flex-col items-center gap-2 group transition-all duration-300">
              <Save className="w-6 h-6 text-neon-green group-hover:scale-110 transition-transform duration-300" />
              <span className="text-xs font-medium text-neon-green">
                Saved Voices
              </span>
            </button>

            <button className="glass rounded-xl border border-glass-border hover:border-neon-purple/50 hover:shadow-neon-purple/30 p-4 flex flex-col items-center gap-2 group transition-all duration-300">
              <Settings className="w-6 h-6 text-neon-purple group-hover:rotate-90 transition-transform duration-300" />
              <span className="text-xs font-medium text-neon-purple">
                Settings
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
