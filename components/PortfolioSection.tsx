"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Camera, Factory, Home, Play, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Category = "industrial" | "smart" | "security";
type Filter = "all" | Category;

interface Project {
  id: string;
  category: Category;
  title: string;
  description: string;
  tags: string[];
}

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "industrial", label: "صناعي" },
  { value: "smart", label: "منازل ذكية" },
  { value: "security", label: "أنظمة أمنية" },
];

const CATEGORY_META: Record<Category, { label: string; icon: LucideIcon }> = {
  industrial: { label: "صناعي", icon: Factory },
  smart: { label: "منزل ذكي", icon: Home },
  security: { label: "نظام أمني", icon: Camera },
};

const PROJECTS: Project[] = [
  {
    id: "p1",
    category: "industrial",
    title: "خزانة تحكم لخط تعبئة وتغليف",
    description: "تصميم وتجميع لوحة تحكم مع حماية المحركات وتنسيق القواطع وترقيم كامل للكابلات.",
    tags: ["Armoire Électrique", "حماية المحركات", "Cable Management"],
  },
  {
    id: "p2",
    category: "industrial",
    title: "تأسيس كهرباء ورشة تصنيع",
    description: "حساب الأحمال، لوحة توزيع رئيسية وفرعية، وشبكة تأريض مطابقة لمعيار NF C 15-100.",
    tags: ["حساب الأحمال", "التأريض", "NF C 15-100"],
  },
  {
    id: "p3",
    category: "smart",
    title: "فيلا ذكية بتحكم محلي كامل",
    description: "خادم Home Assistant على Docker داخل الفيلا: إضاءة وتكييف وستائر وسيناريوهات تعمل بدون إنترنت.",
    tags: ["Home Assistant", "Docker", "Local Control"],
  },
  {
    id: "p4",
    category: "smart",
    title: "شقة ذكية بسيناريوهات يومية",
    description: "سيناريوهات الدخول والنوم والسفر، مع مراقبة استهلاك الطاقة ولوحة تحكم واحدة للأسرة.",
    tags: ["سيناريوهات", "مراقبة الطاقة", "واجهة موحدة"],
  },
  {
    id: "p5",
    category: "security",
    title: "منظومة CCTV لمستودع لوجستي",
    description: "كاميرات عالية الدقة بتغذية عبر الشبكة، مع معالجة هبوط الجهد وتسجيل على خادم محلي.",
    tags: ["PoE", "Voltage Drop", "NVR محلي"],
  },
  {
    id: "p6",
    category: "security",
    title: "شبكة أمنية معزولة لمجمع تجاري",
    description: "عزل كاميرات المراقبة عن شبكة العمل عبر VLANs، مع صلاحيات وصول محددة للمشرفين.",
    tags: ["VLAN", "عزل الشبكات", "صلاحيات الوصول"],
  },
];

