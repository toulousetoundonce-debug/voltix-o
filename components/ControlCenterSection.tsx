"use client";

import { useMemo, useState } from "react";
import { useSiteActions } from "./SiteActionsProvider";

const TABS = [
  { id: "smarthome", label: "🏠 لوحة المنزل الذكي" },
  { id: "industrial", label: "🏭 خزانة التحكم الصناعي" },
  { id: "cctv", label: "📹 الدرع الأمني والكاميرات" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type SmartState = {
  cinema: boolean;
  hvac: boolean;
  valves: boolean;
  night: boolean;
};

const initialSmartState: SmartState = {
  cinema: false,
  hvac: true,
  valves: false,
  night: true,
};

export default function ControlCenterSection() {
  const [activeTab, setActiveTab] = useState<TabId>("smarthome");
  const [smartState, setSmartState] = useState<SmartState>(initialSmartState);
  const [voltageDrop, setVoltageDrop] = useState(false);
  const { openSos, openCalculator } = useSiteActions();

  const smartKw = useMemo(() => {
    const baseKw = 5.4;
    const delta =
      (smartState.cinema ? -0.65 : 0) +
      (smartState.hvac ? -1.45 : 0) +
      (smartState.valves ? -0.35 : 0) +
      (smartState.night ? -0.4 : 0);
    return Math.max(1.8, Number((baseKw + delta).toFixed(2)));
  }, [smartState]);

  const smartSave = useMemo(() => {
    const baseKw = 5.4;
    return Math.round(((baseKw - smartKw) / baseKw) * 100);
  }, [smartKw]);

  const toggleSmart = (key: keyof SmartState) => {
    setSmartState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const panel = {
    smarthome: (
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-4">
            <div>
              <h3 className="text-lg font-black text-white sm:text-xl">خادم المنزل الذكي المحلي</h3>
              <p className="mt-1 text-xs text-slate-400 sm:text-sm">تجربة الأتمتة اللحظية ومراقبة التوفير المباشر</p>
            </div>
            <span dir="ltr" className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-extrabold text-emerald-300">
              LOCAL OFFLINE-READY
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { key: "cinema", label: "سيناريو السينما", icon: "🎬", desc: "تعتيم الإضاءة 85% وتشغيل الإضاءة المحيطية", on: smartState.cinema },
              { key: "hvac", label: "تكييف ذكي موفر للطاقة", icon: "❄️", desc: "ضبط درجة الحرارة حسب التواجد وتقليل ذروة الاستهلاك", on: smartState.hvac },
              { key: "valves", label: "إغلاق المحابس والستائر", icon: "🔒", desc: "قفل محابس المياه والغاز وإسدال الستائر العازلة", on: smartState.valves },
              { key: "night", label: "وضع الحماية الليلي", icon: "🛡️", desc: "تفعيل الحماية الليلة وتسجيل الأحداث محلياً", on: smartState.night },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => toggleSmart(item.key as keyof SmartState)}
                className={`flex flex-col justify-between rounded-2xl border p-4 text-right transition ${
                  item.on ? "border-electric-blue bg-electric-blue/15 shadow-glow-blue" : "border-white/10 bg-grid-dark/80"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xl">{item.icon}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${item.on ? "bg-electric-blue text-grid-dark" : "bg-white/10 text-slate-400"}`}>
                    {item.on ? "مُفعّل ON" : "مُطفأ OFF"}
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-sm font-extrabold text-white">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="readout grid grid-cols-2 gap-3 rounded-2xl border border-electric-blue/30 p-4">
            <div>
              <span className="text-xs font-bold text-slate-400">عداد استهلاك الكهرباء اللحظي</span>
              <p dir="ltr" className="mt-1 text-2xl font-black text-electric-blue sm:text-3xl">
                <span>{smartKw.toFixed(2)}</span> <span className="text-sm font-bold">kW</span>
              </p>
              <span className="text-[11px] text-slate-400">الحمل القياسي قبل الأتمتة: 5.40 kW</span>
            </div>
            <div className="border-r border-white/10 pr-4">
              <span className="text-xs font-bold text-slate-400">نسبة التوفير الفوري</span>
              <p dir="ltr" className="mt-1 text-2xl font-black text-emerald-400 sm:text-3xl">
                <span>{smartSave}</span>%
              </p>
              <span className="text-[11px] text-emerald-300/90">استجابة محلية خلال 0.8ms بدون سحابة</span>
            </div>
          </div>
        </div>

        <div className="surface flex flex-col justify-between p-4 lg:col-span-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs font-bold">
            <span className="text-white">المخطط التفاعلي للفيلا الذكية</span>
            <span dir="ltr" className="text-electric-blue">DOCKER CORE: 192.168.10.5</span>
          </div>
          <div className="my-3 overflow-hidden rounded-xl bg-[#070b12] p-3">
            <svg viewBox="0 0 460 240" className="h-auto w-full">
              <rect x="8" y="8" width="444" height="224" rx="14" fill="none" stroke="#00E5FF" strokeWidth="2" strokeDasharray="10 6" />
              <polygon points="35,62 230,16 425,62" fill="#111827" stroke="#00E5FF" strokeWidth="2" />
              <rect x="45" y="62" width="370" height="155" rx="6" fill="#0B111E" stroke="#334155" strokeWidth="2" />
              <line x1="230" y1="62" x2="230" y2="217" stroke="#334155" strokeWidth="2" />
              <line x1="45" y1="140" x2="415" y2="140" stroke="#334155" strokeWidth="2" />
              <text x="322" y="88" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="800">صالة المعيشة والسينما</text>
              <text x="322" y="110" textAnchor="middle" fill={smartState.cinema ? "#FDE047" : "#FFFFFF"} fontSize="10" fontWeight="700">
                {smartState.cinema ? "🎬 سيناريو السينما (إضاءة 15%)" : "💡 إضاءة قياسية (100%)"}
              </text>
              <text x="137" y="88" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="800">منطقة التكييف الذكي</text>
              <text x="137" y="110" textAnchor="middle" fill={smartState.hvac ? "#00E5FF" : "#94A3B8"} fontSize="10" fontWeight="700">
                {smartState.hvac ? "❄️ 22°C Eco Inverter (-35%)" : "🌡️ 18°C استهلاك مرتفع"}
              </text>
              <text x="322" y="168" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="800">الستائر ومحابس الأمان</text>
              <text x="322" y="190" textAnchor="middle" fill={smartState.valves ? "#00E5FF" : "#94A3B8"} fontSize="10" fontWeight="700">
                {smartState.valves ? "🔒 المحابس مغلقة والستائر منسدلة" : "🔓 المحابس والستائر مفتوحة"}
              </text>
              <text x="137" y="168" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="800">خادم Local Server والحماية</text>
              <text x="137" y="190" textAnchor="middle" fill={smartState.night ? "#00E5FF" : "#94A3B8"} fontSize="10" fontWeight="700">
                {smartState.night ? "🛡️ رادار المحيط الليلي مُفعّل 100%" : "⚪ الحماية الليلية في وضع الاستعداد"}
              </text>
            </svg>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>جميع الأوامر تُعالج محلياً داخل المنزل دون أي اعتماد على السحابة.</span>
            <button type="button" onClick={openCalculator} className="min-h-11 font-extrabold text-electric-blue hover:underline">احسب تكلفة أتمتة منزلك ←</button>
          </div>
        </div>
      </div>
    ),
    industrial: (
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-4">
            <div>
              <h3 className="text-lg font-black text-white sm:text-xl">وحدة مراقبة خزانة التحكم الصناعية</h3>
              <p className="mt-1 text-xs text-slate-400">قراءات حية لجهد الشبكة 380V، حرارة القواطع، وحماية المحركات</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${voltageDrop ? "border-sos-red/40 bg-sos-red/10 text-red-300" : "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"}`}>
              {voltageDrop ? "⚠️ محاكاة هبوط جهد — تدخل الحماية" : "✅ النظام متوازن ومؤمّن"}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="readout">
              <span className="text-xs text-slate-400">الجهد الثلاثي (Три فاز)</span>
              <p dir="ltr" className={`mt-2 text-xl font-black ${voltageDrop ? "text-red-300" : "text-white"}`}>
                L1: 381V | L2: 380V | L3: {voltageDrop ? "332V" : "379V"}
              </p>
            </div>
            <div className="readout">
              <span className="text-xs text-slate-400">توازن الأحمال</span>
              <p dir="ltr" className={`mt-2 text-2xl font-black ${voltageDrop ? "text-amber-300" : "text-emerald-400"}`}>
                {voltageDrop ? "83.0% Unbalanced" : "99.1% Balanced"}
              </p>
            </div>
            <div className="readout">
              <span className="text-xs text-slate-400">حرارة القواطع</span>
              <p dir="ltr" className={`mt-2 text-2xl font-black ${voltageDrop ? "text-amber-300" : "text-electric-blue"}`}>
                {voltageDrop ? "68.4 °C (تحذير)" : "35.8 °C (مثالي)"}
              </p>
            </div>
            <div className="readout">
              <span className="text-xs text-slate-400">حالة المحركات</span>
              <p className="mt-2 text-lg font-black text-white">
                {voltageDrop ? "الحماية نشطة — تم فصل المحرك افتراضياً" : "محمية — 1480 RPM | Cos φ 0.96"}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => setVoltageDrop(false)} className="btn-command-blue flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black text-grid-dark">
              🛡️ إعادة النظام إلى حالة التوازن
            </button>
            <button type="button" onClick={() => setVoltageDrop((current) => !current)} aria-pressed={voltageDrop} className="rounded-2xl border border-white/15 bg-white/5 px-4 py-4 text-xs font-extrabold text-slate-200 hover:bg-white/10">
              {voltageDrop ? "✅ إعادة الجهد الطبيعي" : "🔄 اختبار سيناريو هبوط جهد مفاجئ"}
            </button>
          </div>
        </div>

        <div className="surface flex flex-col justify-between p-4 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs font-bold">
            <span className="text-white">مخطط خزانة التحكم</span>
            <span dir="ltr" className={voltageDrop ? "text-red-300" : "text-emerald-400"}>
              {voltageDrop ? "STATUS: VOLTAGE DROP" : "STATUS: NOMINAL 380V"}
            </span>
          </div>
          <div className="my-3 overflow-hidden rounded-xl bg-[#070b12] p-3 text-center">
            <svg viewBox="0 0 380 210" className="h-auto w-full">
              <line x1="30" y1="28" x2="350" y2="28" stroke="#00E5FF" strokeWidth="3" />
              <line x1="30" y1="44" x2="350" y2="44" stroke="#00E5FF" strokeWidth="3" />
              <line x1="30" y1="60" x2="350" y2="60" stroke="#00E5FF" strokeWidth="3" />
              <rect x="45" y="80" width="125" height="58" rx="8" fill="#111827" stroke="#00E5FF" strokeWidth="2" />
              <text x="107" y="105" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="800">حماية الفاز والأحمال</text>
              <text x="107" y="123" textAnchor="middle" fill="#34D399" fontSize="9.5" fontWeight="700">Phase Relay: ACTIVE</text>
              <rect x="205" y="80" width="135" height="58" rx="8" fill="#111827" stroke="#00E5FF" strokeWidth="2" />
              <text x="272" y="105" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="800">وحدة PLC &amp; Contactor</text>
              <text x="272" y="123" textAnchor="middle" fill="#00E5FF" fontSize="9.5" fontWeight="700">Auto Load Balancing</text>
              <circle cx="190" cy="175" r="28" fill="#111827" stroke="#34D399" strokeWidth="2.5" />
              <text x="190" y="179" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="800">MOTOR 3~</text>
            </svg>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>هل تواجه توقفاً طارئاً في لوحة تحكم مصنعك؟</span>
            <button type="button" onClick={openSos} className="font-extrabold text-sos-red hover:underline">اطلب تدخل طوارئ SOS فوري ⚡</button>
          </div>
        </div>
      </div>
    ),
    cctv: (
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-6">
          <h3 className="text-lg font-black text-white sm:text-xl">هندسة الدرع الأمني وعزل شبكات المراقبة</h3>
          <div className="flex w-full items-center justify-between gap-4 rounded-2xl border border-electric-blue bg-electric-blue/15 p-4 text-right shadow-glow-blue transition">
            <div>
              <p className="text-sm font-extrabold text-white sm:text-base">🛡️ عزل شبكة الكاميرات VLAN ضد الاختراق</p>
              <p className="mt-1 text-xs text-slate-300">مُفعّل: الكاميرات معزولة في شبكة VLAN 40 مستقلة ومشفرة بالكامل.</p>
            </div>
            <span className="shrink-0 rounded-full bg-electric-blue px-3 py-1 text-xs font-extrabold text-grid-dark">VLAN نشط</span>
          </div>

          <div className="flex w-full items-center justify-between gap-4 rounded-2xl border border-electric-blue bg-electric-blue/15 p-4 text-right shadow-glow-blue transition">
            <div>
              <p className="text-sm font-extrabold text-white sm:text-base">⚡ معالجة هبوط الجهد Voltage Drop للكابلات الطويلة</p>
              <p className="mt-1 text-xs text-slate-300">مُفعّل: تغذية PoE+/12V Regulated تضمن ثبات الرؤية الليلية</p>
            </div>
            <span dir="ltr" className="shrink-0 rounded-full bg-electric-blue px-3 py-1 text-xs font-extrabold text-grid-dark">12.0V Stable</span>
          </div>

          <div className="readout">
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-white">مؤشر جودة الإشارة والأمان السيبراني</span>
              <span dir="ltr" className="text-2xl font-black text-emerald-400">100%</span>
            </div>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-full rounded-full bg-emerald-400" />
            </div>
          </div>
        </div>

        <div className="surface flex flex-col justify-between p-4 lg:col-span-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs font-bold">
            <span className="text-white">معاينة البث الشبكي وهندسة التمديد</span>
            <span dir="ltr" className="text-emerald-400">CAM-04 PERIMETER • 100% QUALITY</span>
          </div>
          <div className="my-4 rounded-xl border border-white/10 bg-[#070b12] p-5 text-center">
            <p className="text-sm font-black text-electric-blue">🔒 VLAN 40 ISOLATED • 12.0V REGULATED</p>
            <p className="mt-2 text-xs text-slate-400">بث ليلي 4K HDR مستقر بدون تشويش أو هبوط فولتية، مع حماية جدار ناري سيبراني.</p>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>احمِ منشأتك بمنظومة مراقبة لا تنقطع ولا تُخترق.</span>
            <button type="button" onClick={openCalculator} className="min-h-11 font-extrabold text-electric-blue hover:underline">اطلب دراسة منظومة CCTV ←</button>
          </div>
        </div>
      </div>
    ),
  };

  return (
    <section id="control-center" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-electric-blue/30 bg-electric-blue/10 px-4 py-1 text-xs font-extrabold text-electric-blue sm:text-sm">
          محاكاة تفاعلية توضيحية
        </p>
        <h2 className="mt-4 text-2xl font-black text-white sm:text-4xl">جرّب هندستنا بنفسك: محاكي غرفة التحكم الذكية والصناعية</h2>
        <p className="mt-3 text-base leading-loose text-slate-400">
          جرّب أمثلة على المنزل الذكي والتحكم الصناعي والمراقبة. هذه محاكاة تعليمية وليست قياساً مباشراً لمنزلك أو منشأتك؛ اطلب دراسة لتقييم احتياجك الفعلي.
        </p>
      </div>

      <div className="mx-auto mt-8 grid max-w-4xl gap-2.5 sm:grid-cols-3" role="tablist">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-sm font-extrabold ${
                active ? "border-electric-blue bg-electric-blue text-grid-dark shadow-glow-blue" : "border-white/10 bg-grid-card/80 text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="cyber-glass-card control-console mt-6 overflow-hidden rounded-3xl p-5 shadow-2xl sm:p-8">
        <div className="mb-5">
          <span className="badge-tech">
            <span className="led" aria-hidden="true" />
            قيم محاكاة
          </span>
        </div>
        {panel[activeTab]}
      </div>
    </section>
  );
}
