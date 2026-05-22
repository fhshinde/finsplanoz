import { COUPLE } from './constants';
import type { Person } from './types';

const MODEL = 'claude-sonnet-4-6';
const API_URL = 'https://api.anthropic.com/v1/messages';
const KEY = (import.meta as any).env?.VITE_ANTHROPIC_API_KEY as string | undefined;

const SYSTEM = `You are the personal AI assistant for a couple in Sydney, Australia.
Her: Taiwanese-Singaporean, presales tech sales APAC, 35, in therapy (family-of-origin).
Him: Indian, Google Chief of Staff APAC Gov Affairs, 34, in therapy (work stress).
Together since ${COUPLE.metYear}, married ${COUPLE.marriedYear}, moved Sydney ${COUPLE.relocatedSydney}. FIRE target $${COUPLE.fireTargetAUD/1_000_000}M by ${COUPLE.fireTargetAge}.
Portfolio: ~US$980K in Schwab International joint tenant (≈$1.37M; GOOG ≈30%, SMH 17%, VGT 17% — US tech heavy). Net worth incl. SGD 600K insurance ≈ $1.92M, ~38% of the $5M FIRE target.
Combined income: $${COUPLE.incomeAUD}. Spend: ~SGD ${COUPLE.monthlySpendTargetSGD}/month. Rent: $${COUPLE.rentMonthlyAUD}/month Sydney.
Be specific, warm, direct, and financially literate. Never generic.
Avoid clinical language around mental health — supportive and grounding only.`;

export type Ask = { user: string; cacheKey?: string; maxTokens?: number };

export async function ask({ user, maxTokens = 1000 }: Ask): Promise<string> {
  if (!KEY) {
    await new Promise(r => setTimeout(r, 800));
    return STUB_RESPONSES[user.slice(0, 30)] ?? defaultStub();
  }
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: SYSTEM,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}`);
  const data = await res.json();
  return data?.content?.[0]?.text ?? '';
}

export function liftPrompt(person: Person, mood?: number, energy?: number) {
  return `Generate today's 4–5 short lift items for ${person === 'together' ? 'the couple together' : person === 'her' ? 'her specifically' : 'him specifically'}.
${mood ? `Today's mood: ${mood}/5. Energy: ${energy}/5.` : ''}
Return as JSON array of {icon, text} where icon is a single emoji and text is 1–2 short sentences.
Cover: (1) week observation across fitness/finances/relationship, (2) encouragement for her (presales/family work), (3) encouragement for him (Chief of Staff/work stress), (4) one relationship anchor referencing they chose each other across cultures, (5) forward-looking note. Be specific. No clinical language.`;
}

const STUB_RESPONSES: Record<string, string> = {};
function defaultStub() {
  return `(Stub response — add VITE_ANTHROPIC_API_KEY to .env.local for real Claude responses.)

A few notes for your situation:
- You're in the high-savings phase. Even at base 7% return + current savings capacity, you're tracking toward FIRE in the early 2040s.
- Tech concentration (GOOG + SMH + VGT ≈ 60% of portfolio) is your biggest risk — a structural rebalance toward VOO/VXUS over 2–3 years would reduce single-sector exposure without forcing a big CGT hit.
- Super sacrifice is genuinely your best near-term tax move: $30K each at 15% vs 47% marginal is a guaranteed +$19K/year.
- On the wellbeing side: this week, prioritise one shared anchor — a walk together, a no-phones dinner.`;
}

// Try to extract a JSON array from a string of text (the model often wraps in code fences)
export function tryParseLiftJSON(text: string): Array<{ icon: string; text: string }> | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (Array.isArray(parsed) && parsed.every(x => x && typeof x.icon === 'string' && typeof x.text === 'string')) {
      return parsed;
    }
  } catch {}
  return null;
}

export const STUB_LIFT = [
  { icon: '✨', text: "You moved 7,500 km and built a whole new life this year. That counts." },
  { icon: '💼', text: "Her: presales is performance work — your prep is the moat. Recharge the body, the polish follows." },
  { icon: '🌀', text: "Him: not every email needs a same-day reply. The CoS role compounds best when you protect the deep-work hours." },
  { icon: '🤝', text: "You chose each other across Taipei, Singapore, Pune, and Sydney. That's a track record." },
  { icon: '🌏', text: "Next trip on the calendar is a real reset. Protect the dates from work creep." },
];
