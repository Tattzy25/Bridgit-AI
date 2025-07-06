import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import TranslatorCard from "../components/TranslatorCard";
import MainMenu from "../components/MainMenu";
import GuestSignupModal from "../components/GuestSignupModal";

interface IndexProps {
  mode?: "just-me" | "talk-together";
}

export default function Index({ mode }: IndexProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isGuestSignupModalOpen, setIsGuestSignupModalOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Determine current mode from URL or props
  const currentMode =
    mode ||
    (location.pathname === "/talk-together" ? "talk-together" : "just-me");

  const handleModeChange = (newMode: "just-me" | "talk-together") => {
    navigate(`/${newMode}`);
  };

  const handleGuestSignup = () => {
    setIsGuestSignupModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Main Content */}
      <main
        className="container mx-auto px-4 py-8"
        style={{
          backgroundImage:
            "url(https://cdn.builder.io/api/v1/image/assets%2Ff211fb8c7c124ed3b265fee7bf5c0654%2Ff199f7218c25499ca1c541c14d3a8a41)",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="max-w-6xl mx-auto">
          {/* Title Section */}
          <div className="text-center mb-12">
            <h1
              className="text-4xl md:text-6xl font-bold holographic"
              style={{
                color: "rgba(8, 8, 8, 1)",
                textShadow: "5px 5px 5px rgba(255, 255, 255, 1)",
                border: "1px none rgba(23, 36, 36, 1)",
              }}
            >
              Bridgit-AI
            </h1>
          </div>

          {/* B Menu Icon - Positioned appropriately for each mode */}
          {currentMode === "just-me" ? (
            <div className="flex justify-center mb-8 relative">
              <button
                onClick={() => setIsMenuOpen(true)}
                className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl text-background shadow-[0_0_20px_rgba(0,255,255,0.4)] hover:shadow-[0_0_30px_rgba(0,255,255,0.6)] hover:scale-105 transition-all duration-300 group"
                style={{
                  backgroundImage:
                    "url(https://cdn.builder.io/api/v1/assets/f211fb8c7c124ed3b265fee7bf5c0654/bridgit-ai-logo-e267fd)",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                  lineHeight: "40px",
                }}
              >
                <br />
              </button>
            </div>
          ) : (
            <>
              {/* Desktop: B icon above the cards */}
              <div className="hidden md:flex justify-center mb-8">
                <button
                  onClick={() => setIsMenuOpen(true)}
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-neon-cyan to-neon-blue flex items-center justify-center font-bold text-2xl text-background shadow-[0_0_20px_rgba(0,255,255,0.4)] hover:shadow-[0_0_30px_rgba(0,255,255,0.6)] hover:scale-105 transition-all duration-300"
                >
                  B
                </button>
              </div>
            </>
          )}

          {/* Translator Cards */}
          {currentMode === "just-me" ? (
            <div className="flex justify-center">
              <div className="w-full max-w-md">
                <TranslatorCard />
              </div>
            </div>
          ) : (
            <>
              {/* Desktop: Side by side */}
              <div className="hidden md:grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                <TranslatorCard cardId="Main User" />
                <TranslatorCard cardId="Guest User" />
              </div>

              {/* Mobile: Stacked with guest card rotated */}
              <div className="md:hidden max-w-md mx-auto">
                {/* Guest Card - Rotated 180 degrees for across-table use */}
                <div className="transform rotate-180 mb-4">
                  <TranslatorCard
                    cardId="Guest User"
                    isGuestCard={true}
                    onGuestSignup={handleGuestSignup}
                  />
                </div>

                {/* B Menu Icon - Centered between cards on mobile */}
                <div className="flex justify-center py-4">
                  <button
                    onClick={() => setIsMenuOpen(true)}
                    className="w-12 h-12 rounded-full bg-gradient-to-br from-neon-cyan to-neon-blue flex items-center justify-center font-bold text-xl text-background shadow-[0_0_20px_rgba(0,255,255,0.4)] hover:shadow-[0_0_30px_rgba(0,255,255,0.6)] hover:scale-105 transition-all duration-300 relative z-10"
                  >
                    B
                  </button>
                </div>

                {/* Main User Card - Normal orientation */}
                <div className="mt-4">
                  <TranslatorCard cardId="Main User" />
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Main Menu */}
      <MainMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        currentMode={currentMode}
      />

      {/* Guest Signup Modal */}
      <GuestSignupModal
        isOpen={isGuestSignupModalOpen}
        onClose={() => setIsGuestSignupModalOpen(false)}
      />
    </div>
  );
}
