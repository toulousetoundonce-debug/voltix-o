// Public site constants. Only NEXT_PUBLIC_* values are read here, so this file is safe
// to import from both server and client code.

const phone = "+213796886772";
const email = (process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "imadnasri15@gmail.com").trim();

export const EMERGENCY_SERVICES_PHONE = "14";
export const MAPS_SEARCH_URL = "https://www.google.com/maps/search/?api=1&query=";

export function createMapsSearchHref(query: string): string {
  return `${MAPS_SEARCH_URL}${encodeURIComponent(query)}`;
}

export function createMapsCoordinatesHref(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}&z=20`;
}

export const SITE = {
  name: "Voltix Dynamics",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").trim().replace(/\/+$/, ""),
  phone,
  email,
  phoneHref: phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "",
  emailHref: email ? `mailto:${email}` : "",
};
