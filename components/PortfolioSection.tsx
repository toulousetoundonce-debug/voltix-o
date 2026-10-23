"use client";

import { useMemo, useState } from "react";
import { Camera, Factory, Home } from "lucide-react";
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
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(
    () => (filter === "all" ? PROJECTS : PROJECTS.filter((p) => p.category === filter)),
    [filter],
  );

  return (
    <section id="portfolio" aria-labelledby="portfolio-title" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <h2 id="portfolio-title" className="text-3xl font-black text-white sm:text-4xl">
            معرض الأعمال
          </h2>
          <p className="mt-4 text-base leading-loose text-slate-400">
            نماذج توضيحية لأنواع المشاريع التي ننفذها. صفّها حسب المجال.
          </p>
        </div>

        <div role="group" aria-label="تصفية المشاريع" className="flex flex-wrap gap-2">
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
      </div>

      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
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
                      <li
                        key={tag}
                        className="badge-tech"
                      >
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
    </section>
  );
}
