'use client';

/**
 * Voltix Dynamics — SmartTableauSimulator
 * توأم رقمي مضغوط: طابلو 3-فاز ذكي لمنزل ⇄ لوحة قوى MCC لمصنع.
 * يعتمد على: react 18, tailwindcss 3, lucide-react. لا مكتبات أخرى.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import {
  Activity,
  BatteryCharging,
  ChevronDown,
  ChevronUp,
  CloudLightning,
  Cpu,
  Factory,
  Flame,
  Home,
  RotateCcw,
  Scale,
  ShieldAlert,
  Sun,
  Thermometer,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';

/* ───────────────────────────── النماذج والبيانات ───────────────────────────── */

type Key = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5' | 'Q6';
type Phase = 'L1' | 'L2' | 'L3' | '3P';
type Mode = 'normal' | 'solar' | 'emergency';
type Lvl = 'info' | 'ok' | 'warn' | 'fault';
type Pair<T> = [T, T]; // [منزل, مصنع]

interface Dev {
  label: Pair<string>;
  kw: Pair<number>;
}
interface Circuit {
  color: string;
  phase: Pair<Phase>;
  name: Pair<string>;
  short: Pair<string>;
  rating: Pair<number>;
  spec: Pair<string>;
  desc: Pair<string>;
  scale: 'hvac' | 'heavy' | null;
  emoji: Pair<string>;
  fan: boolean;
  devs: Dev[];
}
interface LogItem {
  t: string;
  msg: string;
  lvl: Lvl;
}
interface State {
  fac: 'home' | 'factory';
  mode: Mode;
  sel: Key;
  breakers: Record<Key, boolean>;
  devices: Record<Key, boolean[]>;
  solar: number;
  hvac: number;
  heavy: number;
  ai: boolean;
  ahf: boolean;
  thermal: boolean;
  sound: boolean;
  collapsed: boolean;
  fault: { on: boolean; left: number };
  surge: boolean;
  soc: number;
  savings: number;
  scope: '3p' | 'vi';
  tab: 'insp' | 'scope' | 'loads';
  log: LogItem[];
}
interface Row {
  kw: number;
  amps: number;
  three: boolean;
  on: boolean;
  faulted: boolean;
  overload: boolean;
  shed: boolean;
  depleted: boolean;
  powered: boolean;
  src: boolean;
  temp: number;
  pct: number;
}
interface Geo {
  x: number;
  y: number;
  w: number;
  h: number;
}

const KEYS: Key[] = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'];

const C: Record<Key, Circuit> = {
  Q1: {
    color: '#38bdf8',
    phase: ['L1', '3P'],
    name: ['الجناح الرئيسي والتكييف', 'خط الروبوتات و CNC'],
    short: ['الجناح والتكييف', 'الروبوتات و CNC'],
    rating: [20, 100],
    spec: ['RCBO C20A • 10mA • نحاس 4mm²', 'MCCB 100A + VFD • 3×35mm²'],
    desc: [
      'يغذي مكيف الإنفرتر وسخان المياه بحماية تفاضلية فائقة الحساسية 10mA.',
      'يغذي أذرع اللحام سداسية المحاور وماكينات CNC عبر VFD مع مراقبة اهتزاز المحامل.',
    ],
    scale: 'hvac',
    emoji: ['❄️', '🦾'],
    fan: true,
    devs: [
      { label: ['مكيف إنفرتر', 'روبوت لحام'], kw: [1.25, 22] },
      { label: ['سخان مياه', 'CNC خماسي'], kw: [0.65, 15] },
      { label: ['إنارة وستائر', 'شفط أبخرة'], kw: [0.2, 5] },
    ],
  },
  Q2: {
    color: '#818cf8',
    phase: ['L2', '3P'],
    name: ['المكتب والسيرفر', 'غرفة SCADA وبنك المكثفات'],
    short: ['المكتب والسيرفر', 'SCADA و APFC'],
    rating: [16, 63],
    spec: ['RCBO C16A + UPS • 2.5mm²', 'MCCB 63A + APFC • 4×16mm²'],
    desc: [
      'خط نقي مدعوم بـ UPS لحماية السيرفر المنزلي ومعالج الأتمتة KNX.',
      'يغذي خوادم SCADA وبنك المكثفات الأوتوماتيكي لتثبيت معامل القدرة عند 0.99.',
    ],
    scale: null,
    emoji: ['🖥️', '🧠'],
    fan: true,
    devs: [
      { label: ['سيرفر KNX', 'خوادم SCADA'], kw: [0.35, 9.5] },
      { label: ['مكتب وشاشات', 'بنك APFC'], kw: [0.22, 5.5] },
      { label: ['منقي HEPA', 'تبريد خوادم'], kw: [0.15, 3.5] },
    ],
  },
  Q3: {
    color: '#f59e0b',
    phase: ['L1', '3P'],
    name: ['المطبخ وحماية AFDD', 'الفرن الحثي والمفاعل'],
    short: ['المطبخ والفرن', 'الفرن الحثي'],
    rating: [25, 160],
    spec: ['AFDD+RCBO C25A • 6mm²', 'ACB 160A • قضبان نحاس'],
    desc: [
      'حساس قوس كهربائي AFDD وصمام غاز كهرومغناطيسي يُغلق تلقائياً عند أي شورت.',
      'فرن صهر حثي 840°C مع إخماد FM-200 عند رصد قوس أو احتباس حراري.',
    ],
    scale: 'heavy',
    emoji: ['🍳', '🔥'],
    fan: false,
    devs: [
      { label: ['موقد حثي', 'فرن الصهر'], kw: [0.95, 52] },
      { label: ['ثلاجة ذكية', 'مضخات تبريد'], kw: [0.28, 11] },
      { label: ['حساس الغاز', 'إطفاء FM-200'], kw: [0.12, 5] },
    ],
  },
  Q4: {
    color: '#facc15',
    phase: ['L3', '3P'],
    name: ['الصالة والسينما DALI', 'السيور والفرز البصري'],
    short: ['الصالة والسينما', 'السيور والفرز AI'],
    rating: [16, 63],
    spec: ['MCB C16A • DALI • 2.5mm²', 'MCCB 63A • 4×16mm²'],
    desc: [
      'إنارة DALI تفاعلية وسينما OLED 8K مع رادار تواجد بشري مليمتري.',
      'محركات السيور عالية السرعة وبوابة فحص ليزري بالذكاء الاصطناعي.',
    ],
    scale: 'hvac',
    emoji: ['📺', '📦'],
    fan: false,
    devs: [
      { label: ['سينما 8K', 'محركات السير'], kw: [0.32, 16.5] },
      { label: ['إنارة DALI', 'فحص ليزري'], kw: [0.2, 7.5] },
    ],
  },
  Q5: {
    color: '#10b981',
    phase: ['3P', '3P'],
    name: ['شاحن السيارة العكسي V2H', 'حاوية BESS وشحن AGV'],
    short: ['شاحن V2H', 'BESS و AGV'],
    rating: [32, 125],
    spec: ['RCBO Type-B C32A • 5×6mm²', 'MCCB Bi-Dir 125A • 4×50mm²'],
    desc: [
      'شاحن ثنائي الاتجاه: يشحن السيارة من فائض الشمس، ويعكس التيار لتغذية المنزل عند الطوارئ.',
      'بطاريات صناعية 500kWh وأسطول AGV لقص ذروة الأحمال وتغذية المصنع عند انقطاع الشبكة.',
    ],
    scale: 'heavy',
    emoji: ['🚗', '🔋'],
    fan: false,
    devs: [
      { label: ['Wallbox 22kW', 'خزان BESS'], kw: [2.2, 28] },
      { label: ['بوابة المرآب', 'شواحن AGV'], kw: [0.2, 10] },
    ],
  },
  Q6: {
    color: '#2dd4bf',
    phase: ['L3', '3P'],
    name: ['مضخة المياه والرادار', 'ضواغط الهواء والمبردات'],
    short: ['المضخة والرادار', 'ضواغط ومبردات'],
    rating: [16, 80],
    spec: ['RCBO C16A • خط حرج 24/7', 'MCCB 80A • 4×25mm² مدرع'],
    desc: [
      'خط حرج يعمل 24/7 لمضخة الضغط (3.2 bar) ورادار الحراسة الخارجي.',
      'ضواغط هواء لولبية (8.5 bar) ومبردات Chiller مركزية.',
    ],
    scale: 'heavy',
    emoji: ['💧', '🌀'],
    fan: true,
    devs: [
      { label: ['مضخة 3.2bar', 'ضواغط 8.5bar'], kw: [0.3, 21] },
      { label: ['رادار وري', 'مبردات Chiller'], kw: [0.12, 10] },
    ],
  },
};

