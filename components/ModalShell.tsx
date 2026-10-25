"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  titleId: string;
  subtitle?: string;
  accent: "red" | "blue";
  icon?: ReactNode;
  /** Rendered outside the scroll area, so the action buttons are always visible. */
  footer?: ReactNode;
  /** When this value changes the scroll area jumps back to the top (used for wizard steps). */
  scrollKey?: string | number;
  panelClassName?: string;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ModalShell({
  open,
  onClose,
  title,
  titleId,
  subtitle,
  accent,
  icon,
  footer,
  scrollKey,
  panelClassName = "",
  children,
}: ModalShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // The overlay follows the *visual* viewport, so on phones it shrinks when the on-screen
  // keyboard opens and the action buttons never end up hidden behind it.
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus();

    const vv = window.visualViewport;
    const sync = () => {
      if (vv) setBox({ top: Math.round(vv.offsetTop), height: Math.round(vv.height) });
    };
    sync();
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      setBox(null);
      previouslyFocused?.focus();
    };
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [scrollKey]);

  if (!open) return null;

  const trapFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const nodes = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const border = accent === "red" ? "border-sos-red/40" : "border-electric-blue/30";
  const glow = accent === "red" ? "shadow-glow-red" : "shadow-glow-blue";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      style={box ? { top: box.top, height: box.height } : undefined}
    >
      <div className="modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={trapFocus}
        className={`modal-panel relative flex max-h-full w-full animate-modal-in flex-col overflow-hidden rounded-t-3xl border bg-grid-card outline-none sm:max-w-xl sm:rounded-3xl ${border} ${glow} ${panelClassName}`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-start gap-3">
            {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
            <div>
              <h2 id={titleId} className="text-lg font-extrabold text-white sm:text-xl">
                {title}
              </h2>
              {subtitle ? <p className="mt-1 text-sm leading-relaxed text-slate-400">{subtitle}</p> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {children}
        </div>

        {footer ? (
          <div className="border-t border-white/10 bg-grid-card px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
