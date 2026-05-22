import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import * as RSlider from '@radix-ui/react-slider';

export const cn = (...args: any[]) => clsx(...args);

/* ───────── Surface — premium card with subtle glow ───────── */
export function Surface({ children, className, tone = 'default' }: { children: ReactNode; className?: string; tone?: 'default' | 'hero' | 'glass' }) {
  const tones = {
    default: 'card-premium',
    hero: 'card-hero',
    glass: 'bg-ink-900/60 backdrop-blur-xl border border-white/[0.06]',
  };
  return <div className={cn('rounded-2xl', tones[tone], className)}>{children}</div>;
}

/* ───────── Section title ───────── */
export function SectionTitle({ eyebrow, title, sub, right }: { eyebrow?: string; title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-3 gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="text-2xs uppercase tracking-[0.16em] text-ink-400 mb-1 font-semibold">{eyebrow}</div>}
        <h2 className="text-base text-ink-50 font-semibold">{title}</h2>
        {sub && <p className="text-xs text-ink-400 mt-0.5">{sub}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

/* ───────── KPI card — premium ───────── */
export function KPI({ label, value, sub, delta, deltaTone, accent, tone }: {
  label: string; value: string; sub?: string;
  delta?: string; deltaTone?: 'gain' | 'loss' | 'neutral';
  accent?: boolean;
  tone?: 'gain' | 'loss' | 'info';
}) {
  const deltaColor = deltaTone === 'gain' ? 'text-gain' : deltaTone === 'loss' ? 'text-ink-100' : 'text-ink-400';
  const arrow = deltaTone === 'gain' ? '↑' : deltaTone === 'loss' ? '↓' : '·';
  const valueColor = accent ? 'text-gradient-warm' : tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-ink-100' : tone === 'info' ? 'text-info' : 'text-ink-50';
  return (
    <div className={cn(
      'group relative px-3.5 py-2.5 rounded-lg transition-all duration-200',
      accent ? 'card-hero' : 'card-premium',
    )}>
      <div className="flex items-baseline justify-between mb-0.5">
        <span className="text-[10px] uppercase tracking-[0.14em] text-ink-400 font-semibold">{label}</span>
        {delta && (
          <span className={cn('text-[10px] num font-semibold flex items-center gap-0.5', deltaColor)}>
            <span className="text-[9px]">{arrow}</span>{delta}
          </span>
        )}
      </div>
      <div className={cn('num-hero text-xl lg:text-2xl', valueColor)}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-ink-400 mt-0.5 num">{sub}</div>}
    </div>
  );
}

/* ───────── Stat row ───────── */
export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'gain' | 'loss' | 'brand' | 'info' | 'warn' }) {
  const tones = { gain: 'text-gain', loss: 'text-ink-100', brand: 'text-brand', info: 'text-info', warn: 'text-warn' };
  return (
    <div className="flex items-baseline justify-between py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-sm text-ink-300">{label}</span>
      <span className="text-right">
        <span className={cn('num text-sm font-medium', tone ? tones[tone] : 'text-ink-50')}>{value}</span>
        {sub && <span className="block text-2xs text-ink-400 num mt-0.5">{sub}</span>}
      </span>
    </div>
  );
}

/* ───────── Bar ───────── */
export function Bar({ pct, color = '#c4a875', height = 6, label, sub }: { pct: number; color?: string; height?: number; label?: string; sub?: string }) {
  return (
    <div>
      {(label || sub) && (
        <div className="flex justify-between text-2xs mb-1.5">
          <span className="text-ink-400 uppercase tracking-wider">{label}</span>
          <span className="num text-ink-100">{sub}</span>
        </div>
      )}
      <div className="bg-white/[0.05] rounded-full overflow-hidden" style={{ height }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: `linear-gradient(90deg, ${color}aa, ${color})` }}
        />
      </div>
    </div>
  );
}

