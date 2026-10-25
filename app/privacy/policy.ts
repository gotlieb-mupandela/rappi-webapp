import type { Market } from "@/lib/i18n/config";

export type PolicySection = {
  heading: string;
  body?: string[];
  items?: string[];
};

export type Policy = {
  eyebrow: string;
  title: string;
  intro: string;
  updatedLabel: string;
  updated: string;
  sections: PolicySection[];
  contactHeading: string;
  contactBody: string;
};

const en: Policy = {
  eyebrow: "Legal",
  title: "Privacy policy",
  intro:
    "How RAPPI Sports Hub collects, uses and protects your personal data on rappisportshub.com and in the RAPPI Sports Hub app.",
  updatedLabel: "Last updated",
  updated: "6 October 2026",
  sections: [
    {
      heading: "Who we are",
      body: [
        "RAPPI Sports Hub is an independent sportswear and equipment store based in Windhoek, Namibia. We operate the website rappisportshub.com and the RAPPI Sports Hub mobile app, and we are responsible for the personal data described here.",
      ],
    },
    {
      heading: "What we collect",
      items: [
        "Account details: your email address, name and password (stored hashed by our authentication provider). If you sign in with Google, we receive your name and email from Google.",
        "Order details: name, email, phone number, delivery address, city, country, delivery method, notes, the items you bought and the amounts paid.",
        "Payment records: a payment reference, amount, status and the name and email given at checkout. Card numbers are entered on our payment provider's page and never reach us.",
        "Team kit quotes: the name, email, organisation, sport, number of players, sizes and notes you send through the quote form.",
        "Notifications: if you turn on order notifications, a device or browser push token linked to your account.",
        "Device storage: your bag, wishlist, sign-in session and market preference (Namibia or EU) are saved on your device so they survive a restart.",
        "Website analytics: on the website only, the Meta Pixel records page views and shopping events (such as viewing a product or completing a purchase) using cookies.",
      ],
    },
    {
      heading: "How we use it",
      items: [
        "To create and run your account and let you sign in on the website and the app.",
        "To take payment, fulfil and deliver your order, and email your invoice.",
        "To send order status notifications you have switched on.",
        "To answer team kit quote requests and other messages.",
        "To keep accounting and tax records we are legally required to keep.",
        "To measure and improve our advertising on Meta (website only).",
        "To prevent fraud and keep the service secure.",
      ],
    },
    {
      heading: "Who we share it with",
      body: [
        "We do not sell your personal data. We share it only with the service providers that run the store for us, and only what each needs:",
      ],
      items: [
        "Supabase: account sign-in and our database (accounts, orders, quotes, push tokens).",
        "Vercel: hosts the website and the server the app talks to.",
        "DPO Pay (3G Direct Pay): processes card payments.",
        "Resend: delivers invoice emails.",
        "Google: only if you choose to sign in with Google.",
        "Expo and Apple/Google push services: deliver app notifications. Web browsers' push services deliver website notifications.",
        "Meta: receives website shopping events through the Meta Pixel, and, after a purchase, a hashed (scrambled) copy of your email and first name with the order value so we can measure ads. The app does not send data to Meta.",
      ],
    },
    {
      heading: "International transfers",
      body: [
        "Some of these providers store or process data outside Namibia, including in the European Union and the United States. Where the GDPR applies, we rely on our providers' standard contractual clauses or equivalent safeguards.",
      ],
    },
    {
      heading: "How long we keep it",
      items: [
        "Account data: until you delete your account.",
        "Orders, payments and invoices: as long as tax and accounting law requires, even after an account is deleted. These records are unlinked from the deleted account.",
        "Team kit quotes: as long as needed to answer and follow up on the request.",
        "Push tokens: until you turn notifications off, sign out, delete your account, or the token stops working.",
        "Device storage: until you sign out, clear it, or uninstall the app.",
      ],
    },
    {
      heading: "Deleting your account",
      body: [
        "In the app, go to Account and tap Delete account. On the website, sign in and open rappisportshub.com/account/delete. This permanently deletes your account and the personal data linked to it, apart from the order records we must keep by law.",
        "You can also ask us to delete your account without the app by emailing us from the address on your account. We confirm by email once it's done.",
      ],
    },
    {
      heading: "Your rights",
      body: [
        "You can ask us to access, correct, export or delete your personal data, or object to how we use it. If you are in the European Union, you have these rights under the GDPR and may also complain to your local data protection authority. Withdraw notification permission at any time in your device or browser settings.",
      ],
    },
    {
      heading: "Cookies and similar technology",
      body: [
        "The website uses cookies and local storage to keep you signed in, remember your bag, wishlist and market, and, through the Meta Pixel, to measure advertising. You can block or clear cookies in your browser; the store still works, but you may need to sign in again.",
      ],
    },
    {
      heading: "Children",
      body: [
        "The store is not aimed at children under 13, and we do not knowingly collect their data. Parents can contact us to have a child's data removed.",
      ],
    },
    {
      heading: "Security",
      body: [
        "Data travels over HTTPS. Database access is restricted so each customer can read only their own orders, and payment secrets stay on our server. No system is perfectly secure, but we limit what we collect and who can see it.",
      ],
    },
    {
      heading: "Changes",
      body: [
        "We will update this page when our practices change and revise the date at the top. For significant changes, we will tell account holders by email or in the app.",
      ],
    },
  ],
  contactHeading: "Contact",
  contactBody: "Questions or requests about your data? Email us at",
};

