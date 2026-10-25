const DEFAULT_EMAIL = "sales@rappisportshub.com";
const DEFAULT_WHATSAPP = "264818141646";

export function contactEmail() {
  return (process.env.NEXT_PUBLIC_CONTACT_EMAIL || DEFAULT_EMAIL).trim();
}

export function instagramUrl() {
  return (process.env.NEXT_PUBLIC_INSTAGRAM_URL || "").trim();
}

export function facebookUrl() {
  return (process.env.NEXT_PUBLIC_FACEBOOK_URL || "").trim();
}

export function whatsappNumber() {
  return (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || DEFAULT_WHATSAPP).replace(/\D/g, "");
}

export function whatsappUrl(message?: string) {
  const phone = whatsappNumber();
  if (!phone) return "";
  const base = `https://wa.me/${phone}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function mailtoUrl(subject: string, body?: string) {
  const q = new URLSearchParams({ subject });
  if (body) q.set("body", body);
  return `mailto:${contactEmail()}?${q.toString()}`;
}