const FAC = [
  { pv: 6.4, cap: 60, stKw: 7, chg: 7, tariff: 0.15 },
  { pv: 170, cap: 500, stKw: 120, chg: 100, tariff: 0.11 },
];

const GEO: Record<Key, Geo>[] = [
  {
    Q1: { x: 20, y: 96, w: 278, h: 94 },
    Q2: { x: 302, y: 96, w: 278, h: 94 },
    Q3: { x: 20, y: 206, w: 278, h: 94 },
    Q4: { x: 302, y: 206, w: 278, h: 94 },
    Q5: { x: 20, y: 312, w: 196, h: 60 },
    Q6: { x: 220, y: 312, w: 180, h: 60 },
  },
  {
    Q1: { x: 20, y: 96, w: 278, h: 94 },
    Q2: { x: 302, y: 96, w: 278, h: 94 },
    Q3: { x: 20, y: 206, w: 278, h: 94 },
    Q4: { x: 302, y: 206, w: 278, h: 94 },
    Q5: { x: 20, y: 312, w: 240, h: 60 },
    Q6: { x: 264, y: 312, w: 196, h: 60 },
  },
];

const wirePath = (k: Key, fi: number): string => {
  const q5 = fi ? 140 : 118;
  const q6 = fi ? 362 : 310;
  switch (k) {
    case 'Q1': return 'M644 125 H632 V195 H159 V190';
    case 'Q2': return 'M644 167 H584';
    case 'Q3': return 'M644 209 H620 V201 H159 V206';
    case 'Q4': return 'M644 251 H584';
    case 'Q5': return `M644 293 H604 V306 H${q5} V312`;
    default: return `M644 335 H612 V309 H${q6} V312`;
  }
};

/* ───────────────────────────── محرك الحساب ───────────────────────────── */

function assignPhases(fi: number, rows: Record<Key, Row>, ai: boolean) {
  const base = {} as Record<Key, Phase>;
  const singles: Key[] = [];
  KEYS.forEach((k) => {
    base[k] = C[k].phase[fi];
    if (base[k] !== '3P') singles.push(k);
  });
  const totals = (a: Record<Key, Phase>) => {
    const P = { L1: 0, L2: 0, L3: 0 };
    KEYS.forEach((k) => {
      const r = rows[k];
      if (!r.powered || r.src) return;
      if (a[k] === '3P') {
        P.L1 += r.amps;
        P.L2 += r.amps;
        P.L3 += r.amps;
      } else P[a[k]] += r.amps;
    });
    return P;
  };
  let best = base;
  if (ai && singles.length) {
    const ph: Phase[] = ['L1', 'L2', 'L3'];
    let bestScore = Infinity;
    const total = 3 ** singles.length;
    for (let i = 0; i < total; i++) {
      const a = { ...base };
      let x = i;
      let changes = 0;
      for (let j = 0; j < singles.length; j++) {
        a[singles[j]] = ph[x % 3];
        x = Math.floor(x / 3);
        if (a[singles[j]] !== base[singles[j]]) changes++;
      }
      const P = totals(a);
      const v = [P.L1, P.L2, P.L3];
      const sc = (Math.max(...v) - Math.min(...v)) * 1000 + changes;
      if (sc < bestScore) {
        bestScore = sc;
        best = a;
      }
    }
  }
  return { phases: best, P: totals(best), base };
}

function compute(s: State) {
  const fi = s.fac === 'home' ? 0 : 1;
  const F = FAC[fi];
  const em = s.mode === 'emergency';
  const solar = (s.solar / 100) * F.pv;
  const rows = {} as Record<Key, Row>;

  for (const k of KEYS) {
    const c = C[k];
    let kw = c.devs.reduce((a, d, i) => a + (s.devices[k][i] ? d.kw[fi] : 0), 0);
    if (c.scale === 'hvac') kw *= s.hvac / 70;
    else if (c.scale === 'heavy') kw *= s.heavy / 60;
    const three = c.phase[fi] === '3P';
    const amps = three ? (kw * 1000) / (1.732 * 400 * 0.97) : (kw * 1000) / 230;
    const on = s.breakers[k];
    const faulted = k === 'Q3' && s.fault.on;
    const overload = on && !faulted && amps > c.rating[fi];
    rows[k] = {
      kw, amps, three, on, faulted, overload,
      shed: false, depleted: false,
      powered: on && !faulted && !overload,
      src: false, temp: 0, pct: 0,
    };
  }

  if (em && s.soc <= 5 && rows.Q5.powered) {
    rows.Q5.depleted = true;
    rows.Q5.powered = false;
  }
  const stCap = em && s.soc > 5 && rows.Q5.powered ? F.stKw : 0;
  const dem = () =>
    KEYS.reduce((a, k) => a + (rows[k].powered && !(em && k === 'Q5') ? rows[k].kw : 0), 0);

  let demand = dem();
  let deficit = em ? demand - solar - stCap : 0;
  if (em && s.ai && deficit > 0.01) {
    for (const k of ['Q4', 'Q1', 'Q3'] as Key[]) {
      if (deficit <= 0.01) break;
      if (rows[k].powered) {
        rows[k].shed = true;
        rows[k].powered = false;
        deficit -= rows[k].kw;
      }
    }
    demand = dem();
    deficit = Math.max(0, demand - solar - stCap);
  }
  const discharge = em ? Math.min(stCap, Math.max(0, demand - solar)) : 0;
  if (em && rows.Q5.powered) {
    rows.Q5.src = true;
    rows.Q5.kw = discharge;
    rows.Q5.amps = (discharge * 1000) / (1.732 * 400 * 0.97);
  }
  const grid = em ? 0 : Math.max(0, demand - solar);
  const exp = em ? 0 : Math.max(0, solar - demand);
  const brownout = em && deficit > 0.05;

  const { phases, P, base } = assignPhases(fi, rows, s.ai);
  const pv = [P.L1, P.L2, P.L3];
  const mx = Math.max(...pv);
  const imb = mx > 0.5 ? ((mx - Math.min(...pv)) / mx) * 100 : 0;

  KEYS.forEach((k, idx) => {
    const r = rows[k];
    r.pct = Math.min(1.3, r.amps / C[k].rating[fi]);
    r.temp = r.faulted ? 74.5 : r.overload ? 68 : !r.on ? 25.5 : 27 + r.amps * (fi ? 0.18 : 0.55) + idx * 0.4;
  });

  const overKey = KEYS.filter((k) => rows[k].overload).join(',');
  return {
    fi, F, em, rows, solar, demand, grid, exp, discharge, deficit, brownout,
    phases, base, P, imb, overKey,
    pf: s.ahf ? 0.99 : fi ? 0.84 : 0.91,
    thd: s.ahf ? (fi ? 0.9 : 1.1) : fi ? 8.7 : 4.2,
  };
}

