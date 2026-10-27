"use client";

import Image from "next/image";
import {
  ArrowUpLeft,
  Calculator,
  Mail,
  MessageCircle,
  Phone,
  Siren,
} from "lucide-react";
import { SITE } from "@/lib/site";
import { createWhatsAppHref, WHATSAPP_BUSINESS_NUMBER } from "@/lib/whatsapp";
import { useSiteActions } from "./SiteActionsProvider";
import BrandLogo from "./BrandLogo";

const QUICK_LINKS = [
  { href: "#services", label: "الخدمات" },
  { href: "#why-us", label: "لماذا Voltix" },
  { href: "#portfolio", label: "أعمالنا" },
] as const;

const WHATSAPP_HREF = createWhatsAppHref(
  WHATSAPP_BUSINESS_NUMBER,
  "مرحباً Voltix Dynamics، أود الاستفسار عن خدماتكم.",
);

const CONTACT_ACTIONS = [
  {
    href: WHATSAPP_HREF,
    label: "تواصل عبر واتساب",
    icon: MessageCircle,
    className: "hover:border-emerald-300/50 hover:bg-emerald-400/15 hover:text-emerald-300",
    external: true,
  },
  {
    href: SITE.phoneHref,
    label: "اتصل بنا",
    icon: Phone,
    className: "hover:border-electric-blue/50 hover:bg-electric-blue/10 hover:text-electric-blue",
    external: false,
  },
  {
    href: SITE.emailHref,
    label: "راسلنا بالبريد الإلكتروني",
    icon: Mail,
    className: "hover:border-electric-blue/50 hover:bg-electric-blue/10 hover:text-electric-blue",
    external: false,
  },
] as const;

export default function Footer() {
  const { openSos, openCalculator } = useSiteActions();

  return (
    <footer id="contact" className="vx-fx-divider vx-fx-reveal relative isolate overflow-hidden border-t border-white/10 bg-page-bg">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_83%_45%,rgba(0,229,255,0.1),transparent_34%),linear-gradient(105deg,transparent_43%,rgba(8,145,178,0.045)_100%)]"
      />

      <div
        dir="ltr"
        className="grid min-h-[31.5rem] lg:grid-cols-[45%_22%_33%]"
      >
        <div className="relative order-1 min-h-[17rem] overflow-hidden bg-surface-2 sm:min-h-[23rem] lg:min-h-0">
          <Image
            src="/images/footer/smart-home-technician.png"
            alt="فني يضبط نظام منزل ذكي عبر الهاتف بجوار لوحة كهربائية"
            fill
            priority
            unoptimized
            sizes="(max-width: 1023px) 100vw, 45vw"
            className="object-cover object-[48%_center]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07101e]/55 via-transparent to-[#07101e]/10 lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-[#080d17]/20"
          />
          <div className="theme-inverse absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#07101e]/65 px-3 py-1.5 text-[11px] font-bold text-white/85 shadow-lg backdrop-blur-md sm:bottom-6 sm:left-6">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
            تحكم ذكي، محلي وآمن
          </div>
        </div>

        <nav
          dir="rtl"
          aria-label="روابط سريعة"
          className="order-2 flex flex-col items-center justify-center border-b border-white/[0.07] px-6 py-9 text-center lg:border-b-0 lg:px-4"
        >
          <h2 className="text-lg font-extrabold text-white">روابط سريعة</h2>
          <ul className="mt-5 space-y-2">
            {QUICK_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="group inline-flex min-h-10 items-center justify-center gap-2 border-b border-white/10 px-3 text-sm text-slate-400 transition hover:border-electric-blue/50 hover:text-electric-blue"
                >
                  <ArrowUpLeft
                    className="h-3.5 w-3.5 opacity-0 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100"
                    aria-hidden="true"
                  />
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={openSos}
            className="theme-inverse mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#ff4148] to-[#c91432] px-5 py-2.5 text-sm font-extrabold text-white shadow-[0_0_22px_rgba(239,35,55,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(239,35,55,0.48)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-400"
          >
            طوارئ فورية - SOS
            <Siren className="h-4 w-4" aria-hidden="true" />
          </button>
        </nav>

        <div
          dir="rtl"
          className="order-3 flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-[clamp(1.5rem,4vw,4rem)]"
        >
          <a
            href="#main"
            aria-label="Voltix Dynamics - العودة إلى أعلى الصفحة"
            className="inline-flex w-fit items-center gap-2.5"
          >
            <BrandLogo />
            <span dir="ltr" className="text-xl font-black tracking-tight text-white">
              Voltix <span className="text-electric-blue">Dynamics</span>
            </span>
          </a>
          <p className="mt-4 max-w-sm text-sm leading-7 text-slate-400">
            كهرباء صناعية وتجارية، منازل ذكية بتحكم محلي، وأنظمة مراقبة وأمان شبكي.
          </p>

          <h2 className="mt-6 text-lg font-extrabold text-white">تواصل معنا</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            <li>
              <a
                href={SITE.phoneHref}
                className="inline-flex min-h-10 items-center gap-2.5 transition hover:text-electric-blue"
              >
                <Phone className="h-4 w-4 text-electric-blue" aria-hidden="true" />
                <span dir="ltr">{SITE.phone}</span>
              </a>
            </li>
            <li>
              <a
                href={SITE.emailHref}
                className="inline-flex min-h-10 items-center gap-2.5 transition hover:text-electric-blue"
              >
                <Mail className="h-4 w-4 text-electric-blue" aria-hidden="true" />
                <span dir="ltr">{SITE.email}</span>
              </a>
            </li>
            <li>
              <button
                type="button"
                onClick={openCalculator}
                className="inline-flex min-h-10 items-center gap-2.5 text-sm text-slate-300 transition hover:text-electric-blue"
              >
                <Calculator className="h-4 w-4 text-electric-blue" aria-hidden="true" />
                طلب دراسة فنية لمشروعك
              </button>
            </li>
          </ul>

          <div className="mt-5 flex items-center gap-2.5">
            {CONTACT_ACTIONS.map(({ href, label, icon: Icon, className, external }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                title={label}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.045] text-slate-300 shadow-[0_0_16px_rgba(56,189,248,0.13)] transition ${className}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-center text-xs text-slate-500 sm:px-6 md:flex-row md:text-right">
          <p>© {new Date().getFullYear()} Voltix Dynamics. جميع الحقوق محفوظة.</p>
          <a href="#main" className="transition hover:text-electric-blue">
            صُمّم بعناية ليوصل الطاقة بثقة
          </a>
        </div>
      </div>
    </footer>
  );
}
