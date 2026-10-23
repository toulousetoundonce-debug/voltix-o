"use client";

import { Calculator, Mail, Phone, Siren, Zap } from "lucide-react";
import { SITE } from "@/lib/site";
import { useSiteActions } from "./SiteActionsProvider";

const QUICK_LINKS = [
  { href: "#services", label: "الخدمات" },
  { href: "#why-us", label: "لماذا Voltix" },
  { href: "#portfolio", label: "أعمالنا" },
] as const;

export default function Footer() {
  const { openSos, openCalculator } = useSiteActions();

  return (
    <footer id="contact" className="border-t border-white/10 bg-grid-card/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div>
          <p className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-electric-blue text-grid-dark">
              <Zap className="h-5 w-5" aria-hidden="true" fill="currentColor" />
            </span>
            <span dir="ltr" className="text-lg font-black text-white">
              Voltix <span className="text-electric-blue">Dynamics</span>
            </span>
          </p>
          <p className="mt-4 max-w-sm text-sm leading-loose text-slate-400">
            كهرباء صناعية وتجارية، منازل ذكية بتحكم محلي، وأنظمة مراقبة وأمان شبكي.
          </p>
        </div>

        <nav aria-label="روابط سريعة">
          <h2 className="text-base font-extrabold text-white">روابط سريعة</h2>
          <ul className="mt-4 space-y-2">
            {QUICK_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="inline-flex min-h-11 min-w-11 items-center text-sm text-slate-400 transition hover:text-electric-blue">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-base font-extrabold text-white">تواصل معنا</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            {SITE.phoneHref ? (
              <li>
                <a href={SITE.phoneHref} className="inline-flex min-h-11 items-center gap-2 transition hover:text-electric-blue">
                  <Phone className="h-4 w-4 text-electric-blue" aria-hidden="true" />
                  <span dir="ltr">{SITE.phone}</span>
                </a>
              </li>
            ) : null}
            {SITE.emailHref ? (
              <li>
                <a href={SITE.emailHref} className="inline-flex min-h-11 items-center gap-2 transition hover:text-electric-blue">
                  <Mail className="h-4 w-4 text-electric-blue" aria-hidden="true" />
                  <span dir="ltr">{SITE.email}</span>
                </a>
              </li>
            ) : null}
            <li>
              <button
                type="button"
                onClick={openCalculator}
                className="inline-flex min-h-11 items-center gap-2 transition hover:text-electric-blue"
              >
                <Calculator className="h-4 w-4 text-electric-blue" aria-hidden="true" />
                طلب دراسة فنية لمشروعك
              </button>
            </li>
          </ul>
          <button
            type="button"
            onClick={openSos}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-sos-red px-5 py-3 text-sm font-extrabold text-white shadow-glow-red transition hover:brightness-110"
          >
            <Siren className="h-5 w-5" aria-hidden="true" />
            SOS - طوارئ فورية
          </button>
        </div>
      </div>

      <div className="border-t border-white/10 py-5 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Voltix Dynamics. جميع الحقوق محفوظة.
      </div>
    </footer>
  );
}
