// Public site constants. Only NEXT_PUBLIC_* values are read here, so this file is safe
// to import from both server and client code.

const phone = (process.env.NEXT_PUBLIC_CONTACT_PHONE ?? "").trim();
const email = (process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "").trim();

export const SITE = {
  name: "Voltix Dynamics",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").trim().replace(/\/+$/, ""),
  phone,
  email,
  phoneHref: phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "",
  emailHref: email ? `mailto:${email}` : "",
};
