export type TermsClause = {
  number: number;
  title: string;
  items: string[];
};

export const TERMS_VERSION = "6 October 2026";

export const TERMS_COMPANY =
  "RAPPI Investments CC (Reg. No. CC/2025/02866), trading as RAPPI Sports Hub";

export const TERMS_ADDRESS =
  "Erf 1203, Unit 2, De Waterman, Mandume Ndemafayo Circle, Meersig, Walvis Bay";

export const TERMS_SUMMARY = {
  heading: "Trading terms",
  body: "All sales by RAPPI Investments CC t/a RAPPI Sports Hub are subject to the Company's Standard Terms and Conditions of Trade and its Returns, Exchanges and Refunds Policy, both displayed at the till point and available at www.rappisportshub.com or on request. By placing an order, paying a deposit or taking delivery, the Customer accepts those terms.",
  keyTerms: [
    "Prices include VAT and are subject to change.",
    "Ownership of goods remains with the Company until payment is received in full.",
    "Risk passes on delivery or collection.",
    "Deposits on special and personalized orders are not refundable once the order is placed.",
    "Goods must be inspected on collection and visible damage reported within 48 hours.",
    "Overdue amounts attract interest and collection costs.",
    "No variation of these terms is binding unless in writing and signed by an authorized representative.",
  ],
};

