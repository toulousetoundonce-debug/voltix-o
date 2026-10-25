"use client";

import { useEffect, useState } from "react";
import { Menu, MoonStar, SunMedium, X } from "lucide-react";
import { useSiteActions } from "./SiteActionsProvider";
import BrandLogo from "./BrandLogo";

const LINKS = [
  { href: "#services", label: "الخدمات" },
  { href: "#why-us", label: "لماذا Voltix" },
  { href: "#portfolio", label: "أعمالنا" },
  { href: "/achievements.html", label: "إنجازاتنا" },
  { href: "#contact", label: "تواصل معنا" },
] as const;

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const { openSos } = useSiteActions();

  useEffect(() => {
    const saved = localStorage.getItem("voltix-theme");
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    const shouldLight = saved ? saved === "light" : prefersLight;
    setDarkMode(!shouldLight);
    document.documentElement.classList.toggle("light", shouldLight);
    document.documentElement.classList.toggle("dark", !shouldLight);
  }, []);

  const toggleTheme = () => {
    const nextLight = !darkMode;
    setDarkMode(!nextLight);
    localStorage.setItem("voltix-theme", nextLight ? "light" : "dark");
    document.documentElement.classList.toggle("light", nextLight);
    document.documentElement.classList.toggle("dark", !nextLight);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-grid-dark/80 backdrop-blur-md">
      <nav aria-label="التنقل الرئيسي" className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <a href="#main" className="flex min-h-11 items-center gap-2.5" aria-label="Voltix Dynamics - الصفحة الرئيسية">
          <BrandLogo priority />
          <span dir="ltr" className="text-lg font-black tracking-tight text-white">
            Voltix <span className="text-electric-blue">Dynamics</span>
          </span>
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="تبديل الوضع"
            onClick={toggleTheme}
            className="flex h-11 w-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200 transition hover:border-electric-blue/40 hover:text-electric-blue"
          >
            {darkMode ? <SunMedium className="h-5 w-5" aria-hidden="true" /> : <MoonStar className="h-5 w-5" aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={openSos}
            className="open-sos-trigger min-h-11 rounded-lg bg-sos-red px-3.5 py-2 text-sm font-extrabold text-white shadow-glow-red transition hover:brightness-110"
          >
            SOS ⚡
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"}
            className="flex h-11 w-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 md:hidden"
          >
            {menuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {menuOpen ? (
        <div id="mobile-menu" className="border-t border-white/10 bg-grid-dark/95 md:hidden">
          <ul className="mx-auto max-w-7xl space-y-1 px-4 py-3">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-3 text-base font-semibold text-slate-200 transition hover:bg-white/5"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </header>
  );
}
