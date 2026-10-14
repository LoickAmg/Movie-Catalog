import { violations } from "../domain/invariants.ts";
import { normaliserTitre } from "../domain/texte.ts";
import { RUBRIQUES, type Oeuvre, type Rubrique } from "../domain/types.ts";

export const CHAMPS_COUVERTURE = [
  "titre_fr",
  "annee",
  "duree",
  "origine",
  "genres",
  "synopsis",
  "affiche",
] as const;
export type ChampCouverture = (typeof CHAMPS_COUVERTURE)[number];

export interface RapportQualite {
  total: number;
  parRubrique: Record<Rubrique, number>;
  /** Nombre d'œuvres alimentées par chaque source. */
  parSource: Record<string, number>;
  /** Part des œuvres (0 à 1) qui ont le champ renseigné. */
  couverture: Record<ChampCouverture, number>;
  /** Couverture calculée rubrique par rubrique. */
  couvertureParRubrique: Record<Rubrique, Record<ChampCouverture, number>>;
  nbViolations: number;
  violations: string[];
  /** Œuvres distinctes partageant titre principal et année : doublons probables. */
  doublonsSuspects: Array<{ titre: string; annee: number | null; ids: string[] }>;
  /** Œuvres à beaucoup de parties : regroupement de saisons à vérifier. */
  partiesNombreuses: Array<{ id: string; titre: string; parties: number }>;
  conflits: number;
  rapprochementsHeuristiques: number;
}

const PARTIES_MAX_ATTENDUES = 12;
const EXEMPLES_MAX = 50;

function presence(oeuvre: Oeuvre): Record<ChampCouverture, boolean> {
  return {
    titre_fr: oeuvre.titres.some((t) => t.langue === "fr"),
    annee: oeuvre.annee !== null,
    duree: oeuvre.duree_min !== null,
    origine: oeuvre.origines.length > 0,
    genres: oeuvre.genres.length > 0,
    synopsis: oeuvre.synopsis.length > 0,
    affiche: oeuvre.images.some((i) => i.type === "affiche"),
  };
}

function couvertureDe(oeuvres: readonly Oeuvre[]): Record<ChampCouverture, number> {
  const resultat = Object.fromEntries(CHAMPS_COUVERTURE.map((c) => [c, 0])) as Record<ChampCouverture, number>;
  if (oeuvres.length === 0) return resultat;
  for (const oeuvre of oeuvres) {
    const p = presence(oeuvre);
    for (const champ of CHAMPS_COUVERTURE) if (p[champ]) resultat[champ]++;
  }
  for (const champ of CHAMPS_COUVERTURE) resultat[champ] = Math.round((resultat[champ] / oeuvres.length) * 1000) / 1000;
  return resultat;
}

export function analyser(
  oeuvres: readonly Oeuvre[],
  extras: { conflits: number; rapprochementsHeuristiques: number } = { conflits: 0, rapprochementsHeuristiques: 0 },
): RapportQualite {
  const parRubrique = Object.fromEntries(RUBRIQUES.map((r) => [r, 0])) as Record<Rubrique, number>;
  const parSource: Record<string, number> = {};
  const toutesViolations: string[] = [];
  const parTitreAnnee = new Map<string, string[]>();

  for (const oeuvre of oeuvres) {
    parRubrique[oeuvre.rubrique]++;
    // Chaque source renseigne une popularité : ses clés disent qui a alimenté l'œuvre.
    for (const source of Object.keys(oeuvre.popularite)) {
      parSource[source] = (parSource[source] ?? 0) + 1;
    }
    toutesViolations.push(...violations(oeuvre));
    const cle = `${normaliserTitre(oeuvre.titre_principal)}|${oeuvre.annee}|${oeuvre.rubrique}`;
    parTitreAnnee.set(cle, [...(parTitreAnnee.get(cle) ?? []), oeuvre.id]);
  }

  const doublonsSuspects = [...parTitreAnnee.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([, ids]) => {
      const oeuvre = oeuvres.find((o) => o.id === ids[0])!;
      return { titre: oeuvre.titre_principal, annee: oeuvre.annee, ids };
    });

  const couvertureParRubrique = Object.fromEntries(
    RUBRIQUES.map((r) => [r, couvertureDe(oeuvres.filter((o) => o.rubrique === r))]),
  ) as Record<Rubrique, Record<ChampCouverture, number>>;

  return {
    total: oeuvres.length,
    parRubrique,
    parSource,
    couverture: couvertureDe(oeuvres),
    couvertureParRubrique,
    nbViolations: toutesViolations.length,
    violations: toutesViolations.slice(0, EXEMPLES_MAX),
    doublonsSuspects,
    partiesNombreuses: oeuvres
      .filter((o) => o.parties.length > PARTIES_MAX_ATTENDUES)
      .map((o) => ({ id: o.id, titre: o.titre_principal, parties: o.parties.length })),
    conflits: extras.conflits,
    rapprochementsHeuristiques: extras.rapprochementsHeuristiques,
  };
}

export interface Seuils {
  oeuvresMin: number;
  violationsMax: number;
  /** Part maximale d'œuvres prises dans un doublon suspect. */
  doublonsMax: number;
  couvertureMin: Partial<Record<ChampCouverture, number>>;
  /** Baisse maximale tolérée du nombre d'œuvres par rapport à l'import précédent (0 à 1). */
  baisseMax: number;
}

export const SEUILS_PAR_DEFAUT: Seuils = {
  oeuvresMin: 100,
  violationsMax: 0,
  doublonsMax: 0.02,
  couvertureMin: { annee: 0.95, origine: 0.85, genres: 0.75 },
  baisseMax: 0.2,
};

/** Liste des seuils non respectés ; vide si l'import peut être enregistré. */
export function verifierSeuils(rapport: RapportQualite, seuils: Seuils, totalPrecedent: number | null = null): string[] {
  const echecs: string[] = [];
  if (rapport.total < seuils.oeuvresMin) echecs.push(`${rapport.total} œuvres (minimum ${seuils.oeuvresMin})`);
  if (rapport.nbViolations > seuils.violationsMax) {
    echecs.push(`${rapport.nbViolations} violations d'invariants (maximum ${seuils.violationsMax})`);
  }
  const enDoublon = rapport.doublonsSuspects.reduce((n, d) => n + d.ids.length, 0);
  if (rapport.total > 0 && enDoublon / rapport.total > seuils.doublonsMax) {
    echecs.push(`${enDoublon} œuvres en doublon suspect (${((enDoublon / rapport.total) * 100).toFixed(1)} %)`);
  }
  for (const [champ, min] of Object.entries(seuils.couvertureMin) as Array<[ChampCouverture, number]>) {
    if (rapport.couverture[champ] < min) {
      echecs.push(`couverture « ${champ} » à ${(rapport.couverture[champ] * 100).toFixed(1)} % (minimum ${min * 100} %)`);
    }
  }
  if (totalPrecedent !== null && totalPrecedent > 0 && rapport.total < totalPrecedent * (1 - seuils.baisseMax)) {
    echecs.push(`${rapport.total} œuvres contre ${totalPrecedent} à l'import précédent`);
  }
  return echecs;
}
