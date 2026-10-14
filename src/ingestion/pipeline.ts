import { acquerirAnilist, normaliserAnilist } from "./anilist.ts";
import type { FicheSource } from "./fiche.ts";
import type { ClientHttp } from "./http.ts";
import { acquerirTvmaze, normaliserTvmaze } from "./tvmaze.ts";
import {
  CLASSES_FILM,
  CLASSES_SERIE,
  PROPRIETES_REFERENCEES,
  detaillerElements,
  listerElements,
  normaliserWikidata,
  referencer,
  type TripletWikidata,
} from "./wikidata.ts";

export interface OptionsAcquisition {
  anilistMax: number;
  /**
   * Import complémentaire par pays : le classement mondial étant dominé par le
   * Japon, le donghua et l'aeni seraient presque absents sans lui.
   */
  anilistParPays: Record<string, number>;
  wikidataFilmsSitelinksMin: number;
  wikidataSeriesSitelinksMin: number;
  tvmazePoidsMin: number;
  tvmazePagesMax: number;
}

const LOT_DETAIL = 150;
const LOT_REFERENCES = 400;

export async function fichesAnilist(http: ClientHttp, options: OptionsAcquisition, journal: (m: string) => void) {
  const recupere_le = new Date().toISOString();
  const medias = await acquerirAnilist(http, options.anilistMax);
  journal(`AniList : ${medias.length} médias reçus`);
  for (const [pays, maximum] of Object.entries(options.anilistParPays)) {
    const lot = await acquerirAnilist(http, maximum, pays);
    journal(`AniList ${pays} : ${lot.length} médias reçus`);
    medias.push(...lot);
  }
  return medias.map((m) => normaliserAnilist(m, recupere_le)).filter((f): f is FicheSource => f !== null);
}

export async function fichesTvmaze(http: ClientHttp, options: OptionsAcquisition, journal: (m: string) => void) {
  const recupere_le = new Date().toISOString();
  const series = await acquerirTvmaze(http, { poidsMin: options.tvmazePoidsMin, pagesMax: options.tvmazePagesMax });
  journal(`TVmaze : ${series.length} séries au-dessus du poids ${options.tvmazePoidsMin}`);
  return series.map((s) => normaliserTvmaze(s, recupere_le)).filter((f): f is FicheSource => f !== null);
}

export async function fichesWikidata(http: ClientHttp, options: OptionsAcquisition, journal: (m: string) => void) {
  const recupere_le = new Date().toISOString();
  const sitelinks = new Map<string, number>();
  for (const [classes, seuil] of [
    [CLASSES_FILM, options.wikidataFilmsSitelinksMin],
    [CLASSES_SERIE, options.wikidataSeriesSitelinksMin],
  ] as const) {
    for (const classe of classes) {
      const elements = await listerElements(http, classe, seuil);
      for (const [qid, s] of elements) sitelinks.set(qid, s);
    }
  }
  const qids = [...sitelinks.keys()];
  journal(`Wikidata : ${qids.length} éléments à détailler`);

  const triplets: TripletWikidata[] = [];
  for (let i = 0; i < qids.length; i += LOT_DETAIL) {
    triplets.push(...(await detaillerElements(http, qids.slice(i, i + LOT_DETAIL))));
    if ((i / LOT_DETAIL) % 10 === 9) journal(`Wikidata : ${Math.min(i + LOT_DETAIL, qids.length)}/${qids.length} détaillés`);
  }

  const aReferencer = Array.from(
    new Set(triplets.filter((t) => PROPRIETES_REFERENCEES.includes(t.p) && /^Q\d+$/.test(t.v)).map((t) => t.v)),
  );
  const references = new Map<string, { fr?: string; en?: string; iso?: string }>();
  for (let i = 0; i < aReferencer.length; i += LOT_REFERENCES) {
    for (const [qid, ref] of await referencer(http, aReferencer.slice(i, i + LOT_REFERENCES))) references.set(qid, ref);
  }
  journal(`Wikidata : ${references.size} genres, pays, personnes et studios libellés`);

  const parElement = new Map<string, TripletWikidata[]>();
  for (const t of triplets) {
    const liste = parElement.get(t.item);
    if (liste) liste.push(t);
    else parElement.set(t.item, [t]);
  }
  return qids
    .map((qid) => normaliserWikidata(qid, parElement.get(qid) ?? [], references, sitelinks.get(qid) ?? null, recupere_le))
    .filter((f): f is FicheSource => f !== null);
}