export const TERMS_CLAUSES: TermsClause[] = [
  {
    number: 1,
    title: "Definitions",
    items: [
      '"the Company" means RAPPI Investments CC, registration number CC/2025/02866, trading as RAPPI Sports Hub, including its members, employees and duly authorized representatives.',
      '"the Customer" means any person or entity who purchases goods or services from the Company, places an order, opens a layby or account, or uses the Company\'s facilities.',
      '"Goods" means any sporting apparel, footwear, equipment, accessories, consumables or other merchandise supplied by the Company.',
      '"Services" means any service offered by the Company, including but not limited to equipment assembly, stringing, fitting, repairs, printing and any coaching, facility hire or event services.',
      '"the Returns Policy" means the Company\'s Returns, Exchanges and Refunds Policy as displayed in store and published online, as amended from time to time.',
      "Words importing the singular include the plural and vice versa, and words importing one gender include the others.",
    ],
  },
  {
    number: 2,
    title: "Application of these terms",
    items: [
      "These terms govern every sale of Goods and every supply of Services by the Company, and take effect on the earlier of the Customer placing an order, paying a deposit, taking delivery of Goods, or signing any Company document that refers to these terms.",
      "These terms prevail over any terms proposed by the Customer, including terms printed on a purchase order, unless the Company agrees otherwise in writing signed by a member or authorized representative.",
      "The Returns Policy forms part of these terms. Where the two conflict, the Returns Policy prevails in respect of returns, exchanges and refunds.",
      "The Company may amend these terms at any time. The version displayed in store and published online at the time of the transaction is the version that applies to that transaction.",
    ],
  },
  {
    number: 3,
    title: "Quotations and orders",
    items: [
      "A quotation is an invitation to do business and is not an offer capable of acceptance. A quotation is valid for 14 days from date of issue unless stated otherwise, and lapses automatically thereafter.",
      "A contract of sale comes into existence only when the Company accepts the Customer's order, whether by written confirmation, by accepting payment or a deposit, or by delivering the Goods.",
      "The Company may decline any order, in whole or in part, without giving reasons. Where an order is declined after payment, the amount received is refunded in full.",
      "Orders are subject to availability. Where Goods become unavailable, the Company will notify the Customer and offer a substitute, a credit or a refund of any amount paid.",
    ],
  },
  {
    number: 4,
    title: "Prices and Value Added Tax",
    items: [
      "Prices are quoted in Namibian dollars (N$) and, unless expressly stated otherwise, include Value Added Tax at the prevailing rate.",
      "Prices are subject to change without notice. The price applicable is the price ruling at the date of the invoice, save where the Company has confirmed a fixed price in writing for a specific order.",
      "The Company takes reasonable care with pricing, but is not bound by an obvious error in a displayed, advertised or quoted price. Where such an error occurs, the Company will notify the Customer, and the Customer may proceed at the corrected price or cancel and receive a full refund.",
      "A tax invoice is issued for every sale. The Customer must check the invoice at the point of sale.",
    ],
  },
  {
    number: 5,
    title: "Payment",
    items: [
      "Unless a credit account or layby has been agreed in writing, payment is due in full before Goods are released.",
      "The Company accepts cash, debit and credit card, EFT and mobile payment. Cheques are not accepted.",
      "Payment by electronic transfer is regarded as received only once the funds reflect as cleared in the Company's bank account. Proof of payment is not proof of clearance.",
      "The Customer may not withhold or set off any amount against a sum due to the Company for any reason.",
      "A card payment may be refunded only to the same card. The Company does not refund card payments in cash.",
    ],
  },
  {
    number: 6,
    title: "Special orders, team kit and personalisation",
    items: [
      "Goods ordered specially for the Customer, and Goods that are printed, embroidered, numbered or otherwise personalized, require a deposit of 50% of the purchase price on placing the order.",
      "The Customer must confirm all specifications in writing before the order is placed with the supplier, including sizes, quantities, colours, names, numbers and spelling. The Company produces from that written confirmation and is not responsible for an error in the information supplied.",
      "Because such Goods cannot be resold, the deposit is not refundable once the order has been placed with the supplier, and the Goods may not be returned or exchanged except where they are defective.",
      "Delivery periods for special orders are estimates given in good faith and are not guaranteed. The Company is not liable for a supplier delay, and a delay does not entitle the Customer to cancel unless the delay exceeds 60 days from the confirmed order date.",
    ],
  },
  {
    number: 7,
    title: "Layby",
    items: [
      "A layby is opened on payment of a deposit of 20% and is subject to a separate written layby agreement signed by the Customer.",
      "Goods held on layby remain the property of the Company and are released only on payment in full.",
      "The layby period is 3 months. Where the Customer cancels, or fails to maintain payments for 2 consecutive months after written notice, the Company may cancel the layby, return the Goods to stock and refund amounts paid less an administration fee of 10% of the purchase price.",
      "Layby prices are fixed at the date the layby is opened and are not affected by subsequent price changes or promotions.",
    ],
  },
  {
    number: 8,
    title: "Credit accounts",
    items: [
      "Credit sales may attract the Credit Agreements Act 75 of 1980 and separate legal advice is required before any credit facility is offered.",
      "Credit is granted at the Company's sole discretion, subject to a signed credit application, and may be withdrawn or reduced at any time on written notice.",
      "Amounts on account are payable within 30 days of statement date.",
    ],
  },
  {
    number: 9,
    title: "Ownership",
    items: [
      "Notwithstanding delivery, ownership in the Goods remains vested in the Company until the Company has received payment in full in cleared funds.",
      "Until ownership passes, the Customer holds the Goods as the Company's bailee, must keep them identifiable and in good condition, and may not sell, pledge, encumber or otherwise dispose of them.",
      "Where payment is not made when due, the Company may, without prejudice to its other rights, take possession of the Goods, and the Customer irrevocably authorises the Company's representatives to enter the premises where the Goods are kept for that purpose.",
    ],
  },
  {
    number: 10,
    title: "Risk",
    items: [
      "Risk in the Goods passes to the Customer on delivery or on collection, whichever occurs first, notwithstanding that ownership has not passed.",
      "The Customer must inspect the Goods on delivery or collection and note any visible damage, shortage or incorrect item on the delivery note or invoice at that time. Claims for visible damage or shortage must be lodged within 48 hours.",
      "This clause does not affect the Customer's rights in respect of latent defects, which are dealt with in the Returns Policy.",
    ],
  },
  {
    number: 11,
    title: "Delivery and collection",
    items: [
      "Delivery periods are estimates. Time is not of the essence unless agreed in writing.",
      "Where the Company arranges delivery, delivery charges are quoted separately and are payable in advance.",
      "The Company may deliver in instalments and invoice each instalment separately.",
      "Where the Customer or the Customer's agent signs for the Goods at the delivery address, delivery is regarded as complete and valid.",
    ],
  },
  {
    number: 12,
    title: "Uncollected goods",
    items: [
      "Goods left with the Company for repair, service, printing, assembly or stringing, and Goods ordered specially and not collected, must be collected within 30 days of the Company notifying the Customer that they are ready.",
      "After 90 days from that notification, and after a further written notice to the Customer's last known contact details, the Company may sell the Goods to recover the amount owing and its reasonable costs, and account to the Customer for any balance.",
      "A storage fee of N$500 per item per month may be charged from the date collection becomes overdue.",
    ],
  },
  {
    number: 13,
    title: "Returns, exchanges and refunds",
    items: [
      "Returns, exchanges and refunds are governed by the Returns Policy, which is displayed at the till point and published online and forms part of these terms.",
      "Nothing in these terms limits the Customer's common law remedies in respect of latent defects.",
    ],
  },
  {
    number: 14,
    title: "Product information, sizing and condition",
    items: [
      "Product descriptions, specifications, images and sizing guides are supplied by manufacturers and are provided as a guide. Minor variation in colour, finish, weight or measurement does not constitute a defect.",
      "The Customer is responsible for satisfying itself that the Goods are suitable for the Customer's intended purpose, and the Company gives no warranty of fitness for a particular purpose unless it has expressly done so in writing.",
      'Goods sold as clearance, ex-display, floor stock, second-hand or "sold as seen" are sold voetstoots in respect of the specific condition or defect disclosed to the Customer and recorded on the invoice at the time of sale. This clause does not apply to any defect known to the Company and not disclosed.',
    ],
  },
  {
    number: 15,
    title: "Manufacturer warranties",
    items: [
      "Where Goods carry a manufacturer warranty, that warranty is given by the manufacturer and not by the Company, and its terms, duration and exclusions are set by the manufacturer.",
      "The Company will lodge and administer warranty claims on the Customer's behalf as a service, but does not guarantee the outcome and is not liable for a manufacturer's decision or delay.",
      "Warranties are void where Goods have been misused, modified, serviced by an unauthorised person, used in competition beyond their rated purpose, or maintained contrary to the manufacturer's instructions.",
    ],
  },
  {
    number: 16,
    title: "Limitation of liability",
    items: [
      "The Company's total liability arising out of any transaction is limited to the purchase price of the Goods or Services concerned.",
      "The Company is not liable for indirect, special or consequential loss of any nature, including loss of profit, loss of opportunity, missed events or competitions, travel or accommodation costs, or loss of training time.",
      "Nothing in these terms excludes or limits the Company's liability for death or personal injury caused by its negligence, for fraud or fraudulent misrepresentation, or for any liability that may not lawfully be excluded.",
      "The Customer must use Goods in accordance with the manufacturer's instructions and any applicable safety guidance. The Company is not liable for injury or loss arising from misuse, incorrect assembly by the Customer, or use of Goods beyond their rated purpose.",
    ],
  },
  {
    number: 17,
    title: "Use of facilities, coaching and events",
    items: [
      "Participation in any physical activity carries inherent risk. The Customer participates voluntarily and at own risk, and warrants that the Customer is medically fit to do so.",
      "The Customer indemnifies the Company against any claim arising from the Customer's participation, save where the claim arises from the Company's negligence.",
      "Minors may participate only with the written consent of a parent or guardian, who signs the indemnity on the minor's behalf.",
    ],
  },
  {
    number: 18,
    title: "Gift cards, vouchers and promotions",
    items: [
      "Gift cards and vouchers are valid for 12 months from date of issue, are not exchangeable for cash, and are not replaced if lost, stolen or damaged.",
      "Promotional offers are valid for the stated period, while stocks last, and may not be combined with another offer unless expressly stated.",
      "Competitions are subject to their own published rules. The Company's decision on any competition is final and no correspondence is entered into.",
    ],
  },
  {
    number: 19,
    title: "Breach and default",
    items: [
      "Where the Customer fails to pay any amount on due date, the full outstanding balance becomes immediately due and payable without further notice.",
      "Overdue amounts bear interest at 30% per annum, calculated daily from due date to date of payment, provided that the rate charged shall not exceed the maximum permitted by Namibian law.",
      "The Customer is liable for all costs incurred by the Company in recovering an overdue amount, including collection commission and legal costs on the attorney-and-own-client scale.",
      "A certificate signed by a member of the Company stating the amount owing is prima facie proof of the amount for the purpose of obtaining judgment, and it is not necessary to prove the authority of the person signing.",
    ],
  },
  {
    number: 20,
    title: "General",
    items: [
      "These terms, together with the Returns Policy and any signed order, layby or credit document, constitute the entire agreement between the parties. No representation, warranty or undertaking not recorded in writing is binding on the Company.",
      "No indulgence granted by the Company constitutes a waiver of any of its rights.",
      "No variation of these terms is of any force unless reduced to writing and signed by a member or duly authorised representative of the Company.",
      "If any provision is found to be unenforceable, it is severed and the remaining provisions continue in full force.",
      "The Customer may not cede or assign any rights under these terms without the Company's written consent.",
    ],
  },
  {
    number: 21,
    title: "Personal information",
    items: [
      "The Company collects and processes the Customer's personal information for the purposes of concluding and administering the sale, processing payment, administering warranties, returns and deliveries, and complying with its legal obligations.",
      "The Company takes reasonable steps to keep that information secure and does not sell it to third parties. It may be shared with suppliers, manufacturers, payment providers and, where an account is in default, with a debt collection agency.",
      "The Customer consents to receiving service communications relating to a transaction. Marketing communications are sent only where the Customer has opted in, and the Customer may opt out at any time by email.",
      "The Customer may request access to, or correction of, personal information held about them by writing to sales@rappisportshub.com.",
    ],
  },
  {
    number: 22,
    title: "Domicilium, notices and jurisdiction",
    items: [
      "The Company chooses as its domicilium citandi et executandi the address Erf 1203, Unit 2, De Waterkant, Mandume Ndemafayo Circle, Meersig, Walvis Bay.",
      "The Customer chooses as its domicilium the address recorded on the order, account application or invoice, and must notify the Company in writing of any change.",
      "Notices may be delivered by hand, sent by registered post, or sent to the email address recorded by the Customer, and are deemed received on delivery, on the 7th day after posting, or on the date of transmission respectively.",
      "These terms are governed by the law of the Republic of Namibia.",
      "The Customer consents to the jurisdiction of the Magistrate's Court having jurisdiction over the Customer in respect of any proceedings arising from these terms, notwithstanding that the amount in dispute may exceed that court's ordinary jurisdiction, provided that the Company may institute proceedings in any competent court.",
    ],
  },
  {
    number: 23,
    title: "Complaints",
    items: [
      "A Customer who is dissatisfied should raise the matter with the manager on duty. If unresolved, the complaint should be submitted in writing to sales@rappisportshub.com, and the Company will respond within 7 working days.",
      "This procedure does not affect any legal rights the Customer may have.",
    ],
  },
];