/* ───────── Chip ───────── */
export function Chip({ label, active, onClick, tone = 'brand' }: { label: string; active?: boolean; onClick?: () => void; tone?: 'brand' | 'gain' | 'dawn' | 'info' }) {
  const tones = {
    brand: active ? 'bg-brand text-ink-950 shadow-sm' : 'bg-white/[0.04] text-ink-300 hover:bg-white/[0.08] hover:text-ink-100',
    gain: active ? 'bg-gain text-ink-950 shadow-sm' : 'bg-white/[0.04] text-ink-300 hover:bg-white/[0.08] hover:text-ink-100',
    dawn: active ? 'bg-dawn text-ink-950 shadow-sm' : 'bg-white/[0.04] text-ink-300 hover:bg-white/[0.08] hover:text-ink-100',
    info: active ? 'bg-info text-ink-950 shadow-sm' : 'bg-white/[0.04] text-ink-300 hover:bg-white/[0.08] hover:text-ink-100',
  };
  return (
    <button onClick={onClick} className={cn('text-xs px-3.5 py-1.5 rounded-full font-medium whitespace-nowrap transition-all duration-200', tones[tone])}>
      {label}
    </button>
  );
}

/* ───────── Tag ───────── */
export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'gain' | 'loss' | 'brand' | 'info' | 'warn' }) {
  const tones = {
    neutral: 'bg-white/[0.04] text-ink-300 border-white/[0.06]',
    gain: 'bg-gain-dim text-gain border-gain/30',
    loss: 'bg-loss-dim text-ink-100 border-loss/30',
    brand: 'bg-brand-dim text-brand border-brand/30',
    info: 'bg-info-dim text-info border-info/30',
    warn: 'bg-warn-dim text-warn border-warn/30',
  };
  return <span className={cn('text-2xs uppercase tracking-wider px-2 py-0.5 rounded border font-semibold', tones[tone])}>{children}</span>;
}

/* ───────── Slider ───────── */
export function Slider({ label, value, onChange, min, max, step = 1, fmt }: {
  label: string; value: number; onChange: (n: number) => void;
  min: number; max: number; step?: number; fmt?: (n: number) => string;
}) {
  return (
    <div className="py-1.5">
      <div className="flex justify-between mb-1">
        <span className="text-[11px] text-ink-300 font-medium">{label}</span>
        <span className="num text-[11px] text-ink-50 font-medium">{fmt ? fmt(value) : value}</span>
      </div>
      <RSlider.Root className="relative flex items-center h-4 select-none" value={[value]} onValueChange={(v) => onChange(v[0])} min={min} max={max} step={step}>
        <RSlider.Track className="bg-white/[0.06] relative grow rounded-full h-1">
          <RSlider.Range className="absolute bg-white/30 rounded-full h-full" />
        </RSlider.Track>
        <RSlider.Thumb className="block w-3.5 h-3.5 bg-ink-100 rounded-full shadow-md ring-2 ring-white/10 focus:outline-none focus:ring-white/30 transition-all hover:scale-110" />
      </RSlider.Root>
    </div>
  );
}

/* ───────── Tile ───────── */
export function Tile({ children, active, onClick, className }: { children: ReactNode; active?: boolean; onClick?: () => void; className?: string }) {
  return (
    <button onClick={onClick} className={cn(
      'group relative rounded-2xl p-6 transition-all text-left',
      active ? 'bg-gradient-to-br from-ink-800 to-ink-900 ring-1 ring-dawn/50 scale-[1.02]' : 'bg-ink-900/60 hover:bg-ink-800 ring-1 ring-white/[0.06]',
      className,
    )}>
      {children}
    </button>
  );
}

