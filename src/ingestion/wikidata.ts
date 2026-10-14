import { genresWikidata } from "../domain/genres.ts";
import type { Credit, Format, IdentifiantExterne, Technique, Titre } from "../domain/types.ts";
import type { FicheSource, RelationSource } from "./fiche.ts";
import type { ClientHttp } from "./http.ts";

const SPARQL = "https://query.wikidata.org/sparql";
const ENTITE = "http://www.wikidata.org/entity/";

/** Classes (P31) récupérées, et le format qu'elles impliquent. */
export const CLASSES_FILM = ["Q11424", "Q202866", "Q20650540", "Q506240"];
export const CLASSES_SERIE = [
  "Q5398426",
  "Q63952888",
  "Q117467246",
  "Q581714",
  "Q1259759",
  "Q526877",
  "Q117467240",
  "Q136438882",
];

const FORMAT_PAR_CLASSE: Record<string, Format> = {
  ...Object.fromEntries(CLASSES_FILM.map((c) => [c, "film" as const])),
  ...Object.fromEntries(CLASSES_SERIE.map((c) => [c, "serie" as const])),
  Q17517379: "court",
  Q220898: "ova",
  Q113687694: "ova",
  Q1047299: "ona",
  Q113671041: "ona",
  Q104775758: "special",
};

const CLASSES_ANIMATION = new Set([
  "Q202866", // film d'animation
  "Q20650540", // film d'anime
  "Q63952888", // série télévisée d'anime
  "Q117467246", // série télévisée d'animation
  "Q581714", // série d'animation
  "Q117467240", // websérie d'animation
  "Q136438882", // série d'animation chinoise
  "Q17517379", // court métrage d'animation
  "Q220898",
  "Q113687694",
  "Q1047299",
  "Q113671041",
  "Q104775758",
]);

/** Classes « anime » : origine japonaise par définition chez Wikidata si P495 manque. */
const CLASSES_ANIME_JP = new Set(["Q20650540", "Q63952888", "Q220898", "Q113687694", "Q1047299", "Q113671041", "Q104775758"]);
const CLASSES_DONGHUA = new Set(["Q136438882"]);

/**
 * Éléments à ne jamais importer comme œuvres : saisons (ce sont des parties),
 * mangas, franchises, et éléments signalés comme confondant plusieurs objets.
 */
const CLASSES_EXCLUES = new Set(["Q100269041", "Q3464665", "Q21198342", "Q14946528", "Q24856", "Q196600"]);

const MINUTES_PAR_UNITE: Record<string, number> = { Q7727: 1, Q25235: 60, Q11574: 1 / 60 };

const LANGUES_LIBELLES = ["fr", "en", "ja", "zh", "ko"];

/** Un triplet (élément, propriété, valeur) renvoyé par la requête de détail. */
export interface TripletWikidata {
  item: string;
  p: string;
  v: string;
  lang?: string;
}

/** Libellés et code pays des éléments référencés (genres, pays, personnes, studios). */
export interface Reference {
  fr?: string;
  en?: string;
  iso?: string;
}

interface ReponseSparql {
  results: { bindings: Array<Record<string, { value: string; "xml:lang"?: string }>> };
}

const sansPrefixe = (valeur: string) => (valeur.startsWith(ENTITE) ? valeur.slice(ENTITE.length) : valeur);

async function sparql(http: ClientHttp, requete: string): Promise<ReponseSparql> {
  return http.json<ReponseSparql>(SPARQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/sparql-results+json",
    },
    body: new URLSearchParams({ query: requete, format: "json" }).toString(),
  });
}

/** QID → nombre de pages Wikipédia, pour une classe et un seuil donnés. */
export async function listerElements(
  http: ClientHttp,
  classe: string,
  sitelinksMin: number,
): Promise<Map<string, number>> {
  const reponse = await sparql(
    http,
    `SELECT ?item ?s WHERE { ?item wdt:P31 wd:${classe}; wikibase:sitelinks ?s. FILTER(?s >= ${sitelinksMin}) }`,
  );
  const elements = new Map<string, number>();
  for (const ligne of reponse.results.bindings) {
    const item = ligne.item?.value;
    const s = ligne.s?.value;
    if (item && s) elements.set(sansPrefixe(item), Number(s));
  }
  return elements;
}

