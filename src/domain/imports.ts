import type { Avis, Evenement, Origine, Statut } from "./suivi.ts";

/**
 * Import d'un historique tenu ailleurs (AniList, MyAnimeList, Letterboxd).
 * Les fichiers sont lus dans le navigateur : seuls les identifiants et les
 * titres partent au serveur pour trouver les œuvres correspondantes.
 */
export interface LigneImport {
  /** Clé externe quand la source en fournit une : `anilist:16498`, `mal:5114`. */
  cle: string | null;
  titre: string | null;
  annee: number | null;
  statut: Statut | null;
  /** Dernier épisode vu, s'il est connu. */
  progression: number | null;
  avis: Avis | null;
  /** Date ISO de la dernière action connue à la source. */
  date: string | null;
}

export interface Correspondance {
  oeuvre: string;
  /** Partie concernée (saison AniList/MAL) et son nombre d'épisodes, si connus. */
  partie: string | null;
  episodes: number | null;
}

// ---------- AniList ----------

export interface ListeAnilist {
  data?: {
    MediaListCollection: {
      lists: Array<{
        entries: Array<{
          mediaId: number;
          status: string;
          progress: number | null;
          score: number | null;
          updatedAt: number | null;
        }>;
      }>;
    } | null;
  };
  errors?: Array<{ message: string }>;
}

/** Requête publique : fonctionne pour une liste AniList publique, sans connexion. */
export const REQUETE_LISTE_ANILIST = `query ($utilisateur: String) {
  MediaListCollection(userName: $utilisateur, type: ANIME) {
    lists { entries { mediaId status progress score(format: POINT_100) updatedAt } }
  }
}`;

const STATUTS_ANILIST: Record<string, Statut> = {
  CURRENT: "en_cours",
  PLANNING: "prevu",
  COMPLETED: "termine",
  DROPPED: "abandonne",
  PAUSED: "en_pause",
  REPEATING: "revisionnage",
};

/** Note sur 100 → avis : 80 et plus « j'aime », 40 et moins « pas pour moi ». */
function avisSur100(note: number | null): Avis | null {
  if (!note) return null;
  if (note >= 80) return "jaime";
  if (note <= 40) return "pas_pour_moi";
  return null;
}

export function lireAnilist(reponse: ListeAnilist): LigneImport[] {
  if (reponse.errors?.length) throw new Error(reponse.errors.map((e) => e.message).join(" ; "));
  const listes = reponse.data?.MediaListCollection?.lists ?? [];
  return listes.flatMap((l) =>
    l.entries.map((e) => ({
      cle: `anilist:${e.mediaId}`,
      titre: null,
      annee: null,
      statut: STATUTS_ANILIST[e.status] ?? null,
      progression: e.progress || null,
      avis: avisSur100(e.score),
      date: e.updatedAt ? new Date(e.updatedAt * 1000).toISOString() : null,
    })),
  );
}

// ---------- MyAnimeList (export XML) ----------

const STATUTS_MAL: Record<string, Statut> = {
  watching: "en_cours",
  completed: "termine",
  "on-hold": "en_pause",
  dropped: "abandonne",
  "plan to watch": "prevu",
  "1": "en_cours",
  "2": "termine",
  "3": "en_pause",
  "4": "abandonne",
  "6": "prevu",
};

function balise(bloc: string, nom: string): string | null {
  const m = new RegExp(`<${nom}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${nom}>`).exec(bloc);
  if (!m) return null;
  return (m[1] ?? m[2] ?? "").trim();
}

function dateMal(valeur: string | null): string | null {
  return valeur && /^\d{4}-\d{2}-\d{2}$/.test(valeur) && !valeur.startsWith("0000") ? `${valeur}T00:00:00.000Z` : null;
}

/** Lit l'export XML de MyAnimeList (fichier `animelist_….xml`, une fois décompressé). */
export function lireMal(xml: string): LigneImport[] {
  if (!/<myanimelist>/i.test(xml)) throw new Error("Ce fichier ne ressemble pas à un export MyAnimeList.");
  const lignes: LigneImport[] = [];
  for (const [, bloc = ""] of xml.matchAll(/<anime>([\s\S]*?)<\/anime>/g)) {
    const id = balise(bloc, "series_animedb_id");
    if (!id || !/^\d+$/.test(id)) continue;
    const note = Number(balise(bloc, "my_score") ?? 0);
    const vus = Number(balise(bloc, "my_watched_episodes") ?? 0);
    lignes.push({
      cle: `mal:${id}`,
      titre: balise(bloc, "series_title"),
      annee: null,
      statut: STATUTS_MAL[(balise(bloc, "my_status") ?? "").toLowerCase()] ?? null,
      progression: vus > 0 ? vus : null,
      avis: avisSur100(note * 10),
      date: dateMal(balise(bloc, "my_finish_date")) ?? dateMal(balise(bloc, "my_start_date")),
    });
  }
  return lignes;
}

