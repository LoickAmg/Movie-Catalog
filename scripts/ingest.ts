/**
 * Import du catalogue (lot 1) : AniList + Wikidata + TVmaze → PostgreSQL.
 *
 *   npm run ingest                         # import complet, base locale data/db
 *   npm run ingest -- --sources anilist --anilist-max 200
 *   npm run ingest -- --rafraichir         # ignore le cache des réponses brutes
 *   npm run ingest -- --essai              # rapport de qualité sans écrire en base
 *
 * Si un seuil de qualité n'est pas respecté, rien n'est écrit et le
 * programme se termine en erreur.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { chargerCorrespondances, compterOeuvres, remplacerCatalogue } from "../src/db/catalogue.ts";
import { migrer, ouvrirPglite } from "../src/db/client.ts";
import type { FicheSource } from "../src/ingestion/fiche.ts";
import { creerClientHttp } from "../src/ingestion/http.ts";
import { fichesAnilist, fichesTvmaze, fichesWikidata, type OptionsAcquisition } from "../src/ingestion/pipeline.ts";
import { analyser, SEUILS_PAR_DEFAUT, verifierSeuils } from "../src/ingestion/quality.ts";
import { rapprocher, themesConnus } from "../src/ingestion/resolve.ts";

const RACINE = path.resolve(import.meta.dirname, "..");
const USER_AGENT = "MovieCatalogWeb/0.1 (https://github.com/LoickAmg/Movie-Catalog)";

const { values: args } = parseArgs({
  options: {
    sources: { type: "string", default: "anilist,wikidata,tvmaze" },
    "anilist-max": { type: "string", default: "3000" },
    "wd-films-sitelinks": { type: "string", default: "20" },
    "wd-series-sitelinks": { type: "string", default: "15" },
    "tvmaze-poids": { type: "string", default: "95" },
    "tvmaze-pages": { type: "string", default: "400" },
    db: { type: "string", default: path.join(RACINE, "data", "db") },
    rafraichir: { type: "boolean", default: false },
    essai: { type: "boolean", default: false },
    "oeuvres-min": { type: "string" },
  },
});

const journal = (message: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${message}`);

const options: OptionsAcquisition = {
  anilistMax: Number(args["anilist-max"]),
  wikidataFilmsSitelinksMin: Number(args["wd-films-sitelinks"]),
  wikidataSeriesSitelinksMin: Number(args["wd-series-sitelinks"]),
  tvmazePoidsMin: Number(args["tvmaze-poids"]),
  tvmazePagesMax: Number(args["tvmaze-pages"]),
};
const sources = new Set(args.sources.split(",").map((s) => s.trim()));
const cache = (source: string) => path.join(RACINE, "data", "raw", source);
const http = (source: string, intervalleMs: number) =>
  creerClientHttp({ userAgent: USER_AGENT, intervalleMs, dossierCache: cache(source), rafraichir: args.rafraichir, journal });

async function principal() {
  const debut = new Date();
  // AniList : 30 requêtes/minute ; TVmaze : 20 requêtes/10 s ; Wikidata : requêtes séquentielles.
  const lots = await Promise.all([
    sources.has("anilist") ? fichesAnilist(http("anilist", 2100), options, journal) : [],
    sources.has("wikidata") ? fichesWikidata(http("wikidata", 500), options, journal) : [],
    sources.has("tvmaze") ? fichesTvmaze(http("tvmaze", 600), options, journal) : [],
  ]);
  const fiches: FicheSource[] = lots.flat();
  journal(`${fiches.length} fiches normalisées`);

  const db = await ouvrirPglite(args.essai ? null : args.db);
  try {
    await migrer(db);
    const existants = await chargerCorrespondances(db);
    const precedent = existants.size > 0 ? await compterOeuvres(db) : null;

    const resultat = rapprocher(fiches, existants);
    const rapport = analyser(resultat.oeuvres, {
      conflits: resultat.conflits.length,
      rapprochementsHeuristiques: resultat.rapprochementsHeuristiques,
    });
    const seuils = { ...SEUILS_PAR_DEFAUT, ...(args["oeuvres-min"] ? { oeuvresMin: Number(args["oeuvres-min"]) } : {}) };
    const echecs = verifierSeuils(rapport, seuils, precedent);

    const dossierRapports = path.join(RACINE, "data", "rapports");
    await mkdir(dossierRapports, { recursive: true });
    await writeFile(
      path.join(dossierRapports, "dernier-import.json"),
      JSON.stringify({ rapport, echecs, conflits: resultat.conflits.slice(0, 200) }, null, 2),
    );

    journal(`${rapport.total} œuvres : ${JSON.stringify(rapport.parRubrique)}`);
    journal(`couverture : ${JSON.stringify(rapport.couverture)}`);
    journal(
      `${resultat.relations.length} relations, ${resultat.conflits.length} fusions refusées, ` +
        `${rapport.rapprochementsHeuristiques} rapprochements par titre, ${rapport.doublonsSuspects.length} doublons suspects`,
    );

    if (echecs.length > 0) {
      console.error(`Import refusé :\n- ${echecs.join("\n- ")}`);
      process.exitCode = 1;
      return;
    }
    if (args.essai) {
      journal("mode essai : rien n'a été écrit");
      return;
    }
    await remplacerCatalogue(db, resultat.oeuvres, resultat.relations, themesConnus(fiches), {
      debut,
      contenu: rapport,
    });
    journal(`catalogue enregistré dans ${args.db}`);
  } finally {
    await db.close();
  }
}

principal().catch((erreur) => {
  console.error(erreur);
  process.exitCode = 1;
});
