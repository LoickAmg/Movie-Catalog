import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse as lireYaml } from "yaml";

/**
 * Fiches Savoir (lot 0, §5) : un fichier Markdown par fiche, avec un
 * en-tête YAML. Le corps est découpé par `<!-- plus -->` entre la carte
 * (courte) et « En savoir plus ».
 */

export const TYPES_FICHE = ["definition", "difference", "histoire", "coulisses", "parcours"] as const;
export type TypeFiche = (typeof TYPES_FICHE)[number];

export const LIBELLES_TYPE: Record<TypeFiche, string> = {
  definition: "Définition",
  difference: "Différence",
  histoire: "Histoire",
  coulisses: "Coulisses",
  parcours: "Parcours",
};

export interface FicheSavoir {
  slug: string;
  titre: string;
  type: TypeFiche;
  niveau: "decouverte" | "approfondi";
  accroche: string;
  /** Concepts du catalogue que la fiche explique (`seinen` → `demographie_seinen`, `mecha`…). */
  concepts: string[];
  /** Œuvres pour comprendre, par clé externe (`anilist:19`, `wikidata:Q155653`). */
  oeuvres: string[];
  liees: string[];
  sources: Array<{ titre: string; url: string }>;
  /** Tant qu'une fiche n'est pas relue par un humain, l'interface l'indique. */
  statut: "brouillon" | "relue";
  carte: string;
  plus: string;
}

export const MOTS_MAX_CARTE = 80;
export const MOTS_MAX_PLUS = 300;
const SEPARATEUR = "<!-- plus -->";

export function compterMots(markdown: string): number {
  return markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_#>`-]/g, " ")
    .split(/\s+/)
    .filter((mot) => /[\p{L}\p{N}]/u.test(mot)).length;
}

const texte = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const listeTextes = (v: unknown): v is string[] => Array.isArray(v) && v.every(texte);

/** Lit une fiche ; lève une erreur qui liste tous les problèmes trouvés. */
export function lireFiche(slug: string, contenu: string): FicheSavoir {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(contenu);
  if (!m) throw new Error(`${slug} : en-tête YAML manquant`);
  const meta = (lireYaml(m[1]!) ?? {}) as Record<string, unknown>;
  const [carte = "", plus = ""] = m[2]!.split(SEPARATEUR).map((s) => s.trim());

  const erreurs: string[] = [];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) erreurs.push("nom de fichier invalide (minuscules et tirets)");
  if (!texte(meta.titre)) erreurs.push("titre manquant");
  if (!TYPES_FICHE.includes(meta.type as TypeFiche)) erreurs.push(`type invalide (${TYPES_FICHE.join(", ")})`);
  if (meta.niveau !== "decouverte" && meta.niveau !== "approfondi") erreurs.push("niveau invalide (decouverte, approfondi)");
  if (!texte(meta.accroche)) erreurs.push("accroche manquante");
  for (const champ of ["concepts", "oeuvres", "liees"] as const) {
    if (meta[champ] !== undefined && !listeTextes(meta[champ])) erreurs.push(`${champ} doit être une liste de textes`);
  }
  const sources = meta.sources;
  if (
    !Array.isArray(sources) ||
    sources.length === 0 ||
    !sources.every((s) => s && texte((s as { titre?: unknown }).titre) && texte((s as { url?: unknown }).url))
  ) {
    erreurs.push("au moins une source { titre, url } est requise");
  }
  if (meta.statut !== "brouillon" && meta.statut !== "relue") erreurs.push("statut invalide (brouillon, relue)");
  if (!carte) erreurs.push("carte vide");
  if (compterMots(carte) > MOTS_MAX_CARTE) erreurs.push(`carte trop longue (${compterMots(carte)} mots, ${MOTS_MAX_CARTE} max)`);
  if (compterMots(plus) > MOTS_MAX_PLUS) erreurs.push(`« en savoir plus » trop long (${compterMots(plus)} mots, ${MOTS_MAX_PLUS} max)`);
  for (const cle of (listeTextes(meta.oeuvres) ? meta.oeuvres : [])) {
    if (!/^(anilist|wikidata|tvmaze):[A-Za-z0-9]+$/.test(cle)) erreurs.push(`clé d'œuvre invalide « ${cle} »`);
  }
  if (erreurs.length) throw new Error(`${slug} : ${erreurs.join(" ; ")}`);

  return {
    slug,
    titre: meta.titre as string,
    type: meta.type as TypeFiche,
    niveau: meta.niveau as FicheSavoir["niveau"],
    accroche: meta.accroche as string,
    concepts: (meta.concepts as string[] | undefined) ?? [],
    oeuvres: (meta.oeuvres as string[] | undefined) ?? [],
    liees: (meta.liees as string[] | undefined) ?? [],
    sources: sources as FicheSavoir["sources"],
    statut: meta.statut as FicheSavoir["statut"],
    carte,
    plus,
  };
}

export const DOSSIER_SAVOIR = path.join(process.cwd(), "contenu", "savoir");

export async function chargerFiches(dossier = DOSSIER_SAVOIR): Promise<FicheSavoir[]> {
  const fichiers = (await readdir(dossier)).filter((f) => f.endsWith(".md")).sort();
  return Promise.all(
    fichiers.map(async (f) => lireFiche(f.replace(/\.md$/, ""), await readFile(path.join(dossier, f), "utf8"))),
  );
}

/** Vérifications croisées : fiches liées existantes, concepts connus, un concept par fiche au plus. */
export function verifierFiches(fiches: readonly FicheSavoir[], conceptsConnus: ReadonlySet<string>): string[] {
  const erreurs: string[] = [];
  const slugs = new Set(fiches.map((f) => f.slug));
  const proprietaires = new Map<string, string>();
  for (const fiche of fiches) {
    for (const liee of fiche.liees) if (!slugs.has(liee)) erreurs.push(`${fiche.slug} : fiche liée inconnue « ${liee} »`);
    for (const concept of fiche.concepts) {
      if (!conceptsConnus.has(concept)) erreurs.push(`${fiche.slug} : concept inconnu « ${concept} »`);
      // Une fiche de type « définition » est LA fiche d'un concept : pas de concurrence.
      if (fiche.type === "definition") {
        const deja = proprietaires.get(concept);
        if (deja) erreurs.push(`${fiche.slug} : le concept « ${concept} » est déjà défini par ${deja}`);
        proprietaires.set(concept, fiche.slug);
      }
    }
  }
  return erreurs;
}

/** Fiche de définition d'un concept, pour la mini-carte au contact d'une étiquette. */
export function ficheDuConcept(fiches: readonly FicheSavoir[], concept: string): FicheSavoir | undefined {
  return fiches.find((f) => f.type === "definition" && f.concepts.includes(concept)) ?? fiches.find((f) => f.concepts.includes(concept));
}