const PROPRIETES_SIMPLES = [
  "P31",
  "P136",
  "P495",
  "P577",
  "P580",
  "P57",
  "P170",
  "P272",
  "P155",
  "P156",
  "P345",
  "P4947",
  "P4983",
  "P8729",
  "P4086",
  "P8600",
];

export async function detaillerElements(http: ClientHttp, qids: readonly string[]): Promise<TripletWikidata[]> {
  const blocs = [
    `{ ?item rdfs:label ?v. FILTER(LANG(?v) IN (${LANGUES_LIBELLES.map((l) => `"${l}"`).join(",")})) BIND("label" AS ?p) BIND(LANG(?v) AS ?lang) }`,
    `{ ?item wdt:P1476 ?v. BIND("P1476" AS ?p) BIND(LANG(?v) AS ?lang) }`,
    `{ ?item p:P2047/psv:P2047 ?q. ?q wikibase:quantityAmount ?a; wikibase:quantityUnit ?u. BIND(CONCAT(STR(?a), "|", STR(?u)) AS ?v) BIND("P2047" AS ?p) }`,
    ...PROPRIETES_SIMPLES.map((p) => `{ ?item wdt:${p} ?v. BIND("${p}" AS ?p) }`),
  ];
  const reponse = await sparql(
    http,
    `SELECT ?item ?p ?v ?lang WHERE { VALUES ?item { ${qids.map((q) => `wd:${q}`).join(" ")} } ${blocs.join(" UNION ")} }`,
  );
  return reponse.results.bindings.flatMap((ligne) => {
    const item = ligne.item?.value;
    const p = ligne.p?.value;
    const v = ligne.v?.value;
    if (!item || !p || v === undefined) return [];
    const lang = ligne.lang?.value;
    return [{ item: sansPrefixe(item), p, v: sansPrefixe(v), ...(lang ? { lang } : {}) }];
  });
}

export async function referencer(http: ClientHttp, qids: readonly string[]): Promise<Map<string, Reference>> {
  const reponse = await sparql(
    http,
    `SELECT ?x ?p ?v ?lang WHERE { VALUES ?x { ${qids.map((q) => `wd:${q}`).join(" ")} }
      { ?x rdfs:label ?v. FILTER(LANG(?v) IN ("fr", "en")) BIND("label" AS ?p) BIND(LANG(?v) AS ?lang) }
      UNION { ?x wdt:P297 ?v. BIND("P297" AS ?p) } }`,
  );
  const references = new Map<string, Reference>();
  for (const ligne of reponse.results.bindings) {
    const x = ligne.x?.value;
    const v = ligne.v?.value;
    if (!x || v === undefined) continue;
    const qid = sansPrefixe(x);
    const ref = references.get(qid) ?? {};
    if (ligne.p?.value === "P297") ref.iso = v;
    else if (ligne.lang?.value === "fr") ref.fr = v;
    else if (ligne.lang?.value === "en") ref.en = v;
    references.set(qid, ref);
  }
  return references;
}

/** Propriétés dont les valeurs sont des éléments à libeller. */
export const PROPRIETES_REFERENCEES = ["P136", "P495", "P57", "P170", "P272"];

function annee(valeurs: string[]): number | null {
  const annees = valeurs.map((v) => Number(v.slice(0, 4))).filter((a) => Number.isInteger(a) && a > 0);
  return annees.length ? Math.min(...annees) : null;
}

function dureeMinutes(valeurs: string[]): number | null {
  for (const valeur of valeurs) {
    const [montant, unite] = valeur.split("|");
    const facteur = MINUTES_PAR_UNITE[sansPrefixe(unite ?? "")];
    const minutes = Number(montant) * (facteur ?? NaN);
    if (Number.isFinite(minutes) && minutes > 0) return Math.round(minutes);
  }
  return null;
}

