import { deriverRubrique } from "../domain/classification.ts";
import { normaliserTitre } from "../domain/texte.ts";
import type {
  Credit,
  IdentifiantExterne,
  Image,
  Oeuvre,
  Partie,
  Provenance,
  Relation,
  SourceId,
  Synopsis,
  Titre,
} from "../domain/types.ts";
import { cleDe, type FicheSource } from "./fiche.ts";

/** Confiance attribuée aux identifiants rattachés par ressemblance de titre et d'année. */
export const CONFIANCE_HEURISTIQUE = 0.7;

export interface ResultatRapprochement {
  oeuvres: Oeuvre[];
  relations: Relation[];
  /** Fusions refusées parce qu'elles auraient réuni deux œuvres distinctes. */
  conflits: string[];
  rapprochementsHeuristiques: number;
}

/** AniList d'abord (la référence pour l'anime), puis Wikidata, puis TVmaze. */
const PRIORITE: Record<FicheSource["source"], number> = { anilist: 0, wikidata: 1, tvmaze: 2 };

/**
 * Sources qui ne décrivent jamais deux fois la même œuvre : deux fiches
 * Wikidata (ou TVmaze) différentes sont, par construction, deux œuvres.
 */
const SOURCES_UNIQUES = ["wikidata", "tvmaze"] as const;

class Regroupement {
  private parent: number[];
  private membres: Map<number, Set<string>>;
  private sourcesParRacine: Map<number, Set<FicheSource["source"]>>;
  private fiches: readonly FicheSource[];

  constructor(fiches: readonly FicheSource[]) {
    this.fiches = fiches;
    this.parent = fiches.map((_, i) => i);
    this.membres = new Map(
      fiches.map((f, i) => [i, new Set((SOURCES_UNIQUES as readonly string[]).includes(f.source) ? [f.cle] : [])]),
    );
    this.sourcesParRacine = new Map(fiches.map((f, i) => [i, new Set([f.source])]));
  }

  sources(i: number): ReadonlySet<FicheSource["source"]> {
    return this.sourcesParRacine.get(this.racine(i))!;
  }

  racine(i: number): number {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]!]!;
      i = this.parent[i]!;
    }
    return i;
  }

  /** Réunit deux groupes ; renvoie un message de conflit si c'est interdit. */
  unir(a: number, b: number): string | null {
    const ra = this.racine(a);
    const rb = this.racine(b);
    if (ra === rb) return null;
    const ma = this.membres.get(ra)!;
    const mb = this.membres.get(rb)!;
    for (const source of SOURCES_UNIQUES) {
      const deA = [...ma].find((c) => c.startsWith(`${source}:`));
      const deB = [...mb].find((c) => c.startsWith(`${source}:`));
      if (deA && deB && deA !== deB) {
        return `${this.fiches[a]!.cle} ↔ ${this.fiches[b]!.cle} : réunirait ${deA} et ${deB}`;
      }
    }
    this.parent[rb] = ra;
    for (const c of mb) ma.add(c);
    this.membres.delete(rb);
    for (const source of this.sourcesParRacine.get(rb)!) this.sourcesParRacine.get(ra)!.add(source);
    this.sourcesParRacine.delete(rb);
    return null;
  }

  groupes(): number[][] {
    const groupes = new Map<number, number[]>();
    this.fiches.forEach((_, i) => {
      const r = this.racine(i);
      groupes.set(r, [...(groupes.get(r) ?? []), i]);
    });
    return [...groupes.values()];
  }
}

/**
 * Rapproche les fiches des différentes sources en œuvres.
 *
 * 1. Identifiants partagés (ex. Wikidata déclare l'identifiant AniList).
 * 2. Même titre et même année (±1) entre sources, seulement si la
 *    correspondance est unique.
 * 3. Saisons AniList successives → une seule œuvre à plusieurs parties,
 *    si leurs titres commencent pareil (« Boruto » n'est pas une saison de « Naruto »).
 *
 * `existants` associe `espace:valeur` à l'identifiant d'une œuvre déjà en
 * base, pour que les identifiants internes restent stables d'un import à l'autre.
 */
