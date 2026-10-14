import { deriverRubrique } from "./classification.ts";
import { DEMOGRAPHIES, FORMATS, PUBLICS, TECHNIQUES, type Oeuvre } from "./types.ts";

const ID_VALIDE = /^[a-z]+-[A-Za-z0-9]+$/;
const PAYS_VALIDE = /^[A-Z]{2}$/;
const ANNEE_MIN = 1870;

/**
 * Règles qu'une œuvre doit toujours respecter avant d'entrer en base.
 * Renvoie la liste des violations (vide si l'œuvre est valide).
 */
export function violations(oeuvre: Oeuvre, anneeCourante = new Date().getFullYear()): string[] {
  const erreurs: string[] = [];
  const e = (message: string) => erreurs.push(`${oeuvre.id}: ${message}`);

  if (!ID_VALIDE.test(oeuvre.id)) e(`identifiant invalide « ${oeuvre.id} »`);
  if (oeuvre.titres.length === 0) e("aucun titre");
  if (!oeuvre.titre_principal.trim()) e("titre principal vide");
  if (!oeuvre.titres.some((t) => t.valeur === oeuvre.titre_principal)) {
    e("le titre principal ne fait pas partie des titres");
  }
  if (!FORMATS.includes(oeuvre.format)) e(`format inconnu « ${oeuvre.format} »`);
  if (!TECHNIQUES.includes(oeuvre.technique)) e(`technique inconnue « ${oeuvre.technique} »`);
  if (oeuvre.public !== null && !PUBLICS.includes(oeuvre.public)) e(`public inconnu « ${oeuvre.public} »`);
  if (oeuvre.demographie !== null) {
    if (!DEMOGRAPHIES.includes(oeuvre.demographie)) e(`démographie inconnue « ${oeuvre.demographie} »`);
    if (oeuvre.technique !== "animation") e("une démographie n'a de sens que pour l'animation");
  }
  for (const pays of oeuvre.origines) {
    if (!PAYS_VALIDE.test(pays)) e(`pays invalide « ${pays} »`);
  }
  if (oeuvre.annee !== null && (oeuvre.annee < ANNEE_MIN || oeuvre.annee > anneeCourante + 5)) {
    e(`année hors limites (${oeuvre.annee})`);
  }
  if (oeuvre.duree_min !== null && (oeuvre.duree_min <= 0 || oeuvre.duree_min > 1000)) {
    e(`durée hors limites (${oeuvre.duree_min} min)`);
  }
  if (oeuvre.rubrique !== deriverRubrique(oeuvre)) e("rubrique incohérente avec les axes");
  if (oeuvre.parties.length === 0) e("aucune partie");
  if (new Set(oeuvre.parties.map((p) => p.cle)).size !== oeuvre.parties.length) e("parties en double");
  const ids = oeuvre.identifiants.map((i) => `${i.espace}:${i.valeur}`);
  if (new Set(ids).size !== ids.length) e("identifiants externes en double");
  return erreurs;
}
