import { useState } from "react";
import { X, Mail, MessageSquare, Send } from "lucide-react";

interface GuestSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GuestSignupModal({
  isOpen,
  onClose,
}: GuestSignupModalProps) {
  const [shareMethod, setShareMethod] = useState<"email" | "text">("email");
  const [contactInfo, setContactInfo] = useState("");
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!contactInfo.trim()) return;

    setIsSending(true);

    // Simulate sending invitation
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Generate referral link with tracking
    const referralCode = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();
    const inviteLink = `${window.location.origin}/signup?ref=${referralCode}&discount=15`;

    console.log(
      `Sending ${shareMethod} to ${contactInfo} with link: ${inviteLink}`,
    );

    setIsSending(false);
    setContactInfo("");
    onClose();

    // Show success message (could be toast notification)
    alert(
      `Invitation sent via ${shareMethod}! You'll get 1 free month when they sign up.`,
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-sm mx-4 z-50 animate-slide-up">
        <div className="backdrop-blur-md bg-white/10 rounded-2xl border border-glass-border shadow-[0_0_30px_rgba(0,255,255,0.3)] p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-neon-cyan">
              Share Invitation
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full glass border border-glass-border hover:border-neon-red/50 hover:text-neon-red transition-all duration-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Share Method Toggle */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              How do you want to send the invite?
            </label>
            <div className="flex items-center glass rounded-full p-1 border border-glass-border">
              <button
                onClick={() => setShareMethod("email")}
                className={`flex-1 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                  shareMethod === "email"
                    ? "bg-neon-cyan/20 text-neon-cyan shadow-neon-cyan/30"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Mail className="w-4 h-4" />
                Email
              </button>
              <button
                onClick={() => setShareMethod("text")}
                className={`flex-1 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                  shareMethod === "text"
                    ? "bg-neon-cyan/20 text-neon-cyan shadow-neon-cyan/30"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Text
              </button>
            </div>
          </div>

          {/* Contact Input */}
          <div className="mb-6">
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              {shareMethod === "email" ? "Email Address" : "Phone Number"}
            </label>
            <input
              type={shareMethod === "email" ? "email" : "tel"}
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder={
                shareMethod === "email"
                  ? "guest@example.com"
                  : "+1 (555) 123-4567"
              }
              className="w-full px-4 py-3 glass rounded-lg border border-glass-border bg-card/30 text-foreground focus:outline-none focus:border-neon-cyan/50 focus:shadow-neon-cyan/20 transition-all duration-300"
            />
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!contactInfo.trim() || isSending}
            className={`w-full cyber-button ${
              isSending
                ? "bg-gradient-to-r from-neon-orange/20 to-neon-orange/10 border-neon-orange text-neon-orange"
                : "bg-gradient-to-r from-neon-green/20 to-neon-green/10 border-neon-green text-neon-green hover:shadow-neon-green"
            } ${!contactInfo.trim() ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isSending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-neon-orange border-t-transparent mr-2" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Invitation
              </>
            )}
          </button>

          {/* Reward Info */}
          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              🎁 You'll get{" "}
              <span className="text-neon-green font-medium">1 free month</span>{" "}
              when they sign up!
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
