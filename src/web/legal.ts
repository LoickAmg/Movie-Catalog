/**
 * Pages légales. L'identité de l'éditeur et l'hébergeur viennent des
 * variables d'environnement (voir `.env.example`) : rien n'est écrit en dur.
 */

export const LEGAL_MAJ = "En vigueur au 16 octobre 2026";

export interface DocumentLegal {
  titre: string;
  maj: string;
  sections: Array<{ titre: string; paragraphes: string[] }>;
}

function env(nom: string): string {
  return process.env[nom]?.trim() ?? "";
}

function editeur(): string {
  const nom = env("PUBLISHER_NAME") || "[éditeur non renseigné]";
  const adresse = env("PUBLISHER_ADDRESS");
  return adresse
    ? `${nom}, ${adresse}`
    : `${nom} (éditeur non professionnel ; l'adresse postale n'est pas publiée et est communiquée à l'hébergeur, loi n° 2004-575 du 21 juin 2004, art. 6, III, 2°)`;
}

export function contact(): string {
  return env("CONTACT_EMAIL") || "[adresse non renseignée]";
}

export function mentionsLegales(): DocumentLegal {
  return {
    titre: "Mentions légales",
    maj: LEGAL_MAJ,
    sections: [
      {
        titre: "Éditeur du site",
        paragraphes: [
          "« Ciné Catalogue » est un guide personnel pour choisir et comprendre les films, séries, anime et dessins animés. Le site est non commercial.",
          `Éditeur : ${editeur()}. Contact : ${contact()}.`,
        ],
      },
      {
        titre: "Hébergement",
        paragraphes: [`Le site est hébergé par ${env("HOSTING_PROVIDER") || "[hébergeur non renseigné]"}.`],
      },
      {
        titre: "Données sur les œuvres",
        paragraphes: [
          "Les informations sur les œuvres proviennent d'AniList (anilist.co), de Wikidata (wikidata.org, licence CC0) et de TVmaze (tvmaze.com, licence CC BY-SA 4.0). Chaque fiche indique ses sources et renvoie vers elles.",
          "Les affiches et images restent la propriété de leurs ayants droit ; elles sont affichées telles que fournies par ces sources, à des fins d'identification des œuvres.",
        ],
      },
      {
        titre: "Fiches « Comprendre »",
        paragraphes: [
          "Les textes des fiches « Comprendre » sont originaux et rédigés pour ce site ; leurs sources sont citées en bas de chaque fiche. Une fiche marquée « Brouillon » n'a pas encore été relue.",
        ],
      },
      {
        titre: "Signaler un contenu",
        paragraphes: ["Une erreur, une demande de retrait ? Écrivez via la page contact en précisant l'œuvre ou la fiche concernée."],
      },
    ],
  };
}

export function confidentialite(): DocumentLegal {
  return {
    titre: "Politique de confidentialité",
    maj: LEGAL_MAJ,
    sections: [
      {
        titre: "Sans compte, sans traceur",
        paragraphes: [
          "Le site se consulte sans compte. Il ne dépose aucun cookie et n'utilise aucun outil de mesure d'audience ni aucun traceur publicitaire. Les polices de caractères sont servies par le site lui-même.",
        ],
      },
      {
        titre: "Votre suivi reste dans votre navigateur",
        paragraphes: [
          "Ce que vous notez (statuts, avis, épisodes vus, réglages de vos goûts) est enregistré uniquement dans le stockage local de votre navigateur (clé cine:journal:v1). Votre profil de goûts et le classement des propositions « Ce soir » sont calculés sur votre appareil.",
          "Vous pouvez sauvegarder ce suivi dans un fichier, le restaurer, ou l'effacer depuis la page « Ma liste ». Vider les données du site dans votre navigateur l'efface aussi.",
        ],
      },
      {
        titre: "Ce qui est envoyé au serveur",
        paragraphes: [
          "Pour afficher vos propositions et votre liste, le navigateur envoie au serveur des identifiants d'œuvres, des genres et vos contraintes du moment (durée, format, envie). Lors d'un import, les fichiers sont lus dans votre navigateur et seuls les identifiants et titres des œuvres sont envoyés, pour les retrouver dans le catalogue. Rien de cela n'est conservé ni rattaché à votre personne.",
        ],
      },
      {
        titre: "Services tiers",
        paragraphes: [
          "Les affiches sont chargées depuis les serveurs d'AniList et de TVmaze, qui reçoivent alors l'adresse IP de votre appareil. L'import depuis AniList interroge directement AniList depuis votre navigateur, avec le pseudo que vous indiquez ; leur politique de confidentialité s'applique.",
          "L'hébergeur peut conserver des journaux techniques standards (adresse IP, date, page demandée) pour assurer le fonctionnement et la sécurité du service, selon sa propre politique.",
        ],
      },
      {
        titre: "Vos droits",
        paragraphes: [
          `Le RGPD vous donne un droit d'accès, de rectification et d'effacement des données vous concernant. Le site n'en conserve aucune sur son serveur ; pour toute question, écrivez à ${contact()}. Vous pouvez aussi saisir la CNIL (cnil.fr).`,
        ],
      },
    ],
  };
}

export function pageContact(): DocumentLegal {
  return {
    titre: "Contact",
    maj: "",
    sections: [
      {
        titre: "Nous écrire",
        paragraphes: [`Une fiche erronée, une œuvre manquante, une suggestion, une demande de retrait : écrivez à ${contact()}.`],
      },
      {
        titre: "Ce qu'il est utile d'indiquer",
        paragraphes: [
          "L'adresse de la page concernée (par exemple /oeuvre/wd-Q155653 ou /comprendre/seinen), et pour une correction, l'information exacte avec sa source.",
        ],
      },
    ],
  };
}
