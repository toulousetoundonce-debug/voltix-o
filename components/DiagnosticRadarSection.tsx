"use client";

import { useState } from "react";
import {
  Activity,
  ArrowLeft,
  Camera,
  Check,
  Factory,
  House,
  ShieldAlert,
  Wrench,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSiteActions } from "./SiteActionsProvider";

const FAULTS = [
  {
    id: "cctv_flicker",
    icon: Camera,
    label: "أنظمة المراقبة CCTV",
    title: "توقف كاميرا أو تشوش الصورة ليلاً",
    priority: "مراجعة فنية",
    priorityLevel: "review",
    cause:
      "قد يرتبط ذلك بهبوط الجهد على مسار التغذية، أو توصيلات متدهورة، أو إعدادات التصوير الليلي. يلزم فحص المنظومة لتحديد السبب الفعلي.",
    inspection:
      "يفحص المختص التغذية والوصلات وإعدادات التصوير الليلي، ثم يراجع عزل شبكة الكاميرات عند الحاجة.",
    action: "calc",
    button: "اطلب تقديراً لتحديث منظومة الكاميرات",
  },
  {
    id: "breaker_trip",
    icon: Zap,
    label: "طوارئ كهربائية وحماية",
    title: "فصل متكرر للقاطع أو سخونة في اللوحة",
    priority: "أولوية فحص مرتفعة",
    priorityLevel: "urgent",
    cause:
      "قد يكون السبب حملاً زائداً، أو عطلاً في جهاز، أو مشكلة في التوصيلات. لا يمكن تأكيد السبب أو مستوى الخطر دون فحص ميداني.",
    inspection:
      "يفحص كهربائي مؤهل الدارات والقواطع والأحمال ودرجة الحرارة، ويحدد الإجراء المناسب قبل إعادة تشغيل الدارة.",
    action: "sos",
    button: "اطلب تدخلاً لفحص اللوحة الكهربائية",
  },
  {
    id: "smart_retrofit",
    icon: House,
    label: "أتمتة ومنازل ذكية",
    title: "ترقية المنزل إلى تحكم ذكي",
    priority: "مرحلة تخطيط",
    priorityLevel: "planning",
    cause:
      "يتوقف اختيار وحدات التحكم على نوع التمديدات والأحمال والتوافق مع الأجهزة، إضافة إلى طريقة تشغيل النظام عند انقطاع الإنترنت.",
    inspection:
      "تُراجع متطلبات المنزل والتجهيزات وخيارات التحكم المحلي قبل إعداد تصميم مناسب وخطة تنفيذ.",
    action: "calc",
    button: "قدّر تكلفة تحويل منزلك إلى منزل ذكي",
  },
  {
    id: "industrial_stop",
    icon: Factory,
    label: "كهرباء صناعية و PLC",
    title: "توقف خط إنتاج أو عطل في لوحة التحكم",
    priority: "أولوية فحص مرتفعة",
    priorityLevel: "urgent",
    cause:
      "قد يتعلق التوقف بدارات التحكم أو الحماية أو أحد مكونات اللوحة. يلزم تشخيص ميداني آمن لتحديد موضع الخلل.",
    inspection:
      "يفحص المهندس إشارات التحكم والحمايات ومكونات اللوحة وفق إجراءات العزل والسلامة المعتمدة.",
    action: "sos",
    button: "اطلب تدخلاً لفحص لوحة التحكم الصناعية",
  },
] as const satisfies readonly {
  id: string;
  icon: LucideIcon;
  label: string;
  title: string;
  priority: string;
  priorityLevel: "urgent" | "review" | "planning";
  cause: string;
  inspection: string;
  action: "sos" | "calc";
  button: string;
}[];

type FaultId = (typeof FAULTS)[number]["id"];

const PRIORITY_STYLES = {
  urgent: "border-rose-400/25 bg-rose-400/10 text-rose-200",
  review: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  planning: "border-electric-blue/25 bg-electric-blue/10 text-cyan-100",
} as const;

