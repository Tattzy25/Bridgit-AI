interface StateLabelProps {
  state: "idle" | "listening" | "processing" | "speaking" | "error";
  message?: string;
}

const stateConfig = {
  idle: {
    label: "Ready",
    color: "text-muted-foreground",
    glow: "",
  },
  listening: {
    label: "Listening...",
    color: "text-neon-cyan",
    glow: "shadow-neon-cyan",
  },
  processing: {
    label: "Processing...",
    color: "text-neon-purple",
    glow: "shadow-neon-purple",
  },
  speaking: {
    label: "Speaking...",
    color: "text-neon-green",
    glow: "shadow-neon-green",
  },
  error: {
    label: "Error",
    color: "text-neon-red",
    glow: "shadow-neon-red",
  },
};

export default function StateLabel({ state, message }: StateLabelProps) {
  const config = stateConfig[state];

  return (
    <div className="flex items-center justify-center gap-2 mb-4">
      <div
        className={`w-2 h-2 rounded-full ${config.color} ${config.glow} ${state !== "idle" ? "animate-neon-pulse" : ""}`}
      />
      <span
        className={`text-sm font-medium ${config.glow}`}
        style={{ color: "rgba(0, 0, 0, 1)" }}
      >
        {message || config.label}
      </span>
    </div>
  );
}
