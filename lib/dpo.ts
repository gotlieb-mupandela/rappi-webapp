const DEFAULT_API_URL = "https://secure.3gdirectpay.com/API/v6/";
const DEFAULT_PAY_URL = "https://secure.3gdirectpay.com/payv3.php";
const DEFAULT_SITE_URL = "https://www.rappisportshub.com";

export type DpoXmlResult = {
  result: string | null;
  explanation: string | null;
  transToken: string | null;
  transRef: string | null;
  transactionAmount: string | null;
  transactionCurrency: string | null;
  companyRef: string | null;
  raw: string;
};

export function dpoSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, "");
}

export function requestSiteUrl(req: Request) {
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
    .split(",")[0]
    .trim();
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (
    host &&
    !/^localhost\b/i.test(host) &&
    !/^127\.0\.0\.1\b/.test(host) &&
    !/^\[::1\]\b/.test(host)
  ) {
    return `${proto}://${host}`.replace(/\/$/, "");
  }
  return dpoSiteUrl();
}

export function dpoCurrency() {
  return process.env.DPO_CURRENCY || "NAD";
}

export function dpoPaymentUrl(transToken: string) {
  const base = (process.env.DPO_PAY_URL || DEFAULT_PAY_URL).replace(/\/$/, "");
  return `${base}?ID=${encodeURIComponent(transToken)}`;
}

export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function xmlTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? match[1].trim() : null;
}

export function parseDpoXml(raw: string): DpoXmlResult {
  return {
    result: xmlTag(raw, "Result"),
    explanation: xmlTag(raw, "ResultExplanation"),
    transToken: xmlTag(raw, "TransToken") ?? xmlTag(raw, "TransactionToken"),
    transRef: xmlTag(raw, "TransRef") ?? xmlTag(raw, "TransactionRef"),
    transactionAmount: xmlTag(raw, "TransactionAmount"),
    transactionCurrency: xmlTag(raw, "TransactionCurrency"),
    companyRef: xmlTag(raw, "CompanyRef"),
    raw,
  };
}

function dpoConfig() {
  const companyToken = process.env.DPO_COMPANY_TOKEN;
  const serviceType = process.env.DPO_SERVICE_TYPE;
  if (!companyToken || !serviceType) {
    throw new Error("DPO is not configured.");
  }
  return {
    companyToken,
    serviceType,
    apiUrl: process.env.DPO_API_URL || DEFAULT_API_URL,
  };
}

function serviceDate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function postDpoXml(body: string) {
  const { apiUrl } = dpoConfig();
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      Accept: "application/xml",
    },
    body,
  });
  const raw = await res.text();
  return parseDpoXml(raw);
}

export async function createToken(input: {
  companyRef: string;
  amount: number;
  currency: string;
  description: string;
  customer: { firstName: string; lastName: string; email: string };
  siteUrl?: string;
}) {
  const { companyToken, serviceType } = dpoConfig();
  const site = (input.siteUrl || dpoSiteUrl()).replace(/\/$/, "");
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
  <CompanyToken>${escapeXml(companyToken)}</CompanyToken>
  <Request>createToken</Request>
  <Transaction>
    <PaymentAmount>${input.amount.toFixed(2)}</PaymentAmount>
    <PaymentCurrency>${escapeXml(input.currency)}</PaymentCurrency>
    <CompanyRef>${escapeXml(input.companyRef)}</CompanyRef>
    <RedirectURL>${escapeXml(`${site}/checkout/return`)}</RedirectURL>
    <BackURL>${escapeXml(`${site}/checkout/cancel`)}</BackURL>
    <CompanyRefUnique>1</CompanyRefUnique>
    <PTL>60</PTL>
    <PTLtype>minutes</PTLtype>
    <customerFirstName>${escapeXml(input.customer.firstName)}</customerFirstName>
    <customerLastName>${escapeXml(input.customer.lastName)}</customerLastName>
    <customerEmail>${escapeXml(input.customer.email)}</customerEmail>
    <customerCountry>NA</customerCountry>
  </Transaction>
  <Services>
    <Service>
      <ServiceType>${escapeXml(serviceType)}</ServiceType>
      <ServiceDescription>${escapeXml(input.description)}</ServiceDescription>
      <ServiceDate>${serviceDate()}</ServiceDate>
    </Service>
  </Services>
</API3G>`;
  return postDpoXml(xml);
}

export async function verifyToken(transactionToken: string) {
  const { companyToken } = dpoConfig();
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
  <CompanyToken>${escapeXml(companyToken)}</CompanyToken>
  <Request>verifyToken</Request>
  <TransactionToken>${escapeXml(transactionToken)}</TransactionToken>
  <VerifyTransaction>1</VerifyTransaction>
</API3G>`;
  return postDpoXml(xml);
}

export function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "Customer";
  const lastName = parts.slice(1).join(" ") || firstName;
  return { firstName, lastName };
}
