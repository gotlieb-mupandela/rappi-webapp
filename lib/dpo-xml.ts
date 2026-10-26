import { dpoCurrency } from "@/lib/dpo-currency";

export { dpoCurrency };

export function isoCustomerCountry(value?: string) {
  const raw = String(value ?? "").trim();
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  if (/namibia/i.test(raw)) return "NA";
  if (/south africa|rsa/i.test(raw)) return "ZA";
  if (/france/i.test(raw)) return "FR";
  return "NA";
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

export type CreateTokenXmlInput = {
  companyToken: string;
  serviceType: string;
  companyRef: string;
  amount: number;
  currency: string;
  description: string;
  serviceDate: string;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
  };
  siteUrl: string;
};

/** createToken XML. PaymentAmount is `amount.toFixed(2)` and is not posted here. */
export function buildCreateTokenXml(input: CreateTokenXmlInput) {
  const site = input.siteUrl.replace(/\/$/, "");
  const country = isoCustomerCountry(input.customer.country);
  const phone = (input.customer.phone || "").trim();
  return `<?xml version="1.0" encoding="utf-8"?>
<API3G>
  <CompanyToken>${escapeXml(input.companyToken)}</CompanyToken>
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
      <ServiceType>${escapeXml(input.serviceType)}</ServiceType>
      <ServiceDescription>${escapeXml(input.description)}</ServiceDescription>
      <ServiceDate>${input.serviceDate}</ServiceDate>
    </Service>
  </Services>
</API3G>`;
}