export function rapprocher(
  fichesEntree: readonly FicheSource[],
  existants: ReadonlyMap<string, string> = new Map(),
): ResultatRapprochement {
  const parCle = new Map<string, number>();
  const fiches: FicheSource[] = [];
  for (const fiche of fichesEntree) {
    if (parCle.has(fiche.cle)) continue;
    parCle.set(fiche.cle, fiches.length);
    fiches.push(fiche);
  }

  const regroupement = new Regroupement(fiches);
  const conflits: string[] = [];
  const unir = (a: number, b: number) => {
    const conflit = regroupement.unir(a, b);
    if (conflit) conflits.push(conflit);
    return conflit === null;
  };

  // 1. Identifiants partagés. Les fiches Wikidata passent en premier : ce sont
  // elles qui déclarent le plus de liens.
  const indices = fiches.map((_, i) => i);
  const ordre = [
    ...indices.filter((i) => fiches[i]!.source === "wikidata"),
    ...indices.filter((i) => fiches[i]!.source !== "wikidata"),
  ];
  const parIdentifiant = new Map<string, number>();
  for (const i of ordre) {
    for (const identifiant of fiches[i]!.identifiants) {
      const cle = cleDe(identifiant);
      const deja = parIdentifiant.get(cle);
      if (deja === undefined) parIdentifiant.set(cle, i);
      else unir(deja, i);
    }
  }

  // 2. Titre + année, uniquement entre groupes qui n'ont pas déjà la source de l'autre.
  const heuristiques = new Set<number>();
  const index = new Map<string, Set<number>>();
  fiches.forEach((fiche, i) => {
    if (fiche.annee === null) return;
    for (const titre of fiche.titres) {
      const cle = `${normaliserTitre(titre.valeur)}|${fiche.technique}`;
      if (!index.has(cle)) index.set(cle, new Set());
      index.get(cle)!.add(i);
    }
  });
  for (const [, candidats] of index) {
    if (candidats.size < 2) continue;
    const liste = [...candidats];
    for (const i of liste) {
      const fiche = fiches[i]!;
      if (fiche.source === "anilist") continue;
      const ri = regroupement.racine(i);
      const sourcesI = regroupement.sources(ri);
      const correspondances = new Set(
        liste
          .filter((j) => {
            const autre = fiches[j]!;
            const rj = regroupement.racine(j);
            if (rj === ri || autre.source === fiche.source) return false;
            if (Math.abs((autre.annee ?? 0) - (fiche.annee ?? 0)) > 1) return false;
            const sourcesJ = regroupement.sources(rj);
            return !sourcesI.has(autre.source) && !sourcesJ.has(fiche.source);
          })
          .map((j) => regroupement.racine(j)),
      );
      if (correspondances.size !== 1) continue;
      const [cible] = correspondances;
      if (unir(i, cible!)) heuristiques.add(i);
    }
  }

  // 3. Saisons successives d'AniList, en dernier : si les autres sources ont
  // déjà rattaché deux saisons à deux séries distinctes (Naruto et Naruto
  // Shippūden chez TVmaze), la garde refuse de les fusionner.
  fiches.forEach((fiche, i) => {
    for (const relation of fiche.relations) {
      const cible = parCle.get(relation.cible);
      if (relation.regrouper && cible !== undefined && memeTitreDeBase(fiche, fiches[cible]!)) unir(i, cible);
    }
  });

  // Construction des œuvres et attribution d'identifiants stables.
  const idsPris = new Set<string>();
  const oeuvreDeFiche = new Map<string, string>();
  const oeuvres: Oeuvre[] = [];
  for (const groupe of regroupement.groupes()) {
    const membres = groupe.map((i) => fiches[i]!);
    const oeuvre = fusionner(membres, new Set(groupe.filter((i) => heuristiques.has(i)).map((i) => fiches[i]!.cle)));
    oeuvre.id = choisirIdentifiant(oeuvre, membres, existants, idsPris);
    idsPris.add(oeuvre.id);
    for (const membre of membres) oeuvreDeFiche.set(membre.cle, oeuvre.id);
    oeuvres.push(oeuvre);
  }

  const relations = new Map<string, Relation>();
  for (const fiche of fiches) {
    const de = oeuvreDeFiche.get(fiche.cle)!;
    for (const relation of fiche.relations) {
      if (relation.regrouper) continue;
      const vers = oeuvreDeFiche.get(relation.cible);
      if (!vers || vers === de) continue;
      const cle = `${de}|${vers}|${relation.type}`;
      if (!relations.has(cle)) relations.set(cle, { de, vers, type: relation.type, source: fiche.source });
    }
  }

  return {
    oeuvres,
    relations: [...relations.values()],
    conflits,
    rapprochementsHeuristiques: heuristiques.size,
  };
}

/**
 * Deux saisons d'une même œuvre partagent le début de leur titre romaji ou
 * anglais (« Shingeki no Kyojin » / « Shingeki no Kyojin Season 2 »).
 */
