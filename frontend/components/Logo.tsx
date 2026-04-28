const shield = (
  <svg width="32" height="38" viewBox="0 0 72 98" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M36 4 L68 16 L68 52 C68 72 52 86 36 94 C20 86 4 72 4 52 L4 16 Z"
          fill="#1e1b4b" stroke="#6366f1" strokeWidth="1.5"/>
    <text x="36" y="58" fontFamily="sans-serif" fontSize="30" fontWeight="500"
          fill="#a5b4fc" textAnchor="middle">T</text>
    <circle cx="36" cy="70" r="4" fill="#6366f1"/>
  </svg>
);

export default function Logo() {
  return (
    <div className="flex items-center select-none" aria-label="TruthScan AI" role="img">
      {/* Mobile: tylko tarcza */}
      <span className="flex items-center md:hidden">
        {shield}
      </span>

      {/* Desktop: tarcza + tekst */}
      <span className="hidden md:flex items-center gap-2">
        {shield}
        <span
          className="font-bold text-lg"
          style={{
            background: "linear-gradient(to right, #6366f1, #a5b4fc)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          TruthScan AI
        </span>
      </span>
    </div>
  );
}