export default function DiagnosticRadarSection() {
  const [selected, setSelected] = useState<FaultId>("breaker_trip");
  const { openSos, openCalculator } = useSiteActions();
  const current = FAULTS.find((fault) => fault.id === selected) ?? FAULTS[0];
  const CurrentIcon = current.icon;

  return (
    <section
      id="diagnostic"
      aria-labelledby="diagnostic-title"
      className="relative isolate overflow-hidden border-y border-white/10 bg-gradient-to-b from-grid-dark via-grid-card/50 to-grid-dark py-16 sm:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-24 -z-10 h-72 w-72 rounded-full bg-electric-blue/[0.07] blur-3xl"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <header className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-electric-blue/25 bg-electric-blue/[0.07] px-4 py-1.5 text-xs font-extrabold text-cyan-200 sm:text-sm">
            <Activity className="h-4 w-4" aria-hidden="true" />
            دليل أولي تفاعلي <span aria-hidden="true">·</span> 4 حالات شائعة
          </p>
          <h2 id="diagnostic-title" className="mt-4 text-2xl font-black text-white sm:text-4xl">
            رادار التشخيص الهندسي الفوري
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-400 sm:text-base sm:leading-loose">
            اختر الوصف الأقرب لمشكلتك لعرض احتمالات أولية ومحور الفحص المناسب. هذا الدليل توعوي ولا يشخّص الأعطال عن بُعد.
          </p>
        </header>

        <div className="mt-9 grid items-start gap-5 sm:mt-12 lg:grid-cols-12 lg:gap-6">
          <div
            role="group"
            aria-label="اختر الحالة الأقرب لمشكلتك"
            className="grid gap-3 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1"
          >
            {FAULTS.map((fault, index) => {
              const active = selected === fault.id;
              const Icon = fault.icon;

              return (
                <button
                  key={fault.id}
                  type="button"
                  aria-pressed={active}
                  aria-controls="diagnostic-report"
                  onClick={() => setSelected(fault.id)}
                  className={`group relative flex min-h-[6.5rem] w-full items-center gap-3 overflow-hidden rounded-2xl border p-4 text-right shadow-lg shadow-black/10 transition duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-blue motion-reduce:transition-none ${
                    active
                      ? "border-electric-blue/40 bg-electric-blue/[0.08] shadow-[0_12px_34px_-22px_rgba(0,229,255,0.65)]"
                      : "border-white/[0.08] bg-slate-900/65 hover:-translate-y-0.5 hover:border-white/20 hover:bg-slate-900/90 motion-reduce:hover:transform-none"
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition ${
                      active
                        ? "border-electric-blue/25 bg-electric-blue/10 text-electric-blue"
                        : "border-white/[0.06] bg-white/[0.03] text-slate-400 group-hover:text-cyan-200"
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
                      <span dir="ltr" className="font-mono text-[10px] text-slate-500">
                        0{index + 1}
                      </span>
                      {fault.label}
                    </span>
                    <span className="mt-1 block text-sm font-extrabold leading-relaxed text-white">
                      {fault.title}
                    </span>
                  </span>
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition ${
                      active
                        ? "border-electric-blue/40 bg-electric-blue text-grid-dark"
                        : "border-white/10 text-transparent"
                    }`}
                    aria-hidden="true"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-7">
            <article
              id="diagnostic-report"
              aria-labelledby="diagnostic-report-title"
              className="cyber-glass-card surface relative overflow-hidden rounded-3xl border border-white/10 p-5 shadow-2xl sm:p-7 lg:p-8"
            >
              <div aria-hidden="true" className="cyber-spotlight pointer-events-none" />
              <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                <span className="flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.12em] text-slate-400 sm:text-xs" dir="ltr">
                  <Activity className="h-4 w-4 text-electric-blue" aria-hidden="true" />
                  VD / FIELD GUIDE
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/[0.07] px-3 py-1.5 text-[10px] font-bold text-amber-100 sm:text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden="true" />
                  إرشاد عام · ليس فحصاً ميدانياً
                </span>
              </div>

              <div
                aria-live="polite"
                aria-atomic="true"
                className="relative"
              >
                <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-electric-blue/20 bg-electric-blue/[0.08] text-electric-blue">
                      <CurrentIcon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-400">{current.label}</p>
                      <h3 id="diagnostic-report-title" className="mt-1 text-lg font-black leading-relaxed text-white sm:text-xl">
                        {current.title}
                      </h3>
                    </div>
                  </div>
                  <span className={`inline-flex min-h-8 shrink-0 items-center rounded-full border px-3 py-1 text-[11px] font-extrabold ${PRIORITY_STYLES[current.priorityLevel]}`}>
                    {current.priority}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2">
                  <section className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.045] p-4">
                    <h4 className="flex items-center gap-2 text-xs font-extrabold text-amber-100 sm:text-sm">
                      <ShieldAlert className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
                      احتمالات تستحق الفحص
                    </h4>
                    <p className="mt-2 text-xs leading-7 text-slate-300 sm:text-sm">
                      {current.cause}
                    </p>
                  </section>
                  <section className="rounded-2xl border border-electric-blue/15 bg-electric-blue/[0.035] p-4">
                    <h4 className="flex items-center gap-2 text-xs font-extrabold text-cyan-100 sm:text-sm">
                      <Wrench className="h-4 w-4 shrink-0 text-electric-blue" aria-hidden="true" />
                      محور الفحص المهني
                    </h4>
                    <p className="mt-2 text-xs leading-7 text-slate-300 sm:text-sm">
                      {current.inspection}
                    </p>
                  </section>
                </div>

                <p className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-300/15 bg-rose-300/[0.045] px-3.5 py-3 text-xs leading-6 text-slate-300">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
                  عند وجود دخان أو شرر أو رائحة احتراق، ابتعد عن الموقع ولا تلمس اللوحة أو الأجهزة، واطلب المساعدة من جهة مختصة.
                </p>
              </div>

              <div className="relative mt-5 border-t border-white/[0.08] pt-4 sm:mt-6 sm:pt-5">
                <button
                  type="button"
                  onClick={current.action === "sos" ? openSos : openCalculator}
                  className={`group flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-center text-sm font-black leading-relaxed transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none motion-reduce:hover:transform-none sm:px-6 sm:text-base ${
                    current.action === "sos"
                      ? "btn-command-red text-white focus-visible:outline-rose-300"
                      : "btn-command-blue text-grid-dark focus-visible:outline-electric-blue"
                  }`}
                >
                  {current.action === "sos" ? (
                    <Zap className="h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <Activity className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>{current.button}</span>
                  <ArrowLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
                </button>
                <p className="mt-3 text-center text-[11px] leading-6 text-slate-400">
                  الأولوية تقديرية للتوعية فقط؛ يحدد المختص مستوى الخطورة والإجراء بعد معاينة الحالة.
                </p>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