export default function PortfolioSection() {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(
    () => (filter === "all" ? PROJECTS : PROJECTS.filter((p) => p.category === filter)),
    [filter],
  );

  return (
    <section id="portfolio" aria-labelledby="portfolio-title" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
      {!isOpen ? (
        <div className="relative isolate overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-[#080e19] shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_20%_30%,rgba(34,211,238,0.12),transparent_40%),linear-gradient(115deg,transparent_35%,rgba(16,185,129,0.05)_100%)]"
          />
          <div className="grid items-center gap-8 p-6 sm:p-9 lg:grid-cols-[1fr_0.9fr] lg:gap-12 lg:p-12">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/[0.08] px-3.5 py-1.5 text-xs font-extrabold text-cyan-200">
                <span className="h-2 w-2 rounded-full bg-cyan-300" aria-hidden="true" />
                مشاريع Voltix
              </p>
              <h2 id="portfolio-title" className="mt-5 max-w-2xl text-2xl font-black leading-tight text-white sm:text-3xl lg:text-4xl">
                معرض الأعمال
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
                من لوحات التحكم الصناعية إلى المنازل الذكية وأنظمة المراقبة؛ اكتشف نماذج من الحلول التي نصممها وننفذها.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">6 نماذج مشاريع</span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">3 مجالات هندسية</span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">تفاصيل ومواصفات</span>
              </div>
              <button
                type="button"
                aria-expanded={false}
                onClick={() => {
                  setFilter("all");
                  setIsOpen(true);
                }}
                className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-xl bg-gradient-to-l from-cyan-300 to-emerald-300 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.2)] transition hover:-translate-y-0.5 hover:shadow-[0_0_36px_rgba(34,211,238,0.34)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/10">
                  <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                </span>
                استكشف معرض الأعمال
              </button>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute -inset-5 rounded-[2rem] bg-cyan-400/[0.06] blur-2xl" aria-hidden="true" />
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#060b13]/90 p-4 shadow-2xl sm:p-5">
                <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                  <div>
                    <p className="text-sm font-extrabold text-white">استكشف حسب المجال</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">اختر مجالاً لعرض مشاريعه مباشرة</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-slate-400">3 مجالات</span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {FILTERS.filter((item): item is { value: Category; label: string } => item.value !== "all").map((item) => {
                    const meta = CATEGORY_META[item.value];
                    const Icon = meta.icon;
                    const count = PROJECTS.filter((project) => project.category === item.value).length;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => {
                          setFilter(item.value);
                          setIsOpen(true);
                        }}
                        className="group rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 text-right transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-cyan-300/[0.045] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 sm:p-3.5"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-200 transition group-hover:border-cyan-300/40">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="mt-3 block text-xs font-extrabold leading-5 text-white">{item.label}</span>
                        <span className="mt-1 block text-[10px] text-slate-500">
                          {count === 2 ? "مشروعان" : `${count} مشاريع`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3">
                  <span className="text-xs font-bold text-slate-300">حلول مصممة حسب احتياج كل مشروع</span>
                  <ArrowLeft className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div id="portfolio-projects" className="scroll-mt-24">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/[0.08] px-3.5 py-1.5 text-xs font-extrabold text-cyan-200">
                مشاريع Voltix
              </p>
              <h2 id="portfolio-title" className="mt-4 text-3xl font-black text-white sm:text-4xl">
                معرض الأعمال
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-400 sm:text-base">
                نماذج توضيحية لأنواع المشاريع التي ننفذها. صفّها حسب المجال.
              </p>
            </div>
            <button
              type="button"
              aria-expanded={true}
              aria-controls="portfolio-projects"
              onClick={() => setIsOpen(false)}
              className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:border-rose-400/40 hover:bg-rose-400/10 hover:text-rose-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              إغلاق المعرض
            </button>
          </div>

          <div role="group" aria-label="تصفية المشاريع" className="mt-6 flex flex-wrap gap-2">
            {FILTERS.map((item) => {
              const active = filter === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(item.value)}
                  className={`min-h-11 rounded-full border px-4 py-2 text-sm font-bold transition ${
                    active
                      ? "border-electric-blue bg-electric-blue text-grid-dark shadow-glow-blue"
                      : "border-white/15 text-slate-300 hover:border-white/40 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
            {visible.map((project) => {
              const meta = CATEGORY_META[project.category];
              const Icon = meta.icon;
              return (
                <li key={project.id}>
                  <article className="surface surface-interactive flex h-full flex-col overflow-hidden transition hover:border-electric-blue/40">
                    <div className="relative flex h-32 items-center justify-center overflow-hidden border-b border-white/10 bg-grid-dark">
                      <div aria-hidden="true" className="bg-grid-pattern absolute inset-0 opacity-70" />
                      <Icon className="relative h-12 w-12 text-electric-blue" aria-hidden="true" />
                      <span className="badge-tech absolute right-3 top-3">
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="text-lg font-extrabold leading-snug text-white">{project.title}</h3>
                      <p className="mt-2 flex-1 text-sm leading-loose text-slate-400">{project.description}</p>
                      <ul className="mt-4 flex flex-wrap gap-2">
                        {project.tags.map((tag) => (
                          <li key={tag} className="badge-tech">
                            {tag}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
