"use client";

import { createWhatsAppHref, WHATSAPP_BUSINESS_NUMBER } from "@/lib/whatsapp";

const DEFAULT_MESSAGE =
  "سلام عليكم Voltix Dynamics، أهتم بخدماتكم الكهربائية / المنازل الذكية وأريد استفساراً أو معاينة.";

export default function WhatsAppButton() {
  const href = createWhatsAppHref(WHATSAPP_BUSINESS_NUMBER, DEFAULT_MESSAGE);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تواصل واتساب مباشر مع Voltix Dynamics"
      className="whatsapp-launcher fixed bottom-5 right-5 z-40 inline-flex min-h-14 items-center gap-2 rounded-full border border-white/15 bg-[#25D366] px-4 py-2 text-sm font-extrabold text-[#062b16] shadow-[0_10px_25px_rgba(37,211,102,0.3)] transition hover:scale-[1.03] hover:shadow-[0_12px_30px_rgba(37,211,102,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#25D366]"
    >
      <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 shrink-0 fill-current">
        <path d="M16.04 3C8.87 3 3.04 8.79 3.04 15.92c0 2.28.6 4.52 1.75 6.49L3 29l6.78-1.77a13.1 13.1 0 0 0 6.25 1.58h.01c7.17 0 13-5.8 13-12.93A12.83 12.83 0 0 0 25.2 6.7 12.95 12.95 0 0 0 16.04 3Zm0 23.6h-.01a10.9 10.9 0 0 1-5.55-1.51l-.4-.24-4.02 1.05 1.07-3.9-.26-.4a10.68 10.68 0 0 1-1.66-5.68c0-5.94 4.86-10.77 10.84-10.77 2.89 0 5.6 1.12 7.64 3.15a10.65 10.65 0 0 1 3.17 7.61c0 5.94-4.86 10.78-10.82 10.78Zm5.95-8.07c-.33-.16-1.94-.95-2.24-1.06-.3-.11-.52-.16-.73.16-.22.32-.84 1.06-1.03 1.28-.19.22-.38.24-.7.08-.33-.16-1.38-.51-2.63-1.63-.97-.86-1.62-1.92-1.81-2.25-.19-.32-.02-.5.14-.66.15-.14.33-.38.49-.57.16-.19.22-.32.33-.54.11-.21.05-.4-.03-.56-.08-.16-.73-1.75-1-2.4-.27-.63-.54-.55-.73-.56h-.62c-.22 0-.57.08-.87.4-.3.33-1.14 1.11-1.14 2.7 0 1.59 1.17 3.13 1.33 3.35.16.21 2.3 3.49 5.57 4.9.78.34 1.39.55 1.86.7.78.24 1.49.21 2.05.13.63-.1 1.94-.79 2.21-1.54.27-.76.27-1.41.19-1.55-.08-.13-.3-.21-.62-.37Z" />
      </svg>
      <span className="whatsapp-label whitespace-nowrap">تواصل واتساب مباشر 💬</span>
    </a>
  );
}