/* ───────────────────────────── أدوات مساعدة ───────────────────────────── */

const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(' ');
const nowStr = () => new Date().toTimeString().slice(0, 8);
const addLog = (log: LogItem[], msg: string, lvl: Lvl): LogItem[] =>
  [{ t: nowStr(), msg, lvl }, ...log].slice(0, 6);
const thermalColor = (t: number) => {
  const x = Math.max(0, Math.min(1, (t - 26) / 50));
  return `hsl(${210 - 210 * x} 85% ${16 + 12 * x}%)`;
};
const act = (fn: () => void) => ({
  role: 'button' as const,
  tabIndex: 0,
  onClick: (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  },
  onKeyDown: (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      fn();
    }
  },
});

const makeInit = (collapsed: boolean): State => ({
  fac: 'home',
  mode: 'normal',
  sel: 'Q1',
  breakers: { Q1: true, Q2: true, Q3: true, Q4: true, Q5: true, Q6: true },
  devices: Object.fromEntries(KEYS.map((k) => [k, C[k].devs.map(() => true)])) as Record<Key, boolean[]>,
  solar: 85,
  hvac: 70,
  heavy: 60,
  ai: true,
  ahf: true,
  thermal: false,
  sound: false,
  collapsed,
  fault: { on: false, left: 0 },
  surge: false,
  soc: 86,
  savings: 14.8,
  scope: '3p',
  tab: 'insp',
  log: [{ t: '--:--:--', msg: 'التوأم الرقمي جاهز ويعمل 24/7.', lvl: 'ok' }],
});

const CSS = `
@keyframes vx-dash{from{stroke-dashoffset:13}to{stroke-dashoffset:0}}
@keyframes vx-rot{to{transform:rotate(360deg)}}
@keyframes vx-blink{from{opacity:1}to{opacity:.35}}
@keyframes vx-fl{0%{opacity:.8}100%{opacity:0}}
.vx-flow{stroke-dasharray:7 6;animation:vx-dash .9s linear infinite}
.vx-flow.rev{animation-direction:reverse}
.vx-spin{animation:vx-rot 1s linear infinite;transform-box:fill-box;transform-origin:center}
.vx-fault{animation:vx-blink .5s ease-in-out infinite alternate}
.vx-flash{animation:vx-fl .4s ease-out 4}
.vx-node{cursor:pointer;transition:filter .2s}
.vx-node:hover{filter:brightness(1.3)}
.vx-node:focus-visible{outline:2px solid #22d3ee;outline-offset:2px}
@media (prefers-reduced-motion:reduce){.vx-flow,.vx-spin,.vx-fault,.vx-flash{animation:none}}
`;

/* ───────────────────────────── راسم الموجات ───────────────────────────── */