const fr: Policy = {
  eyebrow: "Mentions légales",
  title: "Politique de confidentialité",
  intro:
    "Comment RAPPI Sports Hub collecte, utilise et protège vos données personnelles sur rappisportshub.com et dans l'application RAPPI Sports Hub.",
  updatedLabel: "Dernière mise à jour",
  updated: "6 octobre 2026",
  sections: [
    {
      heading: "Qui sommes-nous",
      body: [
        "RAPPI Sports Hub est une boutique indépendante de vêtements et d'équipements de sport basée à Windhoek, en Namibie. Nous exploitons le site rappisportshub.com et l'application mobile RAPPI Sports Hub, et sommes responsables des données personnelles décrites ici.",
      ],
    },
    {
      heading: "Ce que nous collectons",
      items: [
        "Compte : votre adresse e-mail, votre nom et votre mot de passe (stocké sous forme chiffrée par notre prestataire d'authentification). Si vous vous connectez avec Google, nous recevons votre nom et votre e-mail de Google.",
        "Commandes : nom, e-mail, téléphone, adresse de livraison, ville, pays, mode de livraison, notes, articles achetés et montants payés.",
        "Paiements : une référence de paiement, le montant, le statut, ainsi que le nom et l'e-mail saisis au paiement. Les numéros de carte sont saisis sur la page de notre prestataire de paiement et ne nous parviennent jamais.",
        "Devis équipe : le nom, l'e-mail, l'organisation, le sport, le nombre de joueurs, les tailles et les notes envoyés via le formulaire de devis.",
        "Notifications : si vous activez les notifications de commande, un jeton push de l'appareil ou du navigateur lié à votre compte.",
        "Stockage sur l'appareil : votre panier, vos favoris, votre session et votre marché (Namibie ou UE) sont enregistrés sur votre appareil.",
        "Mesure d'audience : sur le site uniquement, le pixel Meta enregistre les pages vues et les événements d'achat (consultation d'un produit, achat terminé) à l'aide de cookies.",
      ],
    },
    {
      heading: "Comment nous les utilisons",
      items: [
        "Créer et gérer votre compte, et vous permettre de vous connecter sur le site et l'application.",
        "Encaisser le paiement, préparer et livrer votre commande, et vous envoyer la facture par e-mail.",
        "Envoyer les notifications de suivi de commande que vous avez activées.",
        "Répondre aux demandes de devis équipe et aux autres messages.",
        "Conserver les justificatifs comptables et fiscaux exigés par la loi.",
        "Mesurer et améliorer nos publicités sur Meta (site uniquement).",
        "Prévenir la fraude et sécuriser le service.",
      ],
    },
    {
      heading: "Avec qui nous les partageons",
      body: [
        "Nous ne vendons pas vos données personnelles. Nous les partageons uniquement avec les prestataires qui font fonctionner la boutique, et seulement ce dont chacun a besoin :",
      ],
      items: [
        "Supabase : connexion aux comptes et base de données (comptes, commandes, devis, jetons push).",
        "Vercel : héberge le site et le serveur utilisé par l'application.",
        "DPO Pay (3G Direct Pay) : traite les paiements par carte.",
        "Resend : envoie les factures par e-mail.",
        "Google : uniquement si vous choisissez de vous connecter avec Google.",
        "Expo et les services push d'Apple/Google : envoient les notifications de l'application. Les services push des navigateurs envoient celles du site.",
        "Meta : reçoit les événements d'achat du site via le pixel Meta et, après un achat, une version hachée (brouillée) de votre e-mail et de votre prénom avec le montant de la commande, pour mesurer nos publicités. L'application n'envoie aucune donnée à Meta.",
      ],
    },
    {
      heading: "Transferts internationaux",
      body: [
        "Certains prestataires stockent ou traitent des données hors de Namibie, notamment dans l'Union européenne et aux États-Unis. Lorsque le RGPD s'applique, nous nous appuyons sur les clauses contractuelles types de nos prestataires ou des garanties équivalentes.",
      ],
    },
    {
      heading: "Durée de conservation",
      items: [
        "Données de compte : jusqu'à la suppression de votre compte.",
        "Commandes, paiements et factures : aussi longtemps que l'exigent les lois fiscales et comptables, même après la suppression du compte. Ces enregistrements sont alors dissociés du compte supprimé.",
        "Devis équipe : le temps nécessaire pour répondre et assurer le suivi.",
        "Jetons push : jusqu'à ce que vous désactiviez les notifications, vous déconnectiez, supprimiez votre compte ou que le jeton expire.",
        "Stockage sur l'appareil : jusqu'à la déconnexion, l'effacement ou la désinstallation de l'application.",
      ],
    },
    {
      heading: "Supprimer votre compte",
      body: [
        "Dans l'application, ouvrez Compte puis touchez Supprimer le compte. Sur le site, connectez-vous et ouvrez rappisportshub.com/account/delete. Votre compte et les données personnelles qui y sont liées sont supprimés définitivement, à l'exception des enregistrements de commande que la loi nous oblige à conserver.",
        "Vous pouvez aussi demander la suppression sans l'application en nous écrivant depuis l'adresse e-mail de votre compte. Nous confirmons par e-mail une fois la suppression effectuée.",
      ],
    },
    {
      heading: "Vos droits",
      body: [
        "Vous pouvez demander l'accès, la rectification, la portabilité ou la suppression de vos données, ou vous opposer à leur utilisation. Si vous êtes dans l'Union européenne, ces droits vous sont garantis par le RGPD et vous pouvez saisir l'autorité de protection des données de votre pays (en France, la CNIL). Vous pouvez retirer l'autorisation de notifications à tout moment dans les réglages de votre appareil ou navigateur.",
      ],
    },
    {
      heading: "Cookies et technologies similaires",
      body: [
        "Le site utilise des cookies et le stockage local pour vous garder connecté, mémoriser votre panier, vos favoris et votre marché, et, via le pixel Meta, mesurer nos publicités. Vous pouvez bloquer ou effacer les cookies dans votre navigateur ; la boutique fonctionne toujours, mais vous devrez peut-être vous reconnecter.",
      ],
    },
    {
      heading: "Enfants",
      body: [
        "La boutique ne s'adresse pas aux enfants de moins de 13 ans et nous ne collectons pas sciemment leurs données. Les parents peuvent nous contacter pour faire supprimer les données d'un enfant.",
      ],
    },
    {
      heading: "Sécurité",
      body: [
        "Les données transitent en HTTPS. L'accès à la base est restreint pour que chaque client ne puisse lire que ses propres commandes, et les secrets de paiement restent sur notre serveur. Aucun système n'est parfaitement sûr, mais nous limitons ce que nous collectons et qui peut y accéder.",
      ],
    },
    {
      heading: "Modifications",
      body: [
        "Nous mettrons cette page à jour si nos pratiques évoluent et réviserons la date ci-dessus. En cas de changement important, nous informerons les titulaires de compte par e-mail ou dans l'application.",
      ],
    },
  ],
  contactHeading: "Contact",
  contactBody: "Une question ou une demande concernant vos données ? Écrivez-nous à",
};

export function privacyPolicy(market: Market): Policy {
  return market === "eu" ? fr : en;
}
