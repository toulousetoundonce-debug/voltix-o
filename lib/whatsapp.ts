export const WHATSAPP_BUSINESS_NUMBER = "+213657979054";
export const WHATSAPP_SOS_NUMBER = "+213796886772";

export function createWhatsAppHref(phone: string, message: string): string {
  const normalizedPhone = phone.replace(/\D/g, "");
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}
