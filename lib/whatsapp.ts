import { SITE } from "@/lib/site";

export const WHATSAPP_BUSINESS_NUMBER = SITE.phone;
export const WHATSAPP_SOS_NUMBER = SITE.phone;

export function createWhatsAppHref(phone: string, message: string): string {
  const normalizedPhone = phone.replace(/\D/g, "");
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}
