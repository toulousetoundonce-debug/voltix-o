"use client";

import { useMemo, useState } from "react";
import { useSiteActions } from "./SiteActionsProvider";

const FAULTS = [
  {
    id: "cctv_flicker",
    icon: "📹",
    label: "أنظمة المراقبة CCTV",
    title: "توقف بعض كاميرات المراقبة أو تشوش الصورة ليلاً",
  },
  {
    id: "breaker_trip",
    icon: "⚡",
    label: "طوارئ كهربائية وحماية",
    title: "سقوط متكرر للقاطع الكهربائي أو سخونة في الطبلون",
  },
  {
    id: "smart_retrofit",
    icon: "🏠",
    label: "أتمتة ومنازل ذكية",
    title: "رغبة في تحويل منزل قائم إلى منزل ذكي بدون تكسير الجدران",
  },
  {
    id: "industrial_stop",
    icon: "🏭",
    label: "كهرباء صناعية و PLC",
    title: "توقف خط إنتاج أو عطل في لوحة تحكم مصنع (Armoire)",
  },
] as const;

const FAULT_DATA: Record<string, { severity: string; cause: string; solution: string; action: "sos" | "calc"; button: string }> = {
  cctv_flicker: {
    severity: "خطورة أمنية متوسطة إلى عالية — ثغرة في التغطية الليلية",
    cause: "هبوط حاد في الجهد الكهربائي عبر الكابلات الطويلة عند تشغيل الأشعة تحت الحمراء ليلاً، بالإضافة لأكسدة الوصلات.",
    solution: "إعادة حساب مسارات التغذية وهبوط الجهد، تركيب وحدات تغذية مستقرة، وعزل الشبكة عبر VLAN.",
    action: "calc",
    button: "احسب تكلفة تحديث وتأمين منظومة الكاميرات 📊",
  },
  breaker_trip: {
    severity: "خطورة قصوى — احتمال نشوب حريق كهربائي أو تلف الأجهزة",
    cause: "عدم توازن الأحمال بين الدارات، أو ارتخاء نقاط ربط الكابلات داخل الطبلون يولد حرارة عالية تخالف معيار NF C 15-100.",
    solution: "فحص حراري ومنهجي فوري للطبلون، إعادة توزيع الأحمال، وتركيب قواطع تفاضلية وحرارية أصلية مع ترقيم الدارات.",
    action: "sos",
    button: "SOS - اطلب تدخل طوارئ فوري لفحص الطبلون ⚡",
  },
  smart_retrofit: {
    severity: "مشروع تطوير هندسي — ترقية ذكية نظيفة وآمنة",
    cause: "التمديدات التقليدية تفتقر لكابلات التحكم، والحلول التجارية الرخيصة تعتمد على سحابة تتوقف عند انقطاع الإنترنت.",
    solution: "تركيب وحدات أتمتة مصغرة خلف المفاتيح الحالية دون تكسير، وربطها بخادم محلي معزول (Local Server) يعمل بدون إنترنت.",
    action: "calc",
    button: "احسب تكلفة تحويل منزلك إلى منزل ذكي الآن 📊",
  },
  industrial_stop: {
    severity: "خطورة تشغيلية قصوى — خسائر توقف إنتاج صناعي",
    cause: "فصل في ريلاي حماية الفاز 380V أو تلف في الكونتاكتورات والقواطع الحرارية للمحركات أو إشارات PLC.",
    solution: "تشخيص منهجي سريع للوحة لتحديد العطل بدقة، معايرة حماية المحركات، وإعادة ترقيم وتنظيم الكابلات.",
    action: "sos",
    button: "SOS - استدعاء مهندس طوارئ صناعية فوراً ⚡",
  },
};

export default function DiagnosticRadarSection() {
  const [selected, setSelected] = useState<string>("breaker_trip");
  const { openSos, openCalculator } = useSiteActions();

  const current = useMemo(() => FAULT_DATA[selected], [selected]);

  return (
    <section id="diagnostic" className="border-y border-white/10 bg-gradient-to-b from-grid-dark via-grid-card/50 to-grid-dark py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-electric-blue/30 bg-electric-blue/10 px-4 py-1 text-xs font-extrabold text-electric-blue sm:text-sm">
            📡 دليل أولي للحالات الشائعة
          </p>
          <h2 className="mt-4 text-2xl font-black text-white sm:text-4xl">رادار التشخيص الهندسي الفوري</h2>
          <p className="mt-3 text-base leading-loose text-slate-400">
            اختر الحالة الأقرب لمشكلتك للاطلاع على أسباب محتملة وخطوات أولية. لا يغني هذا المثال عن فحص مهندس للموقع.
          </p>
        </div>

        <div className="mt-10 grid items-start gap-6 lg:grid-cols-12">
          <div className="grid gap-3.5 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
            {FAULTS.map((fault) => {
              const active = selected === fault.id;
              return (
                <button
                  key={fault.id}
                  type="button"
                  onClick={() => setSelected(fault.id)}
                  className={`surface-interactive flex min-h-11 w-full items-start gap-3.5 rounded-2xl border p-4 text-right transition ${
                    active ? "border-sos-red bg-sos-red/10 shadow-glow-red" : "border-white/10 bg-grid-card/80"
                  }`}
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${active ? "bg-sos-red text-white" : "bg-white/5 text-electric-blue"}`}>
                    {fault.icon}
                  </span>
                  <div>
                    <span className="text-[11px] font-bold text-slate-400">{fault.label}</span>
                    <p className="mt-1 text-sm font-extrabold text-white">{fault.title}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-7">
            <div className="cyber-glass-card surface rounded-3xl border border-sos-red/40 p-6 shadow-2xl sm:p-8">
              <div className="cyber-spotlight" />
              <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <span dir="ltr" className="font-mono text-xs font-bold text-slate-400">DIAGNOSTIC REPORT // VD-RADAR</span>
                <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3.5 py-1 text-xs font-extrabold text-amber-200">
                  مثال توضيحي — ليس فحصاً مباشراً
                </span>
              </div>

              <h3 className="relative mt-5 text-xl font-black text-white sm:text-2xl">{FAULTS.find((fault) => fault.id === selected)?.title}</h3>

              <div className="relative mt-6 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-grid-dark/90 p-4">
                  <p className="text-sm font-extrabold text-amber-300">⚠️ احتمال فني شائع</p>
                  <p className="mt-2 text-sm leading-loose text-slate-300">{current.cause}</p>
                </div>
                <div className="rounded-2xl border border-electric-blue/30 bg-electric-blue/5 p-4">
                  <p className="text-sm font-extrabold text-electric-blue">🔧 [الحل المنهجي من Voltix Dynamics]</p>
                  <p className="mt-2 text-sm leading-loose text-slate-200">{current.solution}</p>
                </div>
              </div>

              <div className="relative mt-7 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row">
                <button
                  type="button"
                  onClick={current.action === "sos" ? openSos : openCalculator}
                  className={current.action === "sos" ? "btn-command-red flex flex-1 items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-black text-white sm:text-base" : "btn-command-blue flex flex-1 items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-black text-grid-dark sm:text-base"}
                >
                  {current.button}
                </button>
              </div>
              <p className="relative mt-3 text-xs leading-relaxed text-slate-500">
                هذا المحتوى إرشادي عام مبني على الحالة المختارة، ولا يشخّص جهازك أو يحدد مستوى الخطر الفعلي عن بُعد.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
