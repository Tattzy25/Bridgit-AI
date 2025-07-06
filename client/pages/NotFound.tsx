import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center relative">
        <div className="glass rounded-2xl p-8 border border-glass-border backdrop-blur-xl max-w-md mx-auto">
          <h1 className="text-8xl font-bold holographic mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-neon-cyan mb-4">
            Page Not Found
          </h2>
          <p className="text-muted-foreground mb-8">
            The page you're looking for doesn't exist in this dimension.
          </p>
          <button onClick={() => navigate("/")} className="cyber-button w-full">
            Return to Reality
          </button>
        </div>

        {/* Floating error particles */}
        <div className="absolute top-1/4 left-1/4 w-2 h-2 rounded-full bg-neon-red/50 animate-float" />
        <div
          className="absolute top-1/3 right-1/3 w-1 h-1 rounded-full bg-neon-orange/60 animate-float"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute bottom-1/4 left-1/3 w-3 h-3 rounded-full bg-neon-purple/40 animate-float"
          style={{ animationDelay: "2s" }}
        />
      </div>
    </div>
  );
};

export default NotFound;