/* ───────── AI Button ───────── */
export function AIButton({ label, onClick, loading, result, error }: {
  label: string; onClick: () => void; loading?: boolean; result?: string | null; error?: string | null;
}) {
  return (
    <div>
      <button onClick={onClick} disabled={loading}
        className={cn(
          'w-full py-3 rounded-lg border text-sm font-medium transition-all duration-300',
          loading ? 'border-white/[0.06] bg-white/[0.02] text-ink-400'
                  : 'border-brand/30 bg-brand-dim text-brand hover:bg-brand/15 hover:border-brand/50 hover:shadow-glow-brand',
        )}>
        {loading ? 'Thinking…' : `✦  ${label}`}
      </button>
      {loading && <div className="h-24 mt-3 rounded-lg bg-white/[0.03] overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent animate-pulse" />
      </div>}
      {result && <div className="mt-3 p-4 card-premium rounded-lg text-sm text-ink-100 leading-relaxed whitespace-pre-wrap">{result}</div>}
      {error && <div className="mt-3 p-3 bg-loss-dim border border-loss/20 rounded-lg text-xs text-ink-100">{error}</div>}
    </div>
  );
}

/* ───────── Number input ───────── */
export function NumInput({ value, onChange, prefix, suffix, className }: { value: number; onChange: (n: number) => void; prefix?: string; suffix?: string; className?: string }) {
  const [focused, setFocused] = useState(false);
  const format = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  const [local, setLocal] = useState(format(value));
  // Sync local when parent value changes externally (e.g. chip click, store update)
  useEffect(() => { if (!focused) setLocal(format(value)); }, [value, focused]);
  return (
    <div className={cn('inline-flex items-center bg-white/[0.03] border border-white/[0.08] rounded-md px-2.5 py-1.5 focus-within:border-brand/50 focus-within:bg-white/[0.05] transition-all', className)}>
      {prefix && <span className="text-2xs text-ink-400 mr-1.5 font-medium">{prefix}</span>}
      <input
        type="text"
        inputMode="decimal"
        className="num text-sm bg-transparent outline-none border-0 ring-0 shadow-none appearance-none flex-1 min-w-0 w-24 text-ink-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:outline-none focus:ring-0 focus:border-0"
        value={local}
        onFocus={() => { setFocused(true); setLocal(String(value)); }}
        onChange={e => setLocal(e.target.value.replace(/[^0-9.-]/g, ''))}
        onBlur={() => {
          setFocused(false);
          const n = parseFloat(local);
          if (!isNaN(n)) { onChange(n); setLocal(format(n)); }
          else setLocal(format(value));
        }}
      />
      {suffix && <span className="text-2xs text-ink-400 ml-1.5 font-medium">{suffix}</span>}
    </div>
  );
}

/* ───────── Save button — compact, neutral ───────── */
export function SaveButton({ onSave, label = 'Save' }: { onSave?: () => void; label?: string }) {
  const [saved, setSaved] = useState(false);
  function handle() {
    onSave?.();
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }
  return (
    <button onClick={handle}
      className={cn(
        'text-[10px] uppercase tracking-wider px-2.5 py-1 rounded border font-semibold transition-all',
        saved
          ? 'bg-white/[0.04] text-ink-100 border-white/[0.10]'
          : 'bg-white/[0.03] text-ink-200 border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.14]'
      )}>
      {saved ? '✓ Saved' : label}
    </button>
  );
}

/* ───────── Disclaimer ───────── */
export function Disclaimer({ text }: { text: string }) {
  return <p className="text-2xs text-ink-400/70 leading-relaxed mt-6 italic max-w-prose">{text}</p>;
}

/* ───────── Formatters ───────── */
export const fmtA = (n: number) => '$' + Math.round(n).toLocaleString();
export const fmtU = (n: number) => 'US$' + Math.round(n).toLocaleString();
export const fmtS = (n: number) => 'S$' + Math.round(n).toLocaleString();
export const fmtPct = (n: number, places = 1) => n.toFixed(places) + '%';
export const fmtCompact = (n: number) => {
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return n.toFixed(0);
};
export const fmtAud = (n: number, compact = false) => {
  if (compact) return '$' + fmtCompact(n);
  return '$' + Math.round(n).toLocaleString();
};
