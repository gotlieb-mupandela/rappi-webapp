export type ReturnsClause = {
  number: number;
  title: string;
  body?: string[];
  items?: string[];
  after?: string[];
};

export const RETURNS_VERSION = "6 October 2026";

export const RETURNS_COMPANY =
  "RAPPI Investments CC (Reg. No. CC/2025/02866), trading as RAPPI Sports Hub";

export const RETURNS_ADDRESS =
  "Erf 1203, Unit 2, De Waterkant, Mandume Ndemafayo Circle, Meersig, Walvis Bay";

export const RETURNS_INTRO =
  "We want you to be happy with what you buy from us. This policy explains what we will do if something is wrong, and what we can and cannot accept back. It forms part of your purchase agreement with RAPPI Investments CC t/a RAPPI Sports Hub.";

export const RETURNS_SUMMARY = {
  heading: "Returns at RAPPI Sports Hub",
  items: [
    "Keep your till slip. We cannot assist without proof of purchase.",
    "Changed your mind? Exchange or credit note within 14 days, unused and tagged.",
    "Faulty item? Bring it in. We will assess it and repair, replace or refund.",
    "We cannot take back underwear, swimwear, mouthguards, opened consumables, personalised or printed kit, special orders, gift cards, or clearance items sold as seen.",
    "Refunds are paid by the same method you paid with. Card purchases are not refunded in cash.",
  ],
};

export const RETURNS_CLAUSES: ReturnsClause[] = [
  {
    number: 1,
    title: "Proof of purchase",
    body: [
      "We can only process a return, exchange or refund against the original RAPPI Sports Hub till slip or tax invoice. Please keep it. Without proof of purchase we cannot verify the item, the price or the date, and we are not able to assist.",
    ],
  },
  {
    number: 2,
    title: "If you change your mind",
    body: [
      "You are not automatically entitled to a refund because you changed your mind, but as a goodwill gesture we will offer an exchange or a credit note if all of the following apply:",
    ],
    items: [
      "You return the item within 14 days of purchase.",
      "The item is unused, unworn and in its original condition, with all tags, labels and original packaging intact.",
      "You present the original till slip.",
      "The item is not on the excluded list in clause 5.",
    ],
    after: [
      "Change-of-mind returns are settled by exchange or credit note. Credit notes are valid for six months from date of issue. We do not refund cash for change-of-mind returns.",
    ],
  },
  {
    number: 3,
    title: "If the item is faulty",
    body: [
      "If an item has a manufacturing fault, tell us as soon as you notice it. Bring the item and your till slip to the store.",
    ],
    items: [
      "We will inspect the item and, where required, send it to the supplier or manufacturer for assessment.",
      "Assessment normally takes up to 14 working days. We will keep you informed and give you a written reference number.",
      "If the fault is confirmed as a manufacturing defect, we will repair the item, replace it, or refund you — and we will discuss which of these suits you best.",
      "If the assessment finds the damage was caused by normal wear and tear, misuse, accident, poor fit, incorrect care or unauthorised repair, we will return the item to you unrepaired and explain why.",
    ],
    after: [
      "Faulty-goods claims are not limited to 14 days. Your rights under Namibian common law in respect of latent defects are not affected by this policy.",
    ],
  },
  {
    number: 4,
    title: "Manufacturer warranties",
    body: [
      "Some items — bicycles, fitness equipment, electronics, watches and similar goods — carry a manufacturer warranty that runs longer than our own return period. Warranty terms are set by the manufacturer, not by us. We will help you lodge a warranty claim and act as the point of contact, but the manufacturer decides the outcome.",
    ],
  },
  {
    number: 5,
    title: "Items we cannot take back",
    body: [
      "For hygiene, safety and practical reasons, the following cannot be returned or exchanged unless they are faulty:",
    ],
    items: [
      "Underwear, base layers, swimwear, socks and compression garments.",
      "Mouthguards, protective cups and any item worn against the skin or in the mouth.",
      "Nutritional supplements, sports drinks and any consumable product, once the seal is broken.",
      "Personalised, printed, embroidered, numbered or custom-made items, including team kit and name-and-number printing.",
      "Items ordered in specially at your request, where we do not normally hold stock.",
      "Gift cards and vouchers.",
      'Items sold as clearance, floor stock, ex-display or "sold as seen", where the fault or wear was pointed out to you and noted on the invoice at the time of sale.',
    ],
  },
  {
    number: 6,
    title: "Condition of returned items",
    body: [
      "We can only accept items back in a resaleable state. That means clean, dry, unworn and complete, with tags attached and the original box or packaging included. Footwear must be unworn and returned in its original box; shoes that have been worn outdoors cannot be exchanged for change of mind.",
    ],
  },
  {
    number: 7,
    title: "How refunds are paid",
    items: [
      "Approved refunds are paid using the same method as the original payment. Card purchases are refunded to the same card; EFT purchases are refunded to the originating bank account.",
      "We cannot refund a card purchase in cash.",
      "Refunds to a bank account are processed within 14 working days of approval. The time your bank takes to reflect the money is outside our control.",
      "A refund is accompanied by a credit note against the original tax invoice.",
    ],
  },
  {
    number: 8,
    title: "Layby",
    body: [
      "Layby terms are agreed in writing when the layby is opened. If a layby is cancelled by the customer, the goods return to stock and payments made are refunded less an administration fee of 30% of the purchase price. If instalments are not maintained for 3 consecutive months, we will contact you before cancelling. Layby terms are set out in full on the layby agreement you sign.",
    ],
  },
  {
    number: 9,
    title: "Special orders and team kit",
    body: [
      "Special orders and team or club kit require a deposit of 50% at the time of order. Because these goods are produced or ordered specifically for you, the deposit is not refundable once the order has been placed with the supplier. Sizes and printing details are confirmed in writing by you before the order goes through, and we work from that confirmation.",
    ],
  },
  {
    number: 10,
    title: "Gifts",
    body: [
      "If you received the item as a gift and have the gift receipt, we will issue a credit note in your name on the same terms as clause 2. We cannot pay a cash refund on a gift return.",
    ],
  },
  {
    number: 11,
    title: "Product recalls and safety",
    body: [
      "If a supplier or manufacturer recalls a product, we will refund or replace it in full regardless of the time periods in this policy. Please stop using a recalled item immediately.",
    ],
  },
  {
    number: 12,
    title: "Limits",
    body: [
      "Except where the law says otherwise, RAPPI Sports Hub is not liable for indirect or consequential loss arising from a defective item — for example missed competitions, travel costs or lost earnings. Nothing in this policy excludes or limits liability for death or personal injury caused by our negligence, or for fraud.",
    ],
  },
  {
    number: 13,
    title: "If you are not satisfied",
    body: [
      "Speak to the manager on duty first — most matters are resolved on the spot. If you are still not satisfied, put your complaint in writing to admin@rappisportshub.com and we will respond within 7 working days. This does not affect any legal rights you may have.",
    ],
  },
];
