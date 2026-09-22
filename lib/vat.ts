export type VatCountry = {
  name: string;
  rate: number;
  aliases?: readonly string[];
};

export const VAT_COUNTRIES: readonly VatCountry[] = [
  { name: "Albania", rate: 20 },
  { name: "Angola", rate: 14 },
  { name: "Argentina", rate: 21 },
  { name: "Armenia", rate: 20 },
  { name: "Australia", rate: 10, aliases: ["au"] },
  { name: "Austria", rate: 20, aliases: ["at"] },
  { name: "Azerbaijan", rate: 18 },
  { name: "Bahamas", rate: 10 },
  { name: "Bahrain", rate: 10 },
  { name: "Bangladesh", rate: 15 },
  { name: "Belgium", rate: 21, aliases: ["be"] },
  { name: "Bermuda", rate: 0 },
  { name: "Bolivia", rate: 13 },
  { name: "Bosnia and Herzegovina", rate: 17, aliases: ["bosnia"] },
  { name: "Botswana", rate: 14 },
  { name: "Brazil", rate: 18, aliases: ["br"] },
  { name: "Brunei Darussalam", rate: 0, aliases: ["brunei"] },
  { name: "Bulgaria", rate: 20, aliases: ["bg"] },
  { name: "Cambodia", rate: 10 },
  { name: "Cameroon", rate: 19.25 },
  { name: "Canada", rate: 13, aliases: ["ca"] },
  { name: "Cayman Islands", rate: 0 },
  { name: "Chile", rate: 19 },
  { name: "China", rate: 13, aliases: ["cn", "prc"] },
  { name: "Colombia", rate: 19 },
  { name: "Costa Rica", rate: 13 },
  { name: "Côte d’Ivoire", rate: 18, aliases: ["cote d ivoire", "ivory coast"] },
  { name: "Croatia", rate: 25, aliases: ["hr"] },
  { name: "Cyprus", rate: 19 },
  { name: "Czechia", rate: 21, aliases: ["czech republic", "cz"] },
  { name: "Democratic Republic of the Congo", rate: 16, aliases: ["drc", "congo kinshasa"] },
  { name: "Denmark", rate: 25, aliases: ["dk"] },
  { name: "Dominican Republic", rate: 18 },
  { name: "Ecuador", rate: 15 },
  { name: "Egypt", rate: 14, aliases: ["eg"] },
  { name: "El Salvador", rate: 13 },
  { name: "Equatorial Guinea", rate: 15 },
  { name: "Estonia", rate: 24, aliases: ["ee"] },
  { name: "Eswatini", rate: 15, aliases: ["swaziland"] },
  { name: "Ethiopia", rate: 15 },
  { name: "Finland", rate: 25.5, aliases: ["fi"] },
  { name: "France", rate: 20, aliases: ["fr"] },
  { name: "Gabon", rate: 18 },
  { name: "Georgia", rate: 18 },
  { name: "Germany", rate: 19, aliases: ["de"] },
  { name: "Ghana", rate: 15 },
  { name: "Gibraltar", rate: 0 },
  { name: "Greece", rate: 24, aliases: ["gr"] },
  { name: "Guatemala", rate: 12 },
  { name: "Guernsey", rate: 0 },
  { name: "Honduras", rate: 15 },
  { name: "Hong Kong SAR", rate: 0, aliases: ["hong kong", "hk"] },
  { name: "Hungary", rate: 27, aliases: ["hu"] },
  { name: "Iceland", rate: 24 },
  { name: "India", rate: 18, aliases: ["in"] },
  { name: "Indonesia", rate: 12, aliases: ["id"] },
  { name: "Ireland", rate: 23, aliases: ["ie"] },
  { name: "Isle of Man", rate: 20 },
  { name: "Israel", rate: 18 },
  { name: "Italy", rate: 22, aliases: ["it"] },
  { name: "Jamaica", rate: 15 },
  { name: "Japan", rate: 10, aliases: ["jp"] },
  { name: "Jersey", rate: 5 },
  { name: "Jordan", rate: 16 },
  { name: "Kazakhstan", rate: 16 },
  { name: "Kenya", rate: 16, aliases: ["ke"] },
  { name: "Kosovo", rate: 18 },
  { name: "Kuwait", rate: 0 },
  { name: "Lao PDR", rate: 10, aliases: ["laos"] },
  { name: "Latvia", rate: 21, aliases: ["lv"] },
  { name: "Lebanon", rate: 11 },
  { name: "Libya", rate: 0 },
  { name: "Liechtenstein", rate: 8.1 },
  { name: "Lithuania", rate: 21, aliases: ["lt"] },
  { name: "Luxembourg", rate: 17, aliases: ["lu"] },
  { name: "Macau SAR", rate: 0, aliases: ["macau", "macao"] },
  { name: "Malaysia", rate: 10, aliases: ["my"] },
  { name: "Malta", rate: 18, aliases: ["mt"] },
  { name: "Mauritania", rate: 16 },
  { name: "Mauritius", rate: 15 },
  { name: "Mexico", rate: 16, aliases: ["mx"] },
  { name: "Moldova", rate: 20 },
  { name: "Mongolia", rate: 10 },
  { name: "Montenegro", rate: 21 },
  { name: "Mozambique", rate: 16 },
  { name: "Myanmar", rate: 5 },
  { name: "Namibia", rate: 15, aliases: ["na", "nam"] },
  { name: "Netherlands", rate: 21, aliases: ["nl"] },
  { name: "New Caledonia", rate: 11 },
  { name: "New Zealand", rate: 15, aliases: ["nz"] },
  { name: "Nicaragua", rate: 15 },
  { name: "Nigeria", rate: 7.5, aliases: ["ng"] },
  { name: "North Macedonia", rate: 18, aliases: ["macedonia"] },
  { name: "Norway", rate: 25, aliases: ["no"] },
  { name: "Oman", rate: 5 },
  { name: "Pakistan", rate: 18, aliases: ["pk"] },
  { name: "Palestinian territories", rate: 16, aliases: ["palestine"] },
  { name: "Panama", rate: 7 },
  { name: "Papua New Guinea", rate: 10 },
  { name: "Paraguay", rate: 10 },
  { name: "Peru", rate: 18 },
  { name: "Philippines", rate: 12 },
  { name: "Poland", rate: 23, aliases: ["pl"] },
  { name: "Portugal", rate: 23, aliases: ["pt"] },
  { name: "Qatar", rate: 0 },
  { name: "Republic of the Congo", rate: 18.9, aliases: ["congo brazzaville", "congo"] },
  { name: "Romania", rate: 21, aliases: ["ro"] },
  { name: "Russia", rate: 22, aliases: ["ru"] },
  { name: "Rwanda", rate: 18 },
  { name: "Saudi Arabia", rate: 15, aliases: ["sa", "ksa"] },
  { name: "Senegal", rate: 18 },
  { name: "Serbia", rate: 20 },
  { name: "Singapore", rate: 9, aliases: ["sg"] },
  { name: "Slovakia", rate: 23, aliases: ["sk"] },
  { name: "Slovenia", rate: 22, aliases: ["si"] },
  { name: "South Africa", rate: 15, aliases: ["za", "rsa"] },
  { name: "South Korea", rate: 10, aliases: ["korea", "korea republic of", "kr"] },
  { name: "Spain", rate: 21, aliases: ["es"] },
  { name: "Sweden", rate: 25, aliases: ["se"] },
  { name: "Switzerland", rate: 8.1, aliases: ["ch"] },
  { name: "Taiwan", rate: 5 },
  { name: "Tanzania", rate: 18, aliases: ["tz"] },
  { name: "Thailand", rate: 7 },
  { name: "Trinidad and Tobago", rate: 12.5 },
  { name: "Turkey", rate: 20, aliases: ["tr"] },
  { name: "Uganda", rate: 18 },
  { name: "Ukraine", rate: 20 },
  { name: "United Arab Emirates", rate: 5, aliases: ["uae", "ae"] },
  { name: "United Kingdom", rate: 20, aliases: ["uk", "gb", "great britain", "england"] },
  { name: "United States", rate: 0, aliases: ["us", "usa", "united states of america"] },
  { name: "Uruguay", rate: 22 },
  { name: "Uzbekistan", rate: 12 },
  { name: "Venezuela", rate: 16 },
  { name: "Vietnam", rate: 10 },
  { name: "Zambia", rate: 16 },
];

export type VatQuote = {
  country: string;
  rate: number;
  amount: number;
  total: number;
};

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const VAT_BY_KEY = new Map<string, VatCountry>();
for (const row of VAT_COUNTRIES) {
  VAT_BY_KEY.set(normalize(row.name), row);
  for (const alias of row.aliases ?? []) {
    VAT_BY_KEY.set(normalize(alias), row);
  }
}

export function resolveVatCountry(country: string): VatCountry | null {
  const key = normalize(country);
  if (!key) return null;
  return VAT_BY_KEY.get(key) ?? null;
}

export function defaultVatCountry(market?: string) {
  return market === "eu" ? "France" : "Namibia";
}

export function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function quoteVat(country: string, net: number): VatQuote {
  const row = resolveVatCountry(country);
  const rate = row?.rate ?? 0;
  const amount = roundMoney(net * (rate / 100));
  return {
    country: row?.name ?? country.trim(),
    rate,
    amount,
    total: roundMoney(net + amount),
  };
}

export function formatVatRate(rate: number) {
  return Number.isInteger(rate) ? String(rate) : String(rate);
}