const ARTICLES = new Set(["the", "a", "an", "le", "la", "les", "l"]);

export function memeTitreDeBase(a: FicheSource, b: FicheSource): boolean {
  const debuts = (fiche: FicheSource) =>
    fiche.titres
      .filter((t) => t.type === "romaji" || t.type === "officiel")
      .map((t) => normaliserTitre(t.valeur).split(" ").filter((mot) => !ARTICLES.has(mot))[0] ?? "")
      .filter((mot) => mot.length > 0);
  const deA = new Set(debuts(a));
  return debuts(b).some((mot) => deA.has(mot));
}

const PREFIXES: Record<FicheSource["source"], string> = { wikidata: "wd", anilist: "al", tvmaze: "tvm" };

function choisirIdentifiant(
  oeuvre: Oeuvre,
  membres: readonly FicheSource[],
  existants: ReadonlyMap<string, string>,
  idsPris: ReadonlySet<string>,
): string {
  // Réutilise l'identifiant déjà attribué en base, au vote majoritaire.
  const votes = new Map<string, number>();
  for (const identifiant of oeuvre.identifiants) {
    const id = existants.get(cleDe(identifiant));
    if (id && !idsPris.has(id)) votes.set(id, (votes.get(id) ?? 0) + 1);
  }
  const reutilise = [...votes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (reutilise) return reutilise[0];

  // Sinon, ancre : Wikidata, puis le plus petit identifiant AniList, puis TVmaze.
  // Un identifiant déjà pris (par une œuvre qui l'a conservé de la base)
  // fait passer à l'ancre suivante.
  const candidats = [...membres]
    .sort((a, b) => {
      const ordre = ["wikidata", "anilist", "tvmaze"];
      const diff = ordre.indexOf(a.source) - ordre.indexOf(b.source);
      if (diff !== 0) return diff;
      return Number(a.cle.split(":")[1]) - Number(b.cle.split(":")[1]) || a.cle.localeCompare(b.cle);
    })
    .map((f) => `${PREFIXES[f.source]}-${f.cle.split(":")[1]}`);
  const libre = candidats.find((id) => !idsPris.has(id));
  if (libre) return libre;
  let n = 2;
  while (idsPris.has(`${candidats[0]}x${n}`)) n++;
  return `${candidats[0]}x${n}`;
}

function premier<T>(fiches: readonly FicheSource[], lire: (f: FicheSource) => T | null | undefined): [T, FicheSource] | null {
  for (const fiche of fiches) {
    const valeur = lire(fiche);
    if (valeur !== null && valeur !== undefined && !(Array.isArray(valeur) && valeur.length === 0)) {
      return [valeur, fiche];
    }
  }
  return null;
}

/** Construit une œuvre à partir des fiches d'un même groupe. */
export function fusionner(membres: readonly FicheSource[], heuristiques: ReadonlySet<string> = new Set()): Oeuvre {
  const fiches = [...membres].sort(
    (a, b) =>
      PRIORITE[a.source] - PRIORITE[b.source] ||
      (a.date_debut ?? "9999").localeCompare(b.date_debut ?? "9999") ||
      a.cle.localeCompare(b.cle),
  );
  const saisonsAnilist = fiches.filter((f) => f.source === "anilist");
  // Les titres des saisons suivantes (« … Season 2 ») restent sur leurs parties.
  const sourcesTitres = fiches.filter((f) => f.source !== "anilist" || f === saisonsAnilist[0]);
  const provenance: Record<string, Provenance> = {};
  const noter = (champ: string, fiche: FicheSource) => {
    provenance[champ] = { source: fiche.source, recupere_le: fiche.recupere_le };
  };

  const titres: Titre[] = [];
  const vus = new Set<string>();
  for (const fiche of sourcesTitres) {
    for (const titre of fiche.titres) {
      const cle = `${normaliserTitre(titre.valeur)}|${titre.langue}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      titres.push(titre);
    }
  }
  const principal =
    titres.find((t) => t.langue === "fr" && t.type === "officiel") ??
    titres.find((t) => t.source === "anilist" && t.type === "officiel") ??
    titres.find((t) => t.type === "romaji") ??
    titres.find((t) => t.type === "officiel") ??
    titres[0]!;
  provenance.titre_principal = {
    source: principal.source,
    recupere_le: fiches.find((f) => f.source === principal.source)!.recupere_le,
  };

  const parties: Partie[] = (saisonsAnilist.length > 0 ? saisonsAnilist : [fiches[0]!]).map((fiche, ordre) => ({
    cle: fiche.cle,
    ordre,
    titre:
      fiche.titres.find((t) => t.type === "romaji")?.valeur ??
      fiche.titres.find((t) => t.type === "officiel")?.valeur ??
      fiche.titres[0]?.valeur ??
      principal.valeur,
    format: fiche.format ?? "serie",
    annee: fiche.annee,
    episodes: fiche.episodes,
    duree_min: fiche.duree_min,
    source: fiche.source,
  }));

  const formatChoisi = premier(fiches, (f) => f.format);
  const format = saisonsAnilist.length > 1 ? "serie" : (formatChoisi?.[0] ?? "serie");
  if (formatChoisi) noter("format", formatChoisi[1]);

  const animee = fiches.find((f) => f.technique === "animation");
  const techniqueChoisie = animee ? (["animation", animee] as const) : premier(fiches, (f) => f.technique);
  const technique = techniqueChoisie?.[0] ?? "prises_de_vue_reelles";
  if (techniqueChoisie) noter("technique", techniqueChoisie[1]);

  const origines = premier(fiches, (f) => f.origines);
  if (origines) noter("origines", origines[1]);
  const demographie = technique === "animation" ? premier(fiches, (f) => f.demographie) : null;
  if (demographie) noter("demographie", demographie[1]);
  const publicCible = premier(fiches, (f) => f.public);
  if (publicCible) noter("public", publicCible[1]);
  const annee = premier(fiches, (f) => f.annee);
  if (annee) noter("annee", annee[1]);
  const duree = premier(fiches, (f) => f.duree_min);
  if (duree) noter("duree_min", duree[1]);

  const identifiants: IdentifiantExterne[] = [];
  const idsVus = new Set<string>();
  for (const fiche of fiches) {
    for (const identifiant of fiche.identifiants) {
      const cle = cleDe(identifiant);
      if (idsVus.has(cle)) continue;
      idsVus.add(cle);
      identifiants.push(
        heuristiques.has(fiche.cle) ? { ...identifiant, confiance: Math.min(identifiant.confiance, CONFIANCE_HEURISTIQUE) } : identifiant,
      );
    }
  }

  const credits: Credit[] = [];
  const creditsVus = new Set<string>();
  for (const credit of fiches.flatMap((f) => f.credits)) {
    const cle = `${credit.role}|${normaliserTitre(credit.nom)}`;
    if (creditsVus.has(cle)) continue;
    creditsVus.add(cle);
    credits.push(credit);
  }

  const synopsis: Synopsis[] = [];
  const synopsisVus = new Set<string>();
  for (const s of sourcesTitres.flatMap((f) => f.synopsis)) {
    const cle = `${s.langue}|${s.source}`;
    if (synopsisVus.has(cle)) continue;
    synopsisVus.add(cle);
    synopsis.push(s);
  }

  const images: Image[] = [];
  const imagesVues = new Set<string>();
  for (const image of sourcesTitres.flatMap((f) => f.images)) {
    const cle = `${image.type}|${image.source}`;
    if (imagesVues.has(cle)) continue;
    imagesVues.add(cle);
    images.push(image);
  }

  const popularite: Partial<Record<SourceId, number>> = {};
  for (const fiche of fiches) {
    if (fiche.popularite === null) continue;
    popularite[fiche.source] = Math.max(popularite[fiche.source] ?? 0, fiche.popularite);
  }

  const themes = new Set<string>();
  for (const fiche of sourcesTitres) for (const t of fiche.themes) themes.add(t.slug);

  const oeuvre: Oeuvre = {
    id: "",
    titre_principal: principal.valeur,
    titres,
    rubrique: "film",
    format,
    technique,
    origines: origines?.[0] ?? [],
    public: publicCible?.[0] ?? null,
    demographie: demographie?.[0] ?? null,
    adulte: fiches.some((f) => f.adulte),
    annee: annee?.[0] ?? null,
    duree_min: duree?.[0] ?? null,
    genres: Array.from(new Set(fiches.flatMap((f) => f.genres))),
    themes: [...themes],
    parties,
    identifiants,
    credits,
    synopsis,
    images,
    popularite,
    provenance,
  };
  oeuvre.rubrique = deriverRubrique(oeuvre);
  return oeuvre;
}

/** Libellés anglais des thèmes, pour alimenter la table des concepts. */
export function themesConnus(fiches: readonly FicheSource[]): Map<string, string> {
  const themes = new Map<string, string>();
  for (const fiche of fiches) for (const t of fiche.themes) if (!themes.has(t.slug)) themes.set(t.slug, t.libelle_en);
  return themes;
}
