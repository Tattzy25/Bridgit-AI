import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface Language {
  code: string;
  name: string;
  flag: string;
}

const languages: Language[] = [
  { code: "EN", name: "English", flag: "🇺🇸" },
  { code: "ES", name: "Spanish", flag: "🇪🇸" },
  { code: "FR", name: "French", flag: "🇫🇷" },
  { code: "DE", name: "German", flag: "🇩🇪" },
  { code: "IT", name: "Italian", flag: "🇮🇹" },
  { code: "PT", name: "Portuguese", flag: "🇵🇹" },
  { code: "RU", name: "Russian", flag: "🇷🇺" },
  { code: "ZH", name: "Chinese", flag: "🇨��" },
  { code: "JA", name: "Japanese", flag: "🇯🇵" },
  { code: "KO", name: "Korean", flag: "🇰🇷" },
  { code: "AR", name: "Arabic", flag: "🇸🇦" },
  { code: "HI", name: "Hindi", flag: "🇮🇳" },
];

interface LanguageSelectorProps {
  selectedLanguage: Language;
  onLanguageChange: (language: Language) => void;
  label: string;
}

export default function LanguageSelector({
  selectedLanguage,
  onLanguageChange,
  label,
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <label
        className="block text-xs font-medium mb-2"
        style={{ color: "rgba(0, 0, 0, 1)" }}
      >
        {label}
      </label>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 w-full px-4 py-3 glass rounded-lg border border-glass-border shadow-inner hover:border-neon-cyan/50 hover:shadow-[0_0_15px_rgba(0,255,255,0.2)] focus:shadow-[0_0_15px_rgba(0,255,255,0.3)] transition-all duration-300 group"
      >
        <span className="text-xl" style={{ color: "rgba(0, 0, 0, 1)" }}>
          {selectedLanguage.flag}
        </span>
        <div className="flex-1 text-left">
          <div
            className="text-sm font-medium"
            style={{ color: "rgba(0, 0, 0, 1)" }}
          >
            {selectedLanguage.code}
          </div>
          <div className="text-xs" style={{ color: "rgba(0, 0, 0, 1)" }}>
            {selectedLanguage.name}
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-neon-cyan transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card/90 border border-glass-border rounded-lg backdrop-blur-xl shadow-[0_0_20px_rgba(0,0,0,0.5)] z-50 max-h-60 overflow-y-auto animate-slide-up custom-scrollbar">
          {languages.map((language) => (
            <button
              key={language.code}
              onClick={() => {
                onLanguageChange(language);
                setIsOpen(false);
              }}
              className="flex items-center gap-3 w-full px-4 py-3 hover:bg-neon-cyan/10 transition-colors duration-200 first:rounded-t-lg last:rounded-b-lg"
            >
              <span className="text-xl">{language.flag}</span>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-foreground">
                  {language.code}
                </div>
                <div className="text-xs text-muted-foreground">
                  {language.name}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}

export { languages };
export type { Language };
