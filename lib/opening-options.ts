/** Store-opening questionnaire: dates and answer options, shared by the form, API and admin. */

export const OPENING_DAY_LABEL = "Tuesday 5 January 2027";
export const COUPON_VALID_LABEL = "5–31 January 2027";
export const COUPON_RATE = 5;
export const STORE_LINE = "RAPPI Sports Hub, Walvis Bay";
export const STORE_WHATSAPP = "081 814 1646";

export const TOWNS = ["Walvis Bay", "Swakopmund", "Elsewhere in Namibia"] as const;
export const SPORTS = [
  "Football", "Rugby", "Netball", "Basketball", "Padel / tennis", "Running", "Gym / fitness",
  "Swimming", "Volleyball", "Hockey", "Other",
] as const;
export const BUYS_FOR = ["Myself", "My partner", "My kids", "A school", "A club or team"] as const;
export const WANTS = [
  "Football boots", "Running shoes", "Kids & school shoes", "Team kits", "Gym wear", "Swimwear",
  "Padel / tennis gear", "Balls & equipment", "Casual wear",
] as const;
export const SPEND = ["Under N$500", "N$500–1,000", "N$1,000–2,000", "Over N$2,000"] as const;
export const DRAWS = [
  "Opening discounts", "A free gift with purchase", "Giveaways & lucky draws", "Kids' activities",
  "Meeting local athletes",
] as const;
export const ORG_SIZES = ["1–15", "16–50", "51–200", "200+"] as const;

export const MAX_WANTS = 3;
export const MAX_DRAWS = 2;

export type OpeningAnswers = {
  name: string;
  email: string;
  whatsapp: string;
  town: string;
  sports: string[];
  buysFor: string[];
  wants: string[];
  spend: string;
  wishCode: string;
  draws: string[];
  orgName: string;
  orgRole: string;
  orgSize: string;
  notes: string;
  marketingConsent: boolean;
  privacyConsent: boolean;
};

export const needsOrgStep = (buysFor: string[]) => buysFor.includes("A school") || buysFor.includes("A club or team");
