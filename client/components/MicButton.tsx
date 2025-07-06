import { Mic, MicOff } from "lucide-react";

interface MicButtonProps {
  isListening: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export default function MicButton({
  isListening,
  onToggle,
  disabled,
}: MicButtonProps) {
  return (
    <div className="flex justify-center">
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`
          relative w-24 h-24 rounded-full border-2 transition-all duration-300 group
          ${
            isListening
              ? "bg-neon-cyan/20 border-neon-cyan shadow-[0_0_25px_rgba(0,255,255,0.6)] animate-neon-pulse"
              : "bg-gradient-to-br from-card/60 to-card/40 border-neon-cyan/30 shadow-[0_0_15px_rgba(0,255,255,0.2)] hover:shadow-[0_0_30px_rgba(0,255,255,0.4)]"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:scale-105"}
          backdrop-blur-md shadow-inner
        `}
      >
        {/* Always-on ring glow */}
        <div
          className={`absolute inset-0 rounded-full border border-neon-cyan/40 ${!disabled && "group-hover:scale-105"} transition-transform duration-300`}
        />

        {/* Glass overlay for 3D effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 via-transparent to-black/10 pointer-events-none" />

        {/* 3D embossed background */}
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-neon-cyan/5 to-neon-blue/5 shadow-inner" />

        {isListening ? (
          <MicOff className="w-10 h-10 text-neon-cyan absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 drop-shadow-glow" />
        ) : (
          <Mic className="w-10 h-10 text-neon-cyan absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 drop-shadow-glow" />
        )}

        {/* Ripple effect on click */}
        <div className="absolute inset-0 rounded-full opacity-0 group-active:opacity-100 bg-neon-cyan/20 group-active:animate-ping pointer-events-none" />

        {isListening && (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-neon-cyan/50 animate-ping" />
            <div className="absolute inset-2 rounded-full border-2 border-neon-cyan/30 animate-ping animation-delay-75" />
          </>
        )}
      </button>
    </div>
  );
}
