import type { EtatSuivi } from "./suivi.ts";
import { familleDe, POIDS_FAMILLE, type Traits } from "./traits.ts";

/**
 * Profil de goûts, déduit du suivi (lot 4). Toujours explicable : chaque
 * goût garde les œuvres qui l'ont fait naître. L'utilisateur peut le
 * corriger trait par trait.
 */

/** Ce que pèse chaque signal du suivi dans les goûts. */
export function signal(etat: EtatSuivi): number {
  if (etat.avis === "pas_pour_moi") return -3;
  let s = 0;
  switch (etat.statut) {
    case "revisionnage":
      s = 2.5;
      break;
    case "termine":
      s = 1.5;
      break;
    case "en_cours":
      s = 1;
      break;
    case "en_pause":
      s = 0.3;
      break;
    case "prevu":
      s = 0.4;
      break;
    case "abandonne":
      s = -2;
      break;
  }
  if (etat.avis === "jaime") s += 2.5;
  return s;
}

export type Reglage = "plus" | "moins" | "jamais";

export interface Preuve {
  oeuvre: string;
  titre: string;
  /** Vrai si l'utilisateur a dit « J'aime » (l'explication le dira). */
  aime: boolean;
  /** Négatif pour une œuvre rejetée (abandonnée, « Pas pour moi »). */
  poids: number;
}

export interface Gout {
  cle: string;
  /** Intensité de -1 (rejet) à 1 (goût fort), après réglage. */
  poids: number;
  /** Intensité avant réglage, pour montrer l'effet d'une correction. */
  poidsCalcule: number;
  /** Nombre d'œuvres suivies qui portent ce trait. */
  nombre: number;
  /** Œuvres qui expliquent ce goût, de la plus parlante à la moins parlante. */
  preuves: Preuve[];
  reglage: Reglage | null;
}

export interface Profil {
  gouts: Map<string, Gout>;
  /** Nombre d'œuvres qui ont servi à le calculer. */
  base: number;
  /** Traits écartés à la demande de l'utilisateur : jamais proposés. */
  exclus: Set<string>;
}

const PREUVES_MAX = 4;

export function calculerProfil(
  etats: Iterable<EtatSuivi>,
  traits: ReadonlyMap<string, Traits>,
  reglages: ReadonlyMap<string, Reglage> = new Map(),
): Profil {
  const bruts = new Map<string, { total: number; nombre: number; preuves: Preuve[] }>();
  let base = 0;
  for (const etat of etats) {
    const t = traits.get(etat.oeuvre);
    const s = signal(etat);
    if (!t || s === 0) continue;
    base++;
    for (const cle of t.cles) {
      const b = bruts.get(cle) ?? { total: 0, nombre: 0, preuves: [] };
      b.total += s * POIDS_FAMILLE[familleDe(cle)];
      b.nombre++;
      b.preuves.push({ oeuvre: t.id, titre: t.titre, aime: etat.avis === "jaime", poids: s });
      bruts.set(cle, b);
    }
  }

  const maximum = Math.max(1e-9, ...[...bruts.values()].map((b) => Math.abs(b.total)));
  const gouts = new Map<string, Gout>();
  for (const [cle, b] of bruts) {
    // Un trait vu une seule fois compte moins qu'un trait récurrent.
    const confiance = Math.min(1, 0.5 + b.nombre * 0.25);
    const poidsCalcule = (b.total / maximum) * confiance;
    // Les preuves vont dans le sens du goût : œuvres aimées pour un goût, rejetées pour un rejet.
    const sens = Math.sign(b.total) || 1;
    gouts.set(cle, {
      cle,
      poids: poidsCalcule,
      poidsCalcule,
      nombre: b.nombre,
      preuves: b.preuves
        .filter((p) => Math.sign(p.poids) === sens)
        .sort((x, y) => Math.abs(y.poids) - Math.abs(x.poids))
        .slice(0, PREUVES_MAX),
      reglage: null,
    });
  }

  const exclus = new Set<string>();
  for (const [cle, reglage] of reglages) {
    const g = gouts.get(cle) ?? { cle, poids: 0, poidsCalcule: 0, nombre: 0, preuves: [], reglage: null };
    g.reglage = reglage;
    if (reglage === "plus") g.poids = Math.min(1, Math.max(g.poidsCalcule, 0) + 0.5);
    if (reglage === "moins") g.poids = Math.max(-1, Math.min(g.poidsCalcule, 0) - 0.5);
    if (reglage === "jamais") {
      g.poids = -1;
      exclus.add(cle);
    }
    gouts.set(cle, g);
  }
  return { gouts, base, exclus };
}

/** Goûts triés du plus fort au plus faible (ou du plus rejeté, si `negatifs`). */
export function principauxGouts(profil: Profil, nombre: number, negatifs = false): Gout[] {
  return [...profil.gouts.values()]
    .filter((g) => (negatifs ? g.poids < -0.05 : g.poids > 0.05))
    .sort((a, b) => (negatifs ? a.poids - b.poids : b.poids - a.poids) || b.nombre - a.nombre)
    .slice(0, nombre);
}
