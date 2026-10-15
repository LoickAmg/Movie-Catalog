import type { Profil } from "./profil.ts";
import type { EtatSuivi } from "./suivi.ts";
import { estFilm, familleDe, POIDS_FAMILLE, type Traits } from "./traits.ts";

/**
 * « Ce soir » (lot 4) : trois propositions, chacune avec ses raisons.
 *
 *   contraintes dures → score (goûts, envie, popularité) → diversité
 *   → une place réservée à la découverte → explications.
 */

export const ENVIES = [
  { id: "frissonner", libelle: "Frissonner", genres: ["horreur", "thriller", "mystere", "surnaturel"] },
  { id: "rire", libelle: "Rire", genres: ["comedie"] },
  { id: "emouvoir", libelle: "Être ému", genres: ["drame", "romance"] },
  { id: "reflechir", libelle: "Réfléchir", genres: ["psychologique", "science_fiction", "mystere", "documentaire"] },
  { id: "evader", libelle: "M'évader", genres: ["fantasy", "aventure", "science_fiction"] },
  { id: "detendre", libelle: "Me détendre", genres: ["tranche_de_vie", "comedie", "famille", "sport"] },
  { id: "action", libelle: "De l'action", genres: ["action", "arts_martiaux", "super_heros", "mecha"] },
] as const;
export type Envie = (typeof ENVIES)[number]["id"];

export function genresEnvie(envie: Envie | null): string[] {
  return envie ? [...ENVIES.find((e) => e.id === envie)!.genres] : [];
}

export interface Contexte {
  /** Temps disponible en minutes (film entier, ou un épisode), null = peu importe. */
  duree: number | null;
  format: "film" | "serie" | null;
  envie: Envie | null;
  /** Deux découvertes au lieu d'une. */
  surprendre: boolean;
}

export interface Raison {
  type: "gouts" | "envie" | "duree" | "decouverte" | "populaire" | "liste";
  texte: string;
}

export interface Proposition {
  oeuvre: Traits;
  score: number;
  decouverte: boolean;
  raisons: Raison[];
}

type Libelle = (cle: string) => string;

/** Affinité en dessous de laquelle une œuvre n'est pas proposée. */
export const SEUIL_REJET = -0.15;

/** Statuts qu'on ne repropose pas : déjà vu, abandonné, ou déjà en cours (proposé à part, « Reprendre »). */
const DEJA_PRIS = new Set(["termine", "abandonne", "en_cours", "revisionnage", "en_pause"]);

export function respecteContraintes(t: Traits, contexte: Contexte, profil: Profil, etat: EtatSuivi | undefined): boolean {
  if (etat && ((etat.statut && DEJA_PRIS.has(etat.statut)) || etat.avis === "pas_pour_moi")) return false;
  if (t.cles.some((c) => profil.exclus.has(c))) return false;
  const film = estFilm(t.format);
  if (contexte.format === "film" && !film) return false;
  if (contexte.format === "serie" && film) return false;
  if (contexte.duree !== null && (t.duree_min === null || t.duree_min > contexte.duree)) return false;
  const genres = genresEnvie(contexte.envie);
  if (genres.length && !genres.some((g) => t.cles.includes(`genre:${g}`))) return false;
  return true;
}

/** Affinité −1..1 entre une œuvre et les goûts, et la part de chaque trait. */
export function affinite(t: Traits, profil: Profil, familles?: ReadonlySet<string>): { valeur: number; parts: Array<[string, number]> } {
  const parts: Array<[string, number]> = [];
  let total = 0;
  let poidsTotal = 0;
  for (const cle of t.cles) {
    const famille = familleDe(cle);
    if (familles && !familles.has(famille)) continue;
    const g = profil.gouts.get(cle);
    poidsTotal += POIDS_FAMILLE[famille];
    if (!g) continue;
    // Un rejet pèse double : mieux vaut rater une bonne idée que proposer ce qu'on n'aime pas.
    const part = g.poids * POIDS_FAMILLE[famille] * (g.poids < 0 ? 2 : 1);
    total += part;
    parts.push([cle, part]);
  }
  const valeur = poidsTotal ? Math.tanh((total / Math.sqrt(poidsTotal)) * 1.5) : 0;
  return { valeur, parts: parts.sort((a, b) => b[1] - a[1]) };
}

