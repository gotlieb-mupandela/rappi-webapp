import type { Market } from "@/lib/i18n/config";

export type DeleteAccountForm = {
  heading: string;
  signedInAs: string;
  warning: string;
  confirmLabel: string;
  confirmWord: string;
  button: string;
  deleting: string;
  done: string;
  failed: string;
  signInHint: string;
  signIn: string;
};

export type DeleteAccountContent = {
  eyebrow: string;
  title: string;
  intro: string;
  stepsHeading: string;
  appSteps: string[];
  webSteps: string[];
  appLabel: string;
  webLabel: string;
  emailHeading: string;
  emailBody: string;
  emailSubject: string;
  deletedHeading: string;
  deleted: string[];
  keptHeading: string;
  kept: string[];
  timingHeading: string;
  timing: string;
  form: DeleteAccountForm;
};

const en: DeleteAccountContent = {
  eyebrow: "Account",
  title: "Delete your account",
  intro:
    "How to delete your RAPPI Sports Hub account and the personal data linked to it, on rappisportshub.com or in the RAPPI Sports Hub app.",
  stepsHeading: "How to delete your account",
  appLabel: "In the RAPPI Sports Hub app",
  appSteps: [
    "Open the app and sign in.",
    "Go to Account and tap Delete account.",
    "Type DELETE to confirm and tap Delete my account.",
  ],
  webLabel: "On the website",
  webSteps: [
    "Sign in at rappisportshub.com.",
    "Open this page (rappisportshub.com/account/delete).",
    "Type DELETE to confirm and press Delete my account.",
  ],
  emailHeading: "Can't sign in?",
  emailBody:
    "Email us from the address on your account and ask us to delete it. We confirm by email once it's done.",
  emailSubject: "Delete my RAPPI Sports Hub account",
  deletedHeading: "What we delete",
  deleted: [
    "Your sign-in account: email address, name and password, or your Google sign-in link.",
    "Your profile and profile photo.",
    "Saved delivery addresses.",
    "Your saved bag and wishlist.",
    "Push notification tokens for your devices and browsers.",
  ],
  keptHeading: "What we keep, and for how long",
  kept: [
    "Orders, payment records and invoices, including the name, email, phone and delivery address given at checkout. Tax and accounting law requires us to keep these, usually for 5 to 10 years after the purchase depending on the country. They are unlinked from your account and are no longer visible to anyone signing in.",
    "Team kit quote requests you sent, for as long as needed to answer and follow up on them.",
  ],
  timingHeading: "When it happens",
  timing:
    "Deleting from the app or website takes effect immediately and cannot be undone. Email requests are handled within 30 days.",
  form: {
    heading: "Delete my account now",
    signedInAs: "Signed in as {email}.",
    warning:
      "This permanently deletes your account. You will be signed out on this device, and you can't recover the account afterwards.",
    confirmLabel: "Type DELETE to confirm",
    confirmWord: "DELETE",
    button: "Delete my account",
    deleting: "Deleting…",
    done: "Your account has been deleted.",
    failed: "We couldn't delete your account. Please try again or email us.",
    signInHint: "Sign in to delete your account here.",
    signIn: "Sign in",
  },
};

const fr: DeleteAccountContent = {
  eyebrow: "Compte",
  title: "Supprimer votre compte",
  intro:
    "Comment supprimer votre compte RAPPI Sports Hub et les données personnelles qui y sont liées, sur rappisportshub.com ou dans l'application RAPPI Sports Hub.",
  stepsHeading: "Comment supprimer votre compte",
  appLabel: "Dans l'application RAPPI Sports Hub",
  appSteps: [
    "Ouvrez l'application et connectez-vous.",
    "Allez dans Compte puis touchez Supprimer le compte.",
    "Saisissez DELETE pour confirmer et touchez Supprimer mon compte.",
  ],
  webLabel: "Sur le site",
  webSteps: [
    "Connectez-vous sur rappisportshub.com.",
    "Ouvrez cette page (rappisportshub.com/account/delete).",
    "Saisissez DELETE pour confirmer et cliquez sur Supprimer mon compte.",
  ],
  emailHeading: "Vous ne pouvez pas vous connecter ?",
  emailBody:
    "Écrivez-nous depuis l'adresse e-mail de votre compte pour demander sa suppression. Nous confirmons par e-mail une fois la suppression effectuée.",
  emailSubject: "Supprimer mon compte RAPPI Sports Hub",
  deletedHeading: "Ce que nous supprimons",
  deleted: [
    "Votre compte de connexion : adresse e-mail, nom et mot de passe, ou le lien avec votre connexion Google.",
    "Votre profil et votre photo de profil.",
    "Vos adresses de livraison enregistrées.",
    "Votre panier et vos favoris enregistrés.",
    "Les jetons de notification push de vos appareils et navigateurs.",
  ],
  keptHeading: "Ce que nous conservons, et combien de temps",
  kept: [
    "Les commandes, paiements et factures, y compris le nom, l'e-mail, le téléphone et l'adresse de livraison saisis lors de l'achat. La loi fiscale et comptable nous oblige à les conserver, généralement de 5 à 10 ans après l'achat selon le pays. Ils sont dissociés de votre compte et ne sont plus visibles par personne en se connectant.",
    "Les demandes de devis équipe envoyées, le temps nécessaire pour y répondre et assurer le suivi.",
  ],
  timingHeading: "Délai",
  timing:
    "La suppression depuis l'application ou le site est immédiate et définitive. Les demandes par e-mail sont traitées sous 30 jours.",
  form: {
    heading: "Supprimer mon compte maintenant",
    signedInAs: "Connecté en tant que {email}.",
    warning:
      "Votre compte sera supprimé définitivement. Vous serez déconnecté sur cet appareil et le compte ne pourra pas être récupéré.",
    confirmLabel: "Saisissez DELETE pour confirmer",
    confirmWord: "DELETE",
    button: "Supprimer mon compte",
    deleting: "Suppression…",
    done: "Votre compte a été supprimé.",
    failed: "Nous n'avons pas pu supprimer votre compte. Réessayez ou écrivez-nous.",
    signInHint: "Connectez-vous pour supprimer votre compte ici.",
    signIn: "Se connecter",
  },
};

export function deleteAccountContent(market: Market): DeleteAccountContent {
  return market === "eu" ? fr : en;
}
