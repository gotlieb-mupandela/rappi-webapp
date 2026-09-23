import "server-only";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

const DEFAULT_API_URL = "https://secure.3gdirectpay.com/API/v6/";
const DEFAULT_PAY_URL = "https://secure.3gdirectpay.com/payv3.php";
const DEFAULT_SITE_URL = "https://www.rappisportshub.com";
const DPO_TIMEOUT_MS = 20_000;
const DPO_RETRIES = 3;

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

export function isoCustomerCountry(value?: string) {
  const raw = String(value ?? "").trim();
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  if (/namibia/i.test(raw)) return "NA";
  if (/south africa|rsa/i.test(raw)) return "ZA";
  if (/france/i.test(raw)) return "FR";
  return "NA";
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

function errorChain(err: unknown) {
  const parts: string[] = [];
  let current: unknown = err;
  for (let i = 0; i < 4 && current; i++) {
    if (current instanceof Error) {
      parts.push(current.message);
      current = current.cause;
      continue;
    }
    if (typeof current === "object" && current && "code" in current) {
      parts.push(String((current as { code: string }).code));
    }
    break;
  }
  return parts.join(" ");
}

function isTransientDpoError(err: unknown) {
  const text = errorChain(err);
  return /fetch failed|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|socket hang up|timed out/i.test(
    text,
  );
}

export function formatDpoNetworkError(err: unknown) {
  const text = errorChain(err);
  if (/ENOTFOUND|EAI_AGAIN/i.test(text)) return "Could not resolve the DPO payment service.";
  if (/timed out|ETIMEDOUT/i.test(text)) return "DPO timed out. Try again.";
  if (isTransientDpoError(err)) return "Could not reach DPO. Try again.";
  if (err instanceof Error && err.message && !/^fetch failed$/i.test(err.message)) {
    return err.message;
  }
  return "Could not start payment.";
}

function postDpoXmlOnce(apiUrl: string, body: string) {
  return new Promise<string>((resolve, reject) => {
    const url = new URL(apiUrl);
    const transport = url.protocol === "http:" ? httpRequest : httpsRequest;
    const req = transport(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === "http:" ? 80 : 443),
        path: `${url.pathname}${url.search}`,
        method: "POST",
        family: 4,
        timeout: DPO_TIMEOUT_MS,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          Accept: "application/xml",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`DPO returned HTTP ${res.statusCode}.`));
            return;
          }
          resolve(raw);
        });
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error("DPO timed out."));
    });
    req.on("error", reject);
    req.end(body);
  });
}

async function postDpoXml(body: string) {
  const { apiUrl } = dpoConfig();
  let lastError: unknown;
  for (let attempt = 0; attempt < DPO_RETRIES; attempt++) {
    try {
      return parseDpoXml(await postDpoXmlOnce(apiUrl, body));
    } catch (err) {
      lastError = err;
      if (attempt < DPO_RETRIES - 1 && isTransientDpoError(err)) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        continue;
      }
      throw new Error(formatDpoNetworkError(err));
    }
  }
  throw new Error(formatDpoNetworkError(lastError));
}

export async function createToken(input: {
  companyRef: string;
  amount: number;
  currency: string;
  description: string;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
  };
  siteUrl?: string;
}) {
  const { companyToken, serviceType } = dpoConfig();
  const site = (input.siteUrl || dpoSiteUrl()).replace(/\/$/, "");
  const country = isoCustomerCountry(input.customer.country);
  const phone = (input.customer.phone || "").trim();
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
    <CompanyRefUnique>0</CompanyRefUnique>
    <PTL>5</PTL>
    <TransactionSource>Website</TransactionSource>
    <DefaultPayment>CC</DefaultPayment>
    <customerFirstName>${escapeXml(input.customer.firstName)}</customerFirstName>
    <customerLastName>${escapeXml(input.customer.lastName)}</customerLastName>
    <customerEmail>${escapeXml(input.customer.email)}</customerEmail>
    ${phone ? `<customerPhone>${escapeXml(phone)}</customerPhone>` : ""}
    <customerAddress>${escapeXml(input.customer.address || "")}</customerAddress>
    <customerCity>${escapeXml(input.customer.city || "")}</customerCity>
    <customerCountry>${escapeXml(country)}</customerCountry>
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
</API3G>`;
  return postDpoXml(xml);
}

export function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "Customer";
  const lastName = parts.slice(1).join(" ") || firstName;
  return { firstName, lastName };
}