function similarite(a: Traits, b: Traits): number {
  const ga = new Set(a.cles.filter((c) => c.startsWith("genre:")));
  const gb = b.cles.filter((c) => c.startsWith("genre:"));
  const communs = gb.filter((c) => ga.has(c)).length;
  const union = new Set([...ga, ...gb]).size || 1;
  return communs / union + (a.rubrique === b.rubrique ? 0.25 : 0) + (a.cles.some((c) => c.startsWith("credit:") && b.cles.includes(c)) ? 0.3 : 0);
}

function enumerer(titres: string[]): string {
  const uniques = Array.from(new Set(titres)).map((t) => `« ${t} »`);
  return uniques.length > 1 ? `${uniques.slice(0, -1).join(", ")} et ${uniques.at(-1)}` : (uniques[0] ?? "");
}

function formaterDuree(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

function raisons(t: Traits, profil: Profil, contexte: Contexte, etat: EtatSuivi | undefined, decouverte: boolean, libelle: Libelle): Raison[] {
  const liste: Raison[] = [];
  if (etat?.statut === "prevu") liste.push({ type: "liste", texte: "Vous l'aviez mis de côté dans « À voir »." });

  if (decouverte) {
    const univers = t.cles.find((c) => c.startsWith("rubrique:")) ?? t.cles.find((c) => c.startsWith("origine:"));
    const genreAime = affinite(t, profil, new Set(["genre"])).parts.find(([, p]) => p > 0)?.[0];
    liste.push({
      type: "decouverte",
      texte: `Hors de vos habitudes${univers ? ` (${libelle(univers).toLowerCase()})` : ""}${genreAime ? `, mais côté ${libelle(genreAime).toLowerCase()}, comme vous aimez` : ""}.`,
    });
  } else {
    const parts = affinite(t, profil).parts.filter(([c, p]) => p > 0.05 && !c.startsWith("rubrique:") && !c.startsWith("origine:")).slice(0, 2);
    const preuves = parts.flatMap(([c]) => profil.gouts.get(c)?.preuves ?? []).filter((p) => p.oeuvre !== t.id && p.poids > 0);
    if (parts.length && preuves.length) {
      const aime = preuves.some((p) => p.aime);
      const titres = preuves.slice(0, 2).map((p) => p.titre);
      const credit = parts.find(([c]) => c.startsWith("credit:"));
      const communs = credit ? `même création : ${libelle(credit[0])}` : parts.map(([c]) => libelle(c).toLowerCase()).join(" et ");
      liste.push({ type: "gouts", texte: `Vous avez ${aime ? "aimé" : "regardé"} ${enumerer(titres)} : ${communs}.` });
    }
  }

  const envie = genresEnvie(contexte.envie).filter((g) => t.cles.includes(`genre:${g}`));
  if (envie.length) {
    const nom = ENVIES.find((e) => e.id === contexte.envie)!.libelle.toLowerCase();
    liste.push({ type: "envie", texte: `Pour ${nom === "de l'action" ? "l'action" : nom} : ${envie.map((g) => libelle(`genre:${g}`).toLowerCase()).join(", ")}.` });
  }
  if (contexte.duree !== null && t.duree_min) {
    liste.push({
      type: "duree",
      texte: estFilm(t.format)
        ? `${formaterDuree(t.duree_min)} : tient dans votre soirée.`
        : `Épisodes de ${t.duree_min} min${t.episodes ? `, ${t.episodes} au total` : ""}.`,
    });
  }
  if (!liste.some((r) => r.type === "gouts" || r.type === "decouverte") && t.score > 0.6) {
    liste.push({ type: "populaire", texte: "Parmi les œuvres les plus suivies de sa catégorie." });
  }
  return liste;
}

/**
 * Trois propositions. `dejaProposees` : ce qu'on a déjà montré ce soir
 * (bouton « Autre chose »), pour ne jamais reproposer la même chose.
 */
export function decider(
  candidats: readonly Traits[],
  profil: Profil,
  etats: ReadonlyMap<string, EtatSuivi>,
  contexte: Contexte,
  libelle: Libelle,
  dejaProposees: ReadonlySet<string> = new Set(),
  nombre = 3,
): Proposition[] {
  const vus = new Set<string>();
  const possibles = candidats.filter((t) => {
    if (vus.has(t.id) || dejaProposees.has(t.id)) return false;
    vus.add(t.id);
    return respecteContraintes(t, contexte, profil, etats.get(t.id));
  });
  if (possibles.length === 0) return [];

  // Sans assez de suivi, la popularité et l'envie comptent davantage.
  const rodage = profil.base < 3;
  const notes = possibles.flatMap((t) => {
    const aff = affinite(t, profil).valeur;
    // Nettement à contre-goût : écarté, même s'il est populaire.
    if (!rodage && aff < SEUIL_REJET) return [];
    const envie = genresEnvie(contexte.envie);
    const accordEnvie = envie.length ? envie.filter((g) => t.cles.includes(`genre:${g}`)).length / envie.length : 0;
    const liste = etats.get(t.id)?.statut === "prevu" ? 0.12 : 0;
    const score = rodage ? 0.15 * aff + 0.6 * t.score + 0.25 * accordEnvie + liste : 0.55 * aff + 0.25 * t.score + 0.2 * accordEnvie + liste;
    return [{ t, score }];
  });
  notes.sort((a, b) => b.score - a.score || a.t.id.localeCompare(b.t.id));

  // Univers peu fréquentés : rubriques et pays où les goûts sont faibles.
  const peuVu = (t: Traits) =>
    t.cles
      .filter((c) => c.startsWith("rubrique:") || c.startsWith("origine:"))
      .every((c) => (profil.gouts.get(c)?.poids ?? 0) < 0.15);
  const decouvertes = rodage
    ? []
    : notes
        .filter(({ t }) => peuVu(t))
        .map(({ t }) => ({ t, score: 0.5 * Math.max(0, affinite(t, profil, new Set(["genre", "theme"])).valeur) + 0.5 * t.score }))
        .sort((a, b) => b.score - a.score);

  const places = Math.max(0, nombre - (decouvertes.length ? (contexte.surprendre ? 2 : 1) : 0));
  const choisis: Array<{ t: Traits; score: number; decouverte: boolean }> = [];
  const reste = [...notes];
  while (choisis.length < places && reste.length) {
    // Diversité : on pénalise ce qui ressemble trop à ce qui est déjà choisi.
    let meilleur = 0;
    let meilleurScore = -Infinity;
    reste.forEach((n, i) => {
      const penalite = Math.max(0, ...choisis.map((c) => similarite(c.t, n.t)));
      const s = n.score - 0.35 * penalite;
      if (s > meilleurScore) {
        meilleurScore = s;
        meilleur = i;
      }
    });
    const [n] = reste.splice(meilleur, 1);
    choisis.push({ ...n!, decouverte: false });
  }
  for (const d of decouvertes) {
    if (choisis.length >= nombre) break;
    if (!choisis.some((c) => c.t.id === d.t.id)) choisis.push({ ...d, decouverte: true });
  }
  // Pas assez de découvertes possibles : on complète normalement.
  for (const n of reste) {
    if (choisis.length >= nombre) break;
    if (!choisis.some((c) => c.t.id === n.t.id)) choisis.push({ ...n, decouverte: false });
  }

  return choisis.map((c) => ({
    oeuvre: c.t,
    score: Math.round(c.score * 1000) / 1000,
    decouverte: c.decouverte,
    raisons: raisons(c.t, profil, contexte, etats.get(c.t.id), c.decouverte, libelle),
  }));
}