// ---------- Letterboxd (export CSV) ----------

/** Lecteur CSV (RFC 4180) : guillemets, virgules et retours à la ligne dans les champs. */
export function lireCsv(texte: string): string[][] {
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let champ = "";
  let entreGuillemets = false;
  const source = texte.replace(/^﻿/, "");
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;
    if (entreGuillemets) {
      if (c === '"' && source[i + 1] === '"') {
        champ += '"';
        i++;
      } else if (c === '"') entreGuillemets = false;
      else champ += c;
    } else if (c === '"') entreGuillemets = true;
    else if (c === ",") {
      ligne.push(champ);
      champ = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && source[i + 1] === "\n") i++;
      ligne.push(champ);
      lignes.push(ligne);
      ligne = [];
      champ = "";
    } else champ += c;
  }
  if (champ || ligne.length) {
    ligne.push(champ);
    lignes.push(ligne);
  }
  return lignes.filter((l) => l.some((v) => v.trim()));
}

/**
 * Lit un fichier de l'export Letterboxd : `watched.csv`, `ratings.csv`,
 * `diary.csv` (vus) ou `watchlist.csv` (à voir). Letterboxd ne fournit pas
 * d'identifiant externe : la correspondance se fait par titre et année.
 */
export function lireLetterboxd(csv: string, nomFichier: string): LigneImport[] {
  const [entete, ...lignes] = lireCsv(csv);
  if (!entete) return [];
  const colonne = (nom: string) => entete.findIndex((c) => c.trim().toLowerCase() === nom);
  const iNom = colonne("name");
  const iAnnee = colonne("year");
  const iNote = colonne("rating");
  const iDate = colonne("watched date") >= 0 ? colonne("watched date") : colonne("date");
  if (iNom < 0 || iAnnee < 0) throw new Error("Colonnes « Name » et « Year » introuvables : est-ce bien un export Letterboxd ?");
  const aVoir = /watchlist/i.test(nomFichier);
  return lignes.map((l) => {
    const note = iNote >= 0 ? Number(l[iNote]) : NaN;
    const date = iDate >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(l[iDate] ?? "") ? `${l[iDate]}T00:00:00.000Z` : null;
    return {
      cle: null,
      titre: (l[iNom] ?? "").trim() || null,
      annee: Number(l[iAnnee]) || null,
      statut: aVoir ? "prevu" : "termine",
      progression: null,
      avis: Number.isFinite(note) && note > 0 ? avisSur100(note * 20) : null,
      date,
    };
  });
}

// ---------- Vers le journal ----------

export interface ResultatImport {
  evenements: Evenement[];
  reconnues: number;
  inconnues: LigneImport[];
}

/**
 * Transforme les lignes reconnues en actions du journal. Les identifiants
 * sont déterministes : réimporter le même fichier ne crée pas de doublon.
 */
export function evenementsDepuisImport(
  lignes: readonly LigneImport[],
  trouver: (ligne: LigneImport, index: number) => Correspondance | null,
  origine: Extract<Origine, `import:${string}`>,
  maintenant: string,
): ResultatImport {
  const evenements: Evenement[] = [];
  const inconnues: LigneImport[] = [];
  let reconnues = 0;
  lignes.forEach((ligne, index) => {
    const c = trouver(ligne, index);
    if (!c) {
      inconnues.push(ligne);
      return;
    }
    reconnues++;
    const date = ligne.date ?? maintenant;
    const base = { oeuvre: c.oeuvre, date, origine };
    const cle = ligne.cle ?? `${ligne.titre}|${ligne.annee}`;
    const id = (type: string) => `${origine}:${cle}:${type}:${date}`;
    if (ligne.statut) evenements.push({ ...base, id: id("statut"), type: "statut", statut: ligne.statut });
    const episode = ligne.statut === "termine" && c.episodes ? c.episodes : ligne.progression;
    if (c.partie && episode && episode > 0) {
      evenements.push({ ...base, id: id("progression"), type: "progression", partie: c.partie, episode });
    }
    if (ligne.avis) evenements.push({ ...base, id: id("avis"), type: "avis", avis: ligne.avis });
  });
  return { evenements, reconnues, inconnues };
}
