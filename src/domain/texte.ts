/**
 * Forme comparable d'un titre : minuscules, sans accents ni ponctuation.
 * « L’Attaque des Titans » et « l'attaque des titans » donnent la même clé.
 */
export function normaliserTitre(valeur: string): string {
  return valeur
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’'`´]/g, "'")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Identifiant lisible pour un concept : `Slice of Life` → `slice_of_life`. */
export function slugifier(valeur: string): string {
  return normaliserTitre(valeur).replace(/\s+/g, "_");
}
