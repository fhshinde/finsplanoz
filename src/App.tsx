import FinTaxFlow from './modules/finance/FinTaxFlow';

function TopBar() {
  const date = new Date().toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <header className="sticky top-0 z-40 glass-top border-b border-white/[0.04]">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-6 h-14 flex items-center gap-6">
        {/* Brand mark — Solstone */}
        <div className="flex items-center gap-2.5 shrink-0">
          <svg width="32" height="32" viewBox="0 0 32 32" className="shrink-0 drop-shadow-md">
            <defs>
              <linearGradient id="ssGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e8c79f" />
                <stop offset="48%" stopColor="#c4a875" />
                <stop offset="100%" stopColor="#9a7f4d" />
              </linearGradient>
              <linearGradient id="ssHighlight" x1="50%" y1="0%" x2="50%" y2="55%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>
            <rect x="0.5" y="0.5" width="31" height="31" rx="7" fill="url(#ssGold)" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
            <rect x="1" y="1" width="30" height="14" rx="6" fill="url(#ssHighlight)" />
            <path d="M 10 21 A 6 6 0 0 1 22 21" fill="none" stroke="#0b0d11" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="16" cy="21" r="1.6" fill="#0b0d11" />
            <line x1="5" y1="24" x2="27" y2="24" stroke="#0b0d11" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="16" y1="9" x2="16" y2="11.5" stroke="#0b0d11" strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
            <line x1="9" y1="14.5" x2="10.6" y2="16" stroke="#0b0d11" strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
            <line x1="23" y1="14.5" x2="21.4" y2="16" stroke="#0b0d11" strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
          </svg>
          <div className="hidden sm:block text-lg text-ink-50 leading-none uppercase" style={{ fontFamily: "'Marcellus', 'Trajan', serif", letterSpacing: '0.24em' }}>Solstone</div>
        </div>

        <div className="flex-1" />

        <div className="hidden md:flex items-center gap-3 text-2xs text-ink-400">
          <span className="num">{date} · {new Date().getFullYear()}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-gain pulse-soft" title="Live"/>
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col app-bg">
      <TopBar />
      <main className="flex-1 px-4 lg:px-6 py-4 pb-10 max-w-[1400px] w-full mx-auto">
        <div className="page">
          <FinTaxFlow />
        </div>
      </main>
    </div>
  );
}
