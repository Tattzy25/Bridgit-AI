import { Send, RotateCcw } from "lucide-react";

interface SendRedoControlsProps {
  originalText: string;
  translatedText: string;
  onSend: () => void;
  onRedo: () => void;
  isVisible: boolean;
}

export default function SendRedoControls({
  originalText,
  translatedText,
  onSend,
  onRedo,
  isVisible,
}: SendRedoControlsProps) {
  if (!isVisible) return null;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Translation Preview */}
      <div className="space-y-3">
        <div>
          <label
            className="block text-xs font-medium mb-2"
            style={{ color: "rgba(0, 0, 0, 1)" }}
          >
            Original
          </label>
          <div className="glass rounded-lg p-3 border border-glass-border bg-card/30 backdrop-blur-md">
            <p className="text-sm" style={{ color: "rgba(0, 0, 0, 1)" }}>
              {originalText}
            </p>
          </div>
        </div>

        <div>
          <label
            className="block text-xs font-medium mb-2"
            style={{ color: "rgba(0, 0, 0, 1)" }}
          >
            Translation Preview
          </label>
          <div className="glass rounded-lg p-3 border border-glass-border bg-neon-cyan/5">
            <p className="text-sm text-neon-cyan">{translatedText}</p>
          </div>
        </div>
      </div>

      {/* Send and Redo Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onSend}
          className="flex-1 cyber-button bg-gradient-to-r from-neon-green/30 to-neon-green/20 border-neon-green text-neon-green hover:shadow-neon-green hover:scale-105 transition-all duration-300"
        >
          <Send className="w-4 h-4 mr-2" />
          Send Translation
        </button>

        <button
          onClick={onRedo}
          className="flex-1 cyber-button bg-gradient-to-r from-neon-orange/30 to-neon-orange/20 border-neon-orange text-neon-orange hover:shadow-neon-orange hover:scale-105 transition-all duration-300"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Redo Recording
        </button>
      </div>

      {/* Privacy Notice */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground bg-muted/10 px-3 py-2 rounded-lg">
          🔒 Review before sending to ensure privacy and accuracy
        </p>
      </div>
    </div>
  );
}
