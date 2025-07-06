import { useState, useRef } from "react";
import { ArrowLeftRight } from "lucide-react";
import LanguageSelector, { Language, languages } from "./LanguageSelector";
import MicButton from "./MicButton";
import StateLabel from "./StateLabel";
import SendRedoControls from "./SendRedoControls";
import SpeechToTextService from "../lib/services/stt";
import DeepLService from "../lib/services/deepl";

interface TranslatorCardProps {
  cardId?: string;
  className?: string;
  isGuestCard?: boolean;
  mode?: "just-me" | "talk-together";
  onGuestSignup?: () => void;
  onSendTranslation?: () => void;
  onRedoRecording?: () => void;
  pendingTranslation?: {
    originalText: string;
    translatedText: string;
  } | null;
  showSendControls?: boolean;
}

export default function TranslatorCard({
  cardId,
  className = "",
  isGuestCard = false,
  mode = "just-me",
  onGuestSignup,
  onSendTranslation,
  onRedoRecording,
  pendingTranslation,
  showSendControls = false,
}: TranslatorCardProps) {
  // Replace mock username with real auth context (placeholder for now)
  const username = ""; // TODO: Integrate with real auth context
  const [sourceLanguage, setSourceLanguage] = useState<Language>(languages[0]);
  const [targetLanguage, setTargetLanguage] = useState<Language>(languages[1]);
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [currentState, setCurrentState] = useState<
    "idle" | "listening" | "processing" | "speaking" | "error"
  >("idle");
  const [isSwapping, setIsSwapping] = useState(false);
  const stopRecordingRef = useRef<null | (() => void)>(null);

  const handleLanguageSwap = () => {
    setIsSwapping(true);
    const temp = sourceLanguage;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(temp);
    setTimeout(() => {
      setIsSwapping(false);
    }, 1000);
  };

  const handleMicToggle = async () => {
    if (isListening) {
      setIsListening(false);
      setCurrentState("processing");
      if (stopRecordingRef.current) {
        stopRecordingRef.current();
      }
    } else {
      setIsListening(true);
      setCurrentState("listening");
      setInputText("");
      setOutputText("");
      stopRecordingRef.current = await SpeechToTextService.recordAndTranscribe(
        async (result) => {
          setCurrentState("processing");
          setInputText(result.text || "");
          try {
            const translation = await DeepLService.translateText(
              result.text || "",
              targetLanguage.code,
              sourceLanguage.code
            );
            setOutputText(translation.text);
            setCurrentState("idle");
          } catch (err) {
            setCurrentState("error");
            setOutputText("Translation failed");
          }
        },
        (err) => {
          setCurrentState("error");
          setOutputText("Transcription failed");
        },
        { language: sourceLanguage.code }
      );
    }
  };

  return (
    <div
      className={`backdrop-blur-xl bg-white/5 rounded-2xl p-6 shadow-inner relative ${className}`}
      style={{
        backdropFilter: "blur(60px)",
        borderRadius: "25px",
        border: "1px none rgba(0, 0, 0, 1)",
      }}
    >
      {/* Username Badge - Enhanced */}
      <div className="text-center mb-6" style={{ color: "rgba(0, 0, 0, 1)" }}>
        <div
          className="inline-block px-4 py-2 bg-gradient-to-r from-neon-cyan/20 to-neon-blue/20 rounded-full text-sm font-semibold backdrop-blur-sm shadow-[0_0_10px_rgba(0,255,255,0.2)]"
          style={{
            color: "rgba(0, 0, 0, 1)",
            border: "1px solid rgba(0, 0, 0, 1)",
          }}
        >
          {isGuestCard ? `${username} Guest` : username}
        </div>

        {/* Status moved inside card, under username */}
        <div className="mt-3">
          <StateLabel state={currentState} />
        </div>
      </div>

      {/* Guest Signup CTA - appears at bottom edge for guest (top visually due to rotation) */}
      {isGuestCard && onGuestSignup && (
        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
          <button
            onClick={onGuestSignup}
            className="cyber-button bg-gradient-to-r from-neon-green/30 to-neon-cyan/30 border-neon-green text-neon-green hover:shadow-neon-green px-4 py-2 text-sm whitespace-nowrap"
          >
            Sign up now & get 15% off
          </button>
        </div>
      )}

      <div className="space-y-6">
        {/* Language Selection */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-end">
          <LanguageSelector
            selectedLanguage={sourceLanguage}
            onLanguageChange={setSourceLanguage}
            label="From"
          />

          <button
            onClick={handleLanguageSwap}
            className="w-10 h-10 flex items-center justify-center rounded-full glass shadow-[0_0_15px_rgba(0,255,255,0.3)] hover:shadow-[0_0_25px_rgba(0,255,255,0.6)] transition-all duration-300 group mb-2"
            style={{ border: "1px solid rgba(0, 0, 0, 1)" }}
          >
            <ArrowLeftRight
              className={`w-4 h-4 transition-transform duration-1000 ${
                isSwapping ? "rotate-180 scale-110" : "group-hover:rotate-180"
              }`}
              style={{ color: "rgba(0, 0, 0, 1)" }}
            />
          </button>

          <LanguageSelector
            selectedLanguage={targetLanguage}
            onLanguageChange={setTargetLanguage}
            label="To"
          />
        </div>

        {/* Input Field */}
        <div>
          <label
            className="block text-xs font-medium mb-2"
            style={{ color: "rgba(0, 0, 0, 1)" }}
          >
            Text Input (Optional)
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type here or use voice..."
            className="w-full glass rounded-lg border border-glass-border bg-card/30 backdrop-blur-md shadow-inner text-foreground placeholder-muted-foreground focus:outline-none focus:border-neon-cyan/50 focus:shadow-[0_0_15px_rgba(0,255,255,0.2)] hover:shadow-[0_0_8px_rgba(0,255,255,0.1)] transition-all duration-300 resize-none"
            style={{
              textShadow: "1px 1px 3px rgba(0, 0, 0, 1)",
              padding: "12px 16px 0",
            }}
            rows={3}
          />
        </div>

        {/* Microphone Button */}
        <MicButton
          isListening={isListening}
          onToggle={handleMicToggle}
          disabled={currentState === "processing"}
        />

        {/* Translation Result */}
        {outputText && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              Translation
            </label>
            <div className="glass rounded-lg p-4 border border-glass-border bg-neon-cyan/5">
              <p className="text-neon-cyan">{outputText}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