function Scope({ mode, dist, pf, alive }: { mode: '3p' | 'vi'; dist: number; pf: number; alive: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const p = useRef({ mode, dist, pf, alive });
  p.current = { mode, dist, pf, alive };

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let t = 0;
    const draw = () => {
      const q = p.current;
      const dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(51,65,85,.45)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, (h * i) / 4);
        ctx.lineTo(w, (h * i) / 4);
        ctx.stroke();
      }
      for (let i = 1; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo((w * i) / 10, 0);
        ctx.lineTo((w * i) / 10, h);
        ctx.stroke();
      }
      if (q.alive) {
        const mid = h / 2;
        const amp = h * 0.36;
        const wave = (a: number, d: number) =>
          Math.sin(a) + d * (0.6 * Math.sin(5 * a) + 0.4 * Math.sin(7 * a));
        const line = (off: number, col: string, d: number, k: number) => {
          ctx.beginPath();
          for (let x = 0; x <= w; x += 2) {
            const y = mid - wave(x * 0.034 - t + off, d) * amp * k;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = col;
          ctx.lineWidth = 2;
          ctx.shadowColor = col;
          ctx.shadowBlur = 6;
          ctx.stroke();
          ctx.shadowBlur = 0;
        };
        if (q.mode === '3p') {
          line(0, '#f43f5e', q.dist, 1);
          line(2.094, '#f59e0b', q.dist, 1);
          line(4.189, '#38bdf8', q.dist, 1);
        } else {
          line(0, '#22d3ee', 0, 1);
          line(-Math.acos(Math.min(1, q.pf)), '#fbbf24', q.dist, 0.7);
        }
      }
      if (!reduce) t += 0.045;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className="block h-full w-full" aria-label="راسم موجات الجهد والتيار" />;
}

/* ───────────────────────────── المكوّن الرئيسي ───────────────────────────── */

interface Props {
  /** يبدأ مطويّاً (شريط واحد فقط) لتوفير المساحة */
  defaultCollapsed?: boolean;
  className?: string;
}

export default function SmartTableauSimulator({ defaultCollapsed = false, className = '' }: Props) {
  const [s, setS] = useState<State>(() => makeInit(defaultCollapsed));
  const m = compute(s);
  const { fi, F, rows } = m;
  const lab = (k: Key) => (fi ? k.replace('Q', 'M') : k);

  const patch = useCallback((p: Partial<State>) => setS((x) => ({ ...x, ...p })), []);
  const log = useCallback(
    (msg: string, lvl: Lvl = 'info') => setS((x) => ({ ...x, log: addLog(x.log, msg, lvl) })),
    [],
  );

  /* الصوت والنطق */
  const audio = useRef<AudioContext | null>(null);
  const soundOn = useRef(false);
  soundOn.current = s.sound;
  const beep = useCallback((f: number, d = 0.08, type: OscillatorType = 'sine') => {
    const c = audio.current;
    if (!soundOn.current || !c) return;
    try {
      if (c.state === 'suspended') void c.resume();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.06, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d);
      o.connect(g);
      g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + d);
    } catch {
      /* تجاهل */
    }
  }, []);
  const speak = useCallback((t: string) => {
    if (!soundOn.current || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      u.lang = 'ar-SA';
      window.speechSynthesis.speak(u);
    } catch {
      /* تجاهل */
    }
  }, []);

  /* الإجراءات */
  const setFac = (f: 'home' | 'factory') => {
    if (s.fac === f) return;
    setS((x) => ({
      ...x,
      fac: f,
      soc: f === 'home' ? 86 : 90,
      savings: f === 'home' ? 14.8 : 640,
      fault: { on: false, left: 0 },
      log: addLog(x.log, f === 'factory' ? '🏭 تم التحويل إلى المصنع الذكي (MCC 400V).' : '🏠 تم التحويل إلى المنزل الذكي (3-فاز).', 'ok'),
    }));
    beep(f === 'factory' ? 540 : 780, 0.12, 'triangle');
  };
  const setMode = (mode: Mode) => {
    setS((x) => ({
      ...x,
      mode,
      solar: mode === 'normal' ? 85 : mode === 'solar' ? 100 : x.solar,
      log: addLog(
        x.log,
        mode === 'normal'
          ? 'وضع التوازن القياسي.'
          : mode === 'solar'
            ? 'وضع التوليد الشمسي الأقصى: تغطية الأحمال وتصدير الفائض.'
            : x.fac === 'home'
              ? 'طوارئ V2H: انقطاع الشبكة والسيارة تغذي المنزل.'
              : 'طوارئ BESS: انقطاع الشبكة وحاوية البطاريات تغذي المصنع.',
        mode === 'emergency' ? 'warn' : 'ok',
      ),
    }));
    beep(mode === 'emergency' ? 300 : 700, 0.1, 'triangle');
  };
  const triggerFault = () => {
    if (s.fault.on) return;
    setS((x) => ({
      ...x,
      fault: { on: true, left: 6 },
      sel: 'Q3',
      log: addLog(x.log, x.fac === 'home' ? 'قصر دائرة في المطبخ Q3: فصل انتقائي وإغلاق صمام الغاز.' : 'عطل في مفاعل الصهر M3: فصل انتقائي وتفعيل FM-200.', 'fault'),
    }));
    beep(240, 0.3, 'sawtooth');
    speak(fi ? 'تنبيه، عطل في المفاعل إم ثلاثة، تم عزل القاطع' : 'تنبيه، شورت في المطبخ، تم عزل القاطع رقم ثلاثة');
  };
  const resetFault = () => {
    setS((x) => ({ ...x, fault: { on: false, left: 0 }, log: addLog(x.log, 'تمت استعادة الدائرة المعزولة يدوياً.', 'ok') }));
    beep(880, 0.1);
  };
  const surgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lightning = () => {
    setS((x) => ({ ...x, surge: true, log: addLog(x.log, '⚡ صاعقة 8kV: فرّغها SPD عبر بئر التأريض بلا أضرار.', 'fault') }));
    beep(180, 0.35, 'sawtooth');
    speak('تنبيه صاعقة، تم التفريغ بنجاح عبر بئر التأريض');
    if (surgeTimer.current) clearTimeout(surgeTimer.current);
    surgeTimer.current = setTimeout(() => patch({ surge: false }), 2800);
  };
  const toggleBreaker = (k: Key) => {
    if (k === 'Q3' && s.fault.on) {
      log(`${lab(k)} مفصول بسبب العطل — استخدم «إعادة ضبط».`, 'warn');
      return;
    }
    setS((x) => ({
      ...x,
      sel: k,
      breakers: { ...x.breakers, [k]: !x.breakers[k] },
      log: addLog(x.log, `تم ${x.breakers[k] ? 'فصل' : 'توصيل'} القاطع ${x.fac === 'factory' ? k.replace('Q', 'M') : k} يدوياً.`, x.breakers[k] ? 'warn' : 'ok'),
    }));
    beep(s.breakers[k] ? 320 : 880);
  };
  const toggleDev = (k: Key, i: number) => {
    setS((x) => {
      const d = [...x.devices[k]];
      d[i] = !d[i];
      return { ...x, sel: k, devices: { ...x.devices, [k]: d } };
    });
    beep(600, 0.05);
  };
  const select = (k: Key) => {
    patch({ sel: k });
    beep(640, 0.05);
  };
  const toggleSound = () => {
    if (!s.sound && !audio.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) audio.current = new Ctor();
    }
    patch({ sound: !s.sound });
  };

  /* المعيد الآلي بعد العطل */
  useEffect(() => {
    if (!s.fault.on || !s.ai) return;
    const id = setInterval(() => {
      setS((x) => {
        if (!x.fault.on) return x;
        if (x.fault.left > 1) return { ...x, fault: { on: true, left: x.fault.left - 1 } };
        return { ...x, fault: { on: false, left: 0 }, log: addLog(x.log, 'المعيد الآلي: اكتمل فحص العزل وأُعيد توصيل القاطع تلقائياً.', 'ok') };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [s.fault.on, s.ai]);

  /* نبضة المحاكاة: تخزين وتوفير (كل ثانية = 5 دقائق) */
  const live = useRef({ m, s });
  live.current = { m, s };
  useEffect(() => {
    const id = setInterval(() => {
      const { m: mm, s: ss } = live.current;
      const Fx = FAC[ss.fac === 'home' ? 0 : 1];
      const dt = 5 / 60;
      setS((x) => {
        let soc = x.soc;
        if (mm.discharge > 0) soc -= (mm.discharge * dt) / Fx.cap * 100;
        else if (mm.exp > 0.05 && ss.mode !== 'emergency') soc += (Math.min(mm.exp, Fx.chg) * dt) / Fx.cap * 100;
        soc = Math.max(0, Math.min(100, soc));
        const gain = (Math.min(mm.solar, mm.demand) * Fx.tariff + mm.exp * Fx.tariff * 0.4) * dt;
        return { ...x, soc, savings: x.savings + gain };
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  /* تسجيل الحمل الزائد الحراري */
  const prevOver = useRef('');
  useEffect(() => {
    if (m.overKey !== prevOver.current) {
      if (m.overKey) log(`حماية حرارية: حمل زائد على ${m.overKey.split(',').map((k) => lab(k as Key)).join('، ')} — فصل تلقائي حتى انخفاض الحمل.`, 'warn');
      prevOver.current = m.overKey;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.overKey]);

  useEffect(() => () => { if (surgeTimer.current) clearTimeout(surgeTimer.current); }, []);

  /* ───────── عناصر الرسم ───────── */
  const accent = fi ? '#f59e0b' : '#38bdf8';
  const E = fi ? { x: 464, w: 116 } : { x: 404, w: 176 };

  const renderRoom = (k: Key) => {
    const g = GEO[fi][k];
    const r = rows[k];
    const c = C[k];
    const small = g.h < 80;
    const on = r.powered;
    const bad = r.faulted || r.overload;
    const status = r.faulted ? 'TRIP! قصر دائرة' : r.overload ? 'OVERLOAD' : r.shed ? '⛔ فصل AI' : r.depleted ? 'BESS فارغ' : !r.on ? 'OFF' : '';
    const info =
      k === 'Q5' ? `${fi ? 'BESS' : 'EV'} ${s.soc.toFixed(0)}%${r.src ? ' ↓ تفريغ' : ''}` : k === 'Q6' ? (fi ? '8.5 bar' : 'خزان 84% • 3.2 bar') : '';
    const n = c.devs.length;
    const cw = (g.w - 16 - (n - 1) * 4) / n;
    return (
      <g key={k} className="vx-node" aria-label={`${lab(k)} ${c.name[fi]}`} {...act(() => select(k))}>
        <rect
          x={g.x} y={g.y} width={g.w} height={g.h} rx={8}
          fill={s.thermal ? thermalColor(r.temp) : on ? '#0a1527' : '#060a12'}
          stroke={bad ? '#f43f5e' : on ? c.color : '#334155'}
          strokeWidth={s.sel === k ? 2.4 : 1.2}
          className={bad ? 'vx-fault' : undefined}
        />
        {on && !small && <circle cx={g.x + 44} cy={g.y + 48} r={30} fill={c.color} opacity={0.08} />}
        <rect x={g.x + 8} y={g.y + 8} width={30} height={16} rx={4} fill={c.color} opacity={on ? 1 : 0.4} />
        <text x={g.x + 23} y={g.y + 19.5} textAnchor="middle" fontSize={10} fontWeight={800} fill="#020617" fontFamily="monospace">{lab(k)}</text>
        <text x={g.x + 44} y={g.y + 20} fontSize={10.5} fontWeight={700} fill="#e2e8f0">{c.short[fi]}</text>
        <text x={g.x + g.w - 8} y={g.y + 20} textAnchor="end" fontSize={11} fontWeight={700} fill={on ? c.color : '#64748b'} fontFamily="monospace">
          {on ? `${r.src ? '−' : ''}${r.kw.toFixed(fi ? 1 : 2)}kW · ${r.amps.toFixed(fi ? 0 : 1)}A` : '—'}
        </text>
        <text
          x={small ? g.x + 26 : g.x + 44} y={small ? g.y + 46 : g.y + 58}
          textAnchor="middle" fontSize={small ? 20 : 26} opacity={on ? 1 : 0.2}
        >{c.emoji[fi]}</text>
        {c.fan && (
          <g transform={`translate(${g.x + g.w - (small ? 24 : 44)} ${g.y + (small ? 42 : 48)})`} opacity={on ? 1 : 0.3}>
            <circle r={small ? 10 : 14} fill="#0f172a" stroke={c.color} strokeWidth={1.2} />
            <g className="vx-spin" style={{ animationDuration: '0.8s', animationPlayState: on ? 'running' : 'paused' }}>
              <line x1={-8} y1={0} x2={8} y2={0} stroke={c.color} strokeWidth={2.4} />
              <line x1={0} y1={-8} x2={0} y2={8} stroke={c.color} strokeWidth={2.4} />
            </g>
          </g>
        )}
        {!status && (
          <text
            x={small ? g.x + g.w / 2 + 6 : g.x + g.w / 2} y={small ? g.y + 36 : g.y + 52}
            textAnchor="middle" fontSize={s.thermal ? 13 : 10} fontWeight={s.thermal ? 800 : 500}
            fill={s.thermal ? '#fff' : '#94a3b8'} fontFamily="monospace"
          >{`${r.temp.toFixed(0)}°C`}</text>
        )}
        {small && info && (
          <text x={g.x + g.w / 2 + 6} y={g.y + 52} textAnchor="middle" fontSize={10} fontWeight={700} fill={r.src ? '#c084fc' : '#cbd5e1'}>{info}</text>
        )}
        {status && (
          <text
            x={g.x + g.w / 2 + (small ? 6 : 0)} y={g.y + g.h / 2 + (small ? 14 : 4)} textAnchor="middle"
            fontSize={small ? 11 : 14} fontWeight={800} fill={bad ? '#fb7185' : '#94a3b8'}
            className={bad ? 'vx-fault' : undefined}
          >{status}</text>
        )}
        {!small && (
          <>
            <rect x={g.x + 8} y={g.y + g.h - 30} width={g.w - 16} height={3} rx={1.5} fill="#1e293b" />
            <rect x={g.x + 8} y={g.y + g.h - 30} width={(g.w - 16) * Math.min(1, r.pct)} height={3} rx={1.5} fill={r.pct > 0.9 ? '#f43f5e' : c.color} />
            {c.devs.map((d, i) => {
              const dOn = s.devices[k][i] && on;
              const x0 = g.x + 8 + i * (cw + 4);
              return (
                <g key={i} className="vx-node" aria-label={d.label[fi]} {...act(() => toggleDev(k, i))}>
                  <rect x={x0} y={g.y + g.h - 24} width={cw} height={17} rx={8.5} fill={dOn ? '#0e2a3a' : '#0b111c'} stroke={dOn ? c.color : '#263244'} strokeWidth={1} />
                  <circle cx={x0 + 9} cy={g.y + g.h - 15.5} r={2.6} fill={dOn ? '#10b981' : '#475569'} />
                  <text x={x0 + cw / 2 + 4} y={g.y + g.h - 12.5} textAnchor="middle" fontSize={9} fill={dOn ? '#e2e8f0' : '#64748b'}>{d.label[fi]}</text>
                </g>
              );
            })}
          </>
        )}
      </g>
    );
  };

  const renderRoof = () =>
    fi === 0 ? (
      <g>
        <polygon points="16,92 300,22 584,92" fill="#0b1324" stroke="#38bdf8" strokeWidth={2} />
        {[0, 8].map((o) => (
          <g key={o} opacity={0.35 + (s.solar / 100) * 0.65}>
            <line x1={60 + o} y1={85 - o * 0.2} x2={280} y2={31 + o} stroke="#10b981" strokeWidth={5} strokeLinecap="round" />
            <line x1={320} y1={31 + o} x2={540 - o} y2={85 - o * 0.2} stroke="#10b981" strokeWidth={5} strokeLinecap="round" />
          </g>
        ))}
        <text x={300} y={78} textAnchor="middle" fontSize={11} fontWeight={700} fill="#e2e8f0" fontFamily="monospace">{`☀ PV ${m.solar.toFixed(1)} kW`}</text>
      </g>
    ) : (
      <g>
        <polygon points="16,92 16,48 130,92 130,48 244,92 244,48 358,92 358,48 472,92 472,48 584,92" fill="#0b1324" stroke="#f59e0b" strokeWidth={2} strokeLinejoin="round" />
        {[16, 130, 244, 358, 472].map((x0) => (
          <line key={x0} x1={x0 + 12} y1={56} x2={x0 + 98} y2={89} stroke="#38bdf8" strokeWidth={5} strokeLinecap="round" opacity={0.35 + (s.solar / 100) * 0.65} />
        ))}
        <text x={300} y={30} textAnchor="middle" fontSize={11} fontWeight={700} fill="#e2e8f0" fontFamily="monospace">{`☀ PV ${m.solar.toFixed(0)} kW • Tie-Bus 400V`}</text>
      </g>
    );

  /* ───────── بيانات اللوحات السفلية ───────── */
  const sk = s.sel;
  const sr = rows[sk];
  const sc = C[sk];
  const gridLabel = m.em ? 'معزول' : m.exp > 0.05 ? `تصدير ${m.exp.toFixed(1)}` : `استيراد ${m.grid.toFixed(1)}`;
  const kpis: { l: string; v: string; c: string }[] = [
    { l: 'الحمل', v: `${m.demand.toFixed(fi ? 0 : 2)} kW`, c: 'text-cyan-300' },
    { l: 'الشمس', v: `${m.solar.toFixed(fi ? 0 : 2)} kW`, c: 'text-emerald-300' },
    { l: 'الشبكة', v: gridLabel, c: m.em ? 'text-rose-300' : 'text-amber-300' },
    { l: fi ? 'BESS' : 'EV', v: `${s.soc.toFixed(0)}%`, c: 'text-violet-300' },
    { l: 'cosφ', v: m.pf.toFixed(2), c: m.pf > 0.95 ? 'text-emerald-300' : 'text-rose-300' },
    { l: 'توفير', v: `$${s.savings.toFixed(2)}`, c: 'text-amber-300' },
  ];
  const scenarios: { id: string; icon: JSX.Element; label: string; active: boolean; on: () => void; tone: string }[] = [
    { id: 'n', icon: <Scale size={13} />, label: 'توازن', active: s.mode === 'normal', on: () => setMode('normal'), tone: 'cyan' },
    { id: 's', icon: <Sun size={13} />, label: 'شمس أقصى', active: s.mode === 'solar', on: () => setMode('solar'), tone: 'emerald' },
    { id: 'e', icon: <BatteryCharging size={13} />, label: fi ? 'طوارئ BESS' : 'طوارئ V2H', active: s.mode === 'emergency', on: () => setMode('emergency'), tone: 'violet' },
    { id: 'f', icon: <Flame size={13} />, label: fi ? 'عطل M3' : 'شورت Q3', active: s.fault.on, on: triggerFault, tone: 'rose' },
    { id: 'l', icon: <CloudLightning size={13} />, label: 'صاعقة 8kV', active: s.surge, on: lightning, tone: 'sky' },
  ];
  const tone: Record<string, string> = {
    cyan: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50',
    emerald: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50',
    violet: 'bg-violet-500/20 text-violet-200 border-violet-400/50',
    rose: 'bg-rose-500/25 text-rose-200 border-rose-400/60',
    sky: 'bg-sky-500/20 text-sky-200 border-sky-400/50',
  };
  const iconBtn = 'inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px] font-bold transition';

  const banner = s.fault.on
    ? { c: 'border-rose-500/70 bg-rose-950/80 text-rose-100', t: fi ? 'حماية انتقائية: عُزل عطل M3 في 0.008 ث وفُعّل إطفاء FM-200 — خطوط الإنتاج مستمرة.' : 'حماية انتقائية: عُزل شورت Q3 في 0.015 ث وأُغلق صمام الغاز — باقي المنزل يعمل بلا انقطاع.', fault: true }
    : s.surge
      ? { c: 'border-sky-500/60 bg-sky-950/70 text-sky-100', t: `صاعقة 8kV: فرّغها SPD ومانع الصواعق عبر بئر التأريض (${fi ? '0.2' : '0.6'}Ω) دون أي أضرار.`, fault: false }
      : m.brownout
        ? { c: 'border-amber-500/60 bg-amber-950/70 text-amber-100', t: 'عجز في الإمداد خلال الطوارئ: فعّل «العقل الآلي» ليفصل الأحمال غير الحرجة، أو ارفع التوليد.', fault: false }
        : m.overKey
          ? { c: 'border-amber-500/60 bg-amber-950/70 text-amber-100', t: `حماية حرارية: حمل زائد على ${m.overKey.split(',').map((k) => lab(k as Key)).join('، ')} — خفّض الحمل لإعادة التوصيل.`, fault: false }
          : null;

  const Slider = ({ label, value, min, onChange, color, suffix }: { label: string; value: number; min: number; onChange: (v: number) => void; color: string; suffix?: string }) => (
    <label className="block">
      <span className="mb-0.5 flex justify-between text-[11px]">
        <span className="text-slate-300">{label}</span>
        <span className={cx('font-mono font-bold', color)}>{value}%{suffix}</span>
      </span>
      <input type="range" min={min} max={100} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} className="h-1.5 w-full cursor-pointer accent-cyan-400" />
    </label>
  );

  const panel = 'rounded-xl border border-slate-800 bg-slate-900/70 p-2.5';
  const harm = [
    { n: 'h1', v: 100 }, { n: 'h3', v: m.thd * 0.35 }, { n: 'h5', v: m.thd * 0.7 }, { n: 'h7', v: m.thd * 0.5 }, { n: 'h11', v: m.thd * 0.3 },
  ];

  return (
    <section
      dir="rtl"
      aria-label="محاكي الطابلو الذكي — توأم رقمي للمنزل والمصنع"
      className={cx('select-none overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl shadow-cyan-950/30', className)}
    >
      <style>{CSS}</style>

      {/* الشريط العلوي */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-gradient-to-l from-slate-900 to-slate-950 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/30 bg-gradient-to-br from-cyan-500 via-blue-600 to-emerald-500">
            <Zap size={16} className="text-white" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full border border-slate-900 bg-emerald-400" />
          </div>
          <div className="leading-tight">
            <h2 className="text-[13px] font-black">
              التوأم الرقمي: <span className="bg-gradient-to-l from-cyan-300 via-emerald-300 to-amber-300 bg-clip-text text-transparent">{fi ? 'لوحة MCC للمصنع الذكي' : 'طابلو المنزل الذكي 3-فاز'}</span>
            </h2>
            <p className="text-[10px] text-emerald-300/80">يعمل 24/7 • انقر أي غرفة أو قاطع أو جهاز للتحكم</p>
          </div>
        </div>

        <div className="flex items-center gap-0.5 rounded-xl border border-cyan-500/30 bg-slate-950 p-0.5" role="group" aria-label="نقطة التحول">
          {([['home', 'المنزل', <Home key="h" size={13} />], ['factory', 'المصنع', <Factory key="f" size={13} />]] as const).map(([id, name, icon]) => (
            <button
              key={id} type="button" onClick={() => setFac(id)} aria-pressed={s.fac === id}
              className={cx('inline-flex h-7 items-center gap-1 rounded-lg px-3 text-[11px] font-black transition', s.fac === id ? (id === 'home' ? 'bg-gradient-to-l from-cyan-400 to-emerald-400 text-slate-950' : 'bg-gradient-to-l from-amber-400 to-cyan-400 text-slate-950') : 'text-slate-300 hover:bg-slate-800')}
            >{icon}{name}</button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <button type="button" onClick={() => patch({ ai: !s.ai })} aria-pressed={s.ai} className={cx(iconBtn, s.ai ? 'border-emerald-300 bg-gradient-to-l from-emerald-400 to-cyan-400 text-slate-950' : 'border-slate-700 bg-slate-800 text-slate-400')}><Cpu size={13} />{s.ai ? 'العقل الآلي ✓' : 'يدوي'}</button>
          <button type="button" onClick={() => patch({ thermal: !s.thermal })} aria-pressed={s.thermal} className={cx(iconBtn, s.thermal ? 'border-rose-500 bg-rose-950 text-rose-200' : 'border-amber-500/30 bg-slate-800 text-amber-300')}><Thermometer size={13} />IR</button>
          <button type="button" onClick={toggleSound} aria-label="الصوت" aria-pressed={s.sound} className={cx(iconBtn, 'border-slate-700 bg-slate-800 px-1.5', s.sound ? 'text-cyan-300' : 'text-slate-400')}>{s.sound ? <Volume2 size={14} /> : <VolumeX size={14} />}</button>
          <button type="button" onClick={() => patch({ collapsed: !s.collapsed })} aria-label={s.collapsed ? 'توسيع' : 'طيّ'} aria-expanded={!s.collapsed} className={cx(iconBtn, 'border-slate-700 bg-slate-800 px-1.5 text-slate-300')}>{s.collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</button>
        </div>
      </header>

      {/* مؤشرات حية + سيناريوهات */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950 px-3 py-1.5">
        <dl className="flex flex-wrap items-center gap-1" aria-live="off">
          {kpis.map((k) => (
            <div key={k.l} className="flex items-baseline gap-1 rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-0.5">
              <dt className="text-[10px] text-slate-500">{k.l}</dt>
              <dd className={cx('font-mono text-[11px] font-bold', k.c)}>{k.v}</dd>
            </div>
          ))}
        </dl>
        {!s.collapsed && (
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="السيناريوهات">
            {scenarios.map((b) => (
              <button key={b.id} type="button" onClick={b.on} aria-pressed={b.active} className={cx(iconBtn, b.active ? tone[b.tone] : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800')}>{b.icon}{b.label}</button>
            ))}
          </div>
        )}
      </div>

      {!s.collapsed && (
        <>
          {banner && (
            <div role="alert" className={cx('flex flex-wrap items-center justify-between gap-2 border-b px-3 py-1.5 text-[11px]', banner.c)}>
              <span className="flex items-center gap-1.5 font-bold"><ShieldAlert size={14} className={banner.fault ? 'animate-bounce' : undefined} />{banner.t}</span>
              {banner.fault && (
                <span className="flex items-center gap-1.5">
                  <span className="rounded-md border border-cyan-500/30 bg-slate-950 px-2 py-0.5 font-mono text-cyan-300">{s.ai ? `إعادة توصيل آلي خلال ${s.fault.left}ث` : 'يدوي: بانتظار الفني'}</span>
                  <button type="button" onClick={resetFault} className="inline-flex items-center gap-1 rounded-md bg-gradient-to-l from-emerald-400 to-cyan-400 px-2 py-0.5 font-black text-slate-950"><RotateCcw size={12} />إعادة ضبط</button>
                </span>
              )}
            </div>
          )}

          {/* المخطط */}
          <div className="overflow-x-auto bg-[#040812] p-1">
            <svg viewBox="0 0 1000 380" className="mx-auto block h-auto w-full min-w-[760px] max-w-[1100px]" style={{ direction: 'ltr' }} role="group" aria-label="مخطط الطابلو وهيكل المبنى">
              <defs>
                <linearGradient id="vx-tab" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#0b1120" />
                  <stop offset="1" stopColor="#020617" />
                </linearGradient>
              </defs>

              {renderRoof()}
              <line x1={560} y1={85} x2={560} y2={63} stroke="#38bdf8" strokeWidth={2.5} />
              <circle cx={560} cy={63} r={3.5} fill="#38bdf8" />
              <rect x={16} y={92} width={568} height={282} rx={6} fill="#050912" stroke="#1e293b" strokeWidth={2} />

              {/* الأسلاك */}
              {KEYS.map((k) => {
                const r = rows[k];
                const d = wirePath(k, fi);
                const flowing = r.powered && r.kw > 0.02;
                const bad = r.faulted || r.overload;
                return (
                  <g key={k}>
                    <path d={d} fill="none" stroke="#111a2c" strokeWidth={5} strokeLinejoin="round" />
                    <path
                      d={d} fill="none" strokeWidth={2.4} strokeLinejoin="round"
                      stroke={bad ? '#f43f5e' : r.src ? '#c084fc' : flowing ? C[k].color : '#334155'}
                      opacity={flowing || bad ? 1 : 0.5}
                      className={bad ? 'vx-fault' : flowing ? cx('vx-flow', r.src && 'rev') : undefined}
                    />
                  </g>
                );
              })}

              {(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'] as Key[]).map(renderRoom)}

              {/* بئر التأريض */}
              <g>
                <rect x={E.x} y={312} width={E.w} height={60} rx={8} fill="#061612" stroke="#10b981" strokeWidth={1.4} className={s.surge ? 'vx-fault' : undefined} />
                <g stroke="#10b981" strokeWidth={2.4} strokeLinecap="round">
                  <line x1={E.x + 22} y1={326} x2={E.x + 22} y2={342} />
                  <line x1={E.x + 12} y1={342} x2={E.x + 32} y2={342} />
                  <line x1={E.x + 16} y1={348} x2={E.x + 28} y2={348} />
                  <line x1={E.x + 20} y1={354} x2={E.x + 24} y2={354} />
                </g>
                <text x={E.x + 42} y={336} fontSize={10.5} fontWeight={700} fill="#34d399">تأريض PE</text>
                <text x={E.x + 42} y={354} fontSize={11} fontWeight={700} fill="#fff" fontFamily="monospace">{`R=${fi ? '0.2' : '0.6'}Ω`}</text>
              </g>
              {s.surge && (
                <path d={`M560 63 H594 V350 H${E.x + E.w / 2}`} fill="none" stroke="#7dd3fc" strokeWidth={3} className="vx-flow" />
              )}

              {/* الطابلو */}
              <g>
                <rect x={644} y={8} width={348} height={366} rx={14} fill="url(#vx-tab)" stroke={accent} strokeWidth={2.4} />
                <text x={818} y={28} textAnchor="middle" fontSize={12.5} fontWeight={800} fill="#fff">{fi ? 'لوحة القوى الصناعية MCC / SCADA' : 'طابلو التوزيع الذكي 3-فاز'}</text>
                <text x={818} y={41} textAnchor="middle" fontSize={8.5} fill={accent} fontFamily="monospace">{fi ? 'ACB 400A • VFD • APFC • BESS 500kWh • AUTO-RECLOSER' : 'ATS 8ms • V2H • SPD 40kA • AFDD • AUTO-RECLOSER'}</text>

                {/* ATS */}
                <rect x={652} y={48} width={332} height={34} rx={8} fill="#091120" stroke={m.em ? '#a855f7' : '#10b981'} strokeWidth={1.4} />
                {([
                  ['GRID', !m.em, '#10b981'],
                  ['PV', m.solar > 0.05, '#fbbf24'],
                  [fi ? 'BESS' : 'EV', m.discharge > 0 || (m.exp > 0.05 && !m.em), m.discharge > 0 ? '#c084fc' : '#10b981'],
                ] as [string, boolean, string][]).map(([t, a, col], i) => (
                  <g key={t}>
                    <rect x={658 + i * 52} y={56} width={48} height={18} rx={9} fill={a ? col : '#1e293b'} opacity={a ? 0.95 : 0.6} />
                    <text x={682 + i * 52} y={68.5} textAnchor="middle" fontSize={9.5} fontWeight={800} fill={a ? '#020617' : '#64748b'} fontFamily="monospace">{t}</text>
                  </g>
                ))}
                <text x={978} y={62} textAnchor="end" fontSize={10.5} fontWeight={700} fill="#fff" fontFamily="monospace">{`${fi ? '400V 3Ø' : '230V'} • 50Hz • ${m.demand.toFixed(fi ? 1 : 2)}kW`}</text>
                <text x={978} y={75} textAnchor="end" fontSize={9} fill={m.em ? '#d8b4fe' : '#6ee7b7'} fontFamily="monospace">{m.em ? 'ISLANDED • ATS → BATT' : `ONLINE • ATS 8ms`}</text>

                {/* أشرطة الأطوار */}
                {(['L1', 'L2', 'L3'] as const).map((p, i) => {
                  const col = p === 'L1' ? '#f43f5e' : p === 'L2' ? '#f59e0b' : '#38bdf8';
                  const v = m.P[p];
                  return (
                    <g key={p}>
                      <rect x={652 + i * 112} y={87} width={106} height={15} rx={4} fill="#040b16" stroke="#1e293b" />
                      <rect x={652 + i * 112} y={87} width={106 * Math.min(1, v / (fi ? 200 : 40))} height={15} rx={4} fill={col} opacity={0.28} />
                      <text x={658 + i * 112} y={98} fontSize={9.5} fontWeight={800} fill={col} fontFamily="monospace">{`${p}  ${v.toFixed(fi ? 0 : 1)}A`}</text>
                    </g>
                  );
                })}
                <text x={984} y={98} textAnchor="end" fontSize={8.5} fill={m.imb < 10 ? '#34d399' : '#fb7185'} fontFamily="monospace">{`${m.imb.toFixed(0)}%`}</text>

                {/* القواطع */}
                {KEYS.map((k, i) => {
                  const r = rows[k];
                  const c = C[k];
                  const y = 106 + i * 42;
                  const state = r.faulted ? 'TRIP' : r.overload ? 'OVLD' : r.shed ? 'SHED' : r.src ? (fi ? 'BESS' : 'V2H') : r.powered ? 'ON' : 'OFF';
                  const swFill = r.faulted || r.overload ? '#f43f5e' : r.shed ? '#f59e0b' : r.src ? '#a855f7' : r.powered ? '#10b981' : '#334155';
                  const ph = m.phases[k];
                  return (
                    <g key={k} className="vx-node" aria-label={`قاطع ${lab(k)} ${state}`} {...act(() => toggleBreaker(k))}>
                      <rect x={652} y={y} width={332} height={38} rx={7} fill="#0f172a" stroke={r.faulted || r.overload ? '#f43f5e' : r.src ? '#c084fc' : r.powered ? c.color : '#334155'} strokeWidth={s.sel === k ? 2.4 : 1.4} className={r.faulted ? 'vx-fault' : undefined} />
                      <rect x={658} y={y + 6} width={36} height={26} rx={5} fill={swFill} />
                      <text x={676} y={y + 23} textAnchor="middle" fontSize={10} fontWeight={800} fill={r.powered || r.src ? '#022c22' : '#e2e8f0'} fontFamily="monospace">{state}</text>
                      <text x={702} y={y + 16} fontSize={10.5} fontWeight={700} fill="#fff">{`${lab(k)}: ${c.short[fi]}`}</text>
                      <text x={702} y={y + 29} fontSize={8.5} fill="#94a3b8" fontFamily="monospace">{`${c.rating[fi]}A • ${ph}${ph !== m.base[k] ? '*' : ''} • ${r.temp.toFixed(1)}°C`}</text>
                      <text x={976} y={y + 18} textAnchor="end" fontSize={12.5} fontWeight={800} fill={r.src ? '#c084fc' : r.faulted ? '#fb7185' : c.color} fontFamily="monospace">
                        {r.faulted ? 'FAULT!' : r.powered ? `${r.src ? '−' : ''}${r.amps.toFixed(1)}A` : '0.0A'}
                      </text>
                      <text x={976} y={y + 30} textAnchor="end" fontSize={8.5} fill="#64748b" fontFamily="monospace">{r.powered ? `${r.kw.toFixed(fi ? 1 : 2)}kW` : ''}</text>
                      <rect x={702} y={y + 33} width={Math.max(0, 270 * Math.min(1, r.pct))} height={2} rx={1} fill={r.pct > 0.9 ? '#f43f5e' : c.color} opacity={0.7} />
                    </g>
                  );
                })}
              </g>

              {s.surge && <rect x={0} y={0} width={1000} height={380} fill="#e0f2fe" className="vx-flash" pointerEvents="none" />}
            </svg>
          </div>

          {/* تبويبات الجوال */}
          <div className="flex gap-1 border-t border-slate-800 bg-slate-950 px-3 pt-2 md:hidden" role="tablist">
            {([['insp', 'الفاحص'], ['scope', 'الأمواج'], ['loads', 'الأحمال']] as const).map(([id, t]) => (
              <button key={id} type="button" role="tab" aria-selected={s.tab === id} onClick={() => patch({ tab: id })} className={cx('flex-1 rounded-lg border px-2 py-1 text-[11px] font-bold', s.tab === id ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200' : 'border-slate-800 text-slate-400')}>{t}</button>
            ))}
          </div>

          {/* اللوحات السفلية */}
          <div className="grid grid-cols-1 gap-2 p-2 md:grid-cols-3">
            {/* الفاحص */}
            <div className={cx(panel, s.tab === 'insp' ? 'block' : 'hidden', 'md:block')}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold" style={{ color: sc.color, borderColor: `${sc.color}66`, background: `${sc.color}22` }}>{`${lab(sk)} · ${m.phases[sk]}`}</span>
                  <h3 className="truncate text-[12px] font-bold">{sc.name[fi]}</h3>
                </div>
                <button type="button" onClick={() => toggleBreaker(sk)} className={cx('inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold', sr.on ? 'border-rose-500/40 bg-rose-500/15 text-rose-300' : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300')}><Zap size={12} />{sr.on ? 'فصل' : 'توصيل'}</button>
              </div>
              <p className="mb-1.5 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-[10px] text-cyan-300">{sc.spec[fi]}</p>
              <p className="mb-2 text-[11px] leading-relaxed text-slate-400">{sc.desc[fi]}</p>
              <div className="grid grid-cols-4 gap-1 text-center">
                {[
                  ['kW', sr.powered ? sr.kw.toFixed(fi ? 1 : 2) : '0'],
                  ['A', `${sr.powered ? sr.amps.toFixed(1) : '0'}/${sc.rating[fi]}`],
                  ['°C', sr.temp.toFixed(0)],
                  ['حمل', `${Math.round(sr.pct * 100)}%`],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-lg border border-slate-800 bg-slate-950 py-1">
                    <div className="font-mono text-[11px] font-bold text-slate-100">{v}</div>
                    <div className="text-[9px] text-slate-500">{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* الأمواج */}
            <div className={cx(panel, s.tab === 'scope' ? 'block' : 'hidden', 'md:block')}>
              <div className="mb-1.5 flex items-center justify-between gap-1">
                <h3 className="flex items-center gap-1 text-[12px] font-bold"><Activity size={13} className="text-cyan-400" />راسم الموجات</h3>
                <div className="flex items-center gap-0.5 rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-[10px]">
                  {(['3p', 'vi'] as const).map((id) => (
                    <button key={id} type="button" onClick={() => patch({ scope: id })} className={cx('rounded px-1.5 py-0.5 font-bold', s.scope === id ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400')}>{id === '3p' ? '3-فاز' : 'V/I'}</button>
                  ))}
                  <button type="button" onClick={() => patch({ ahf: !s.ahf })} aria-pressed={s.ahf} className={cx('rounded border px-1.5 py-0.5 font-bold', s.ahf ? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-300' : 'border-rose-500/30 bg-rose-500/20 text-rose-300')}>AHF {s.ahf ? '✓' : '✗'}</button>
                </div>
              </div>
              <div className="flex gap-1.5">
                <div className="h-[84px] flex-1 overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                  <Scope mode={s.scope} dist={s.ahf ? 0.02 : fi ? 0.22 : 0.1} pf={m.pf} alive />
                </div>
                <div className="flex h-[84px] w-20 items-end gap-1 rounded-lg border border-slate-800 bg-slate-950 px-1.5 pb-1" aria-label="طيف التوافقيات">
                  {harm.map((h) => (
                    <div key={h.n} className="flex h-full flex-1 flex-col items-center justify-end gap-0.5">
                      <div className="w-full rounded-t-sm" style={{ height: `${Math.max(3, Math.min(100, h.n === 'h1' ? 100 : h.v * 10))}%`, background: h.n === 'h1' ? '#22d3ee' : s.ahf ? '#10b981' : '#f43f5e' }} />
                      <span className="text-[7px] text-slate-500">{h.n}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-1.5 flex justify-between rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-400">
                <span>THD: <b className={cx('font-mono', s.ahf ? 'text-emerald-400' : 'text-rose-400')}>{m.thd.toFixed(1)}%</b></span>
                <span>cosφ: <b className="font-mono text-cyan-400">{m.pf.toFixed(2)}</b></span>
                <span>توازن: <b className={cx('font-mono', m.imb < 10 ? 'text-emerald-400' : 'text-amber-400')}>{m.imb.toFixed(0)}%</b></span>
              </div>
            </div>

            {/* الأحمال والسجل */}
            <div className={cx(panel, 'space-y-1.5', s.tab === 'loads' ? 'block' : 'hidden', 'md:block')}>
              <Slider label={fi ? 'الإشعاع الشمسي (170kWp)' : 'الإشعاع الشمسي (6.4kWp)'} value={s.solar} min={0} onChange={(v) => patch({ solar: v })} color="text-emerald-400" />
              <Slider label="أحمال التكييف والتدفئة" value={s.hvac} min={10} onChange={(v) => patch({ hvac: v })} color="text-cyan-300" />
              <Slider label={fi ? 'أحمال الأفران والضواغط' : 'أحمال المطبخ والمضخات'} value={s.heavy} min={10} onChange={(v) => patch({ heavy: v })} color="text-amber-300" />
              <ul className="space-y-0.5 rounded-lg border border-slate-800 bg-slate-950 p-1.5 font-mono text-[10px]" aria-live="polite">
                {s.log.slice(0, 3).map((l, i) => (
                  <li key={`${l.t}-${i}`} className={cx('truncate', l.lvl === 'fault' ? 'text-rose-300' : l.lvl === 'warn' ? 'text-amber-300' : l.lvl === 'ok' ? 'text-emerald-300' : 'text-cyan-300', i > 0 && 'opacity-60')}>[{l.t}] {l.msg}</li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export { SmartTableauSimulator };