export function normaliserWikidata(
  qid: string,
  triplets: readonly TripletWikidata[],
  references: ReadonlyMap<string, Reference>,
  sitelinks: number | null,
  recupere_le: string,
): FicheSource | null {
  const valeurs = (p: string) => triplets.filter((t) => t.item === qid && t.p === p);
  const simples = (p: string) => Array.from(new Set(valeurs(p).map((t) => t.v)));

  const classes = simples("P31");
  if (classes.some((c) => CLASSES_EXCLUES.has(c))) return null;
  const formats = classes.map((c) => FORMAT_PAR_CLASSE[c]).filter((f): f is Format => Boolean(f));
  const format = formats.includes("film") ? "film" : (formats[0] ?? null);
  if (!format) return null;

  const genresEn = simples("P136").map((g) => references.get(g)?.en ?? "");
  const animation =
    classes.some((c) => CLASSES_ANIMATION.has(c)) || genresEn.some((g) => /\banimat|\banime\b/i.test(g));
  const technique: Technique = animation ? "animation" : "prises_de_vue_reelles";

  let origines = simples("P495")
    .map((p) => references.get(p)?.iso)
    .filter((iso): iso is string => Boolean(iso && /^[A-Z]{2}$/.test(iso)));
  if (origines.length === 0 && classes.some((c) => CLASSES_ANIME_JP.has(c))) origines = ["JP"];
  if (origines.length === 0 && classes.some((c) => CLASSES_DONGHUA.has(c))) origines = ["CN"];

  const titres: Titre[] = [];
  const vus = new Set<string>();
  const ajouter = (valeur: string, langue: string | null, type: Titre["type"]) => {
    const cle = `${valeur}|${langue}`;
    if (!valeur.trim() || vus.has(cle)) return;
    vus.add(cle);
    titres.push({ valeur: valeur.trim(), langue, type, source: "wikidata" });
  };
  for (const t of valeurs("label")) {
    ajouter(t.v, t.lang ?? null, t.lang === "fr" || t.lang === "en" ? "officiel" : "original");
  }
  for (const t of valeurs("P1476")) ajouter(t.v, t.lang ?? null, "original");
  if (titres.length === 0) return null;

  const identifiants: IdentifiantExterne[] = [{ espace: "wikidata", valeur: qid, confiance: 1 }];
  const ajouterIds = (p: string, espace: IdentifiantExterne["espace"], filtre: RegExp) => {
    for (const v of simples(p)) if (filtre.test(v)) identifiants.push({ espace, valeur: v, confiance: 1 });
  };
  ajouterIds("P345", "imdb", /^tt\d+$/);
  ajouterIds("P4947", "tmdb_film", /^\d+$/);
  ajouterIds("P4983", "tmdb_serie", /^\d+$/);
  ajouterIds("P8729", "anilist", /^\d+$/);
  ajouterIds("P4086", "mal", /^\d+$/);
  ajouterIds("P8600", "tvmaze", /^\d+$/);

  const credits: Credit[] = [];
  const ajouterCredits = (p: string, role: Credit["role"]) => {
    for (const q of simples(p)) {
      const nom = references.get(q)?.fr ?? references.get(q)?.en;
      if (nom) credits.push({ role, nom, source: "wikidata" });
    }
  };
  ajouterCredits("P57", "realisation");
  ajouterCredits("P170", "creation");
  ajouterCredits("P272", "studio");

  const relations: RelationSource[] = [
    ...simples("P155").map((q) => ({ type: "prequelle" as const, cible: `wikidata:${q}`, regrouper: false })),
    ...simples("P156").map((q) => ({ type: "suite" as const, cible: `wikidata:${q}`, regrouper: false })),
  ];

  const dates = [...simples("P577"), ...simples("P580")].sort();

  return {
    source: "wikidata",
    cle: `wikidata:${qid}`,
    identifiants,
    titres,
    format,
    technique,
    origines,
    public: null,
    demographie: null,
    adulte: false,
    annee: annee(simples("P577")) ?? annee(simples("P580")),
    date_debut: dates[0]?.slice(0, 10) ?? null,
    duree_min: dureeMinutes(simples("P2047")),
    episodes: null,
    genres: Array.from(new Set(genresEn.flatMap(genresWikidata))),
    themes: [],
    credits,
    synopsis: [],
    images: [],
    popularite: sitelinks,
    relations,
    recupere_le,
  };
}
