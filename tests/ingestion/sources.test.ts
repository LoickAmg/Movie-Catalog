import { describe, expect, it } from "vitest";
import { normaliserAnilist, type MediaAnilist } from "../../src/ingestion/anilist.ts";
import { texteBrut } from "../../src/ingestion/fiche.ts";
import { normaliserTvmaze, type SerieTvmaze } from "../../src/ingestion/tvmaze.ts";
import { normaliserWikidata, type Reference, type TripletWikidata } from "../../src/ingestion/wikidata.ts";
import { RECUPERE_LE } from "../fixtures.ts";

const AOT: MediaAnilist = {
  id: 16498,
  idMal: 16498,
  title: { romaji: "Shingeki no Kyojin", english: "Attack on Titan", native: "進撃の巨人" },
  synonyms: ["L’Attaque des Titans"],
  format: "TV",
  episodes: 25,
  duration: 24,
  countryOfOrigin: "JP",
  isAdult: false,
  startDate: { year: 2013, month: 4, day: 7 },
  genres: ["Action", "Drama", "Fantasy"],
  tags: [
    { name: "Shounen", rank: 80, category: "Demographic", isMediaSpoiler: false },
    { name: "Kaiju", rank: 93, category: "Theme-Fantasy", isMediaSpoiler: false },
    { name: "Twist Ending", rank: 90, category: "Theme-Other", isMediaSpoiler: true },
    { name: "Military", rank: 40, category: "Theme-Other", isMediaSpoiler: false },
  ],
  studios: {
    nodes: [
      { id: 858, name: "WIT STUDIO", isAnimationStudio: true },
      { id: 1, name: "Pony Canyon", isAnimationStudio: false },
    ],
  },
  relations: {
    edges: [
      { relationType: "SEQUEL", node: { id: 20958, type: "ANIME", format: "TV" } },
      { relationType: "SEQUEL", node: { id: 99, type: "ANIME", format: "MOVIE" } },
      { relationType: "ADAPTATION", node: { id: 53390, type: "MANGA", format: "MANGA" } },
      { relationType: "SUMMARY", node: { id: 5, type: "ANIME", format: "MOVIE" } },
    ],
  },
  popularity: 1_000_000,
  coverImage: { large: "https://exemple.test/aot.jpg", color: "#f1a143" },
  bannerImage: null,
  description: "Des <i>titans</i> dévorent l&#039;humanité.<br>Fin.",
};

describe("normaliserAnilist", () => {
  const f = normaliserAnilist(AOT, RECUPERE_LE)!;

  it("garde titres natif, romaji, anglais et synonymes avec leur type", () => {
    expect(f.titres.map((t) => [t.valeur, t.langue, t.type])).toEqual([
      ["進撃の巨人", "ja", "original"],
      ["Shingeki no Kyojin", "ja-Latn", "romaji"],
      ["Attack on Titan", "en", "officiel"],
      ["L’Attaque des Titans", null, "alternatif"],
    ]);
  });

  it("traduit format, technique, origine, démographie et genres", () => {
    expect(f).toMatchObject({
      cle: "anilist:16498",
      format: "serie",
      technique: "animation",
      origines: ["JP"],
      demographie: "shonen",
      annee: 2013,
      date_debut: "2013-04-07",
      duree_min: 24,
      episodes: 25,
      genres: ["action", "drame", "fantasy"],
    });
    expect(f.identifiants).toEqual([
      { espace: "anilist", valeur: "16498", confiance: 1 },
      { espace: "mal", valeur: "16498", confiance: 1 },
    ]);
  });

  it("ne garde que les thèmes de rang suffisant, sans divulgâcheur ni démographie", () => {
    expect(f.themes).toEqual([{ slug: "kaiju", libelle_en: "Kaiju" }]);
  });

  it("ne garde que les studios d'animation", () => {
    expect(f.credits).toEqual([{ role: "studio", nom: "WIT STUDIO", source: "anilist" }]);
  });

  it("regroupe la saison suivante mais relie le film, et ignore manga et résumés", () => {
    expect(f.relations).toEqual([
      { type: "suite", cible: "anilist:20958", regrouper: true },
      { type: "suite", cible: "anilist:99", regrouper: false },
    ]);
  });

  it("nettoie le synopsis HTML", () => {
    expect(f.synopsis).toEqual([{ texte: "Des titans dévorent l'humanité.\nFin.", langue: "en", source: "anilist" }]);
  });

  it("écarte le contenu adulte et les formats inconnus", () => {
    expect(normaliserAnilist({ ...AOT, isAdult: true }, RECUPERE_LE)).toBeNull();
    expect(normaliserAnilist({ ...AOT, format: "MUSIC" }, RECUPERE_LE)).toBeNull();
  });
});

describe("normaliserWikidata", () => {
  const triplets: TripletWikidata[] = [
    { item: "Q1", p: "label", v: "Le Voyage de Chihiro", lang: "fr" },
    { item: "Q1", p: "label", v: "Spirited Away", lang: "en" },
    { item: "Q1", p: "label", v: "千と千尋の神隠し", lang: "ja" },
    { item: "Q1", p: "P31", v: "Q20650540" },
    { item: "Q1", p: "P136", v: "Q10" },
    { item: "Q1", p: "P495", v: "Q17" },
    { item: "Q1", p: "P577", v: "2002-04-10T00:00:00Z" },
    { item: "Q1", p: "P577", v: "2001-07-20T00:00:00Z" },
    { item: "Q1", p: "P2047", v: "125|http://www.wikidata.org/entity/Q7727" },
    { item: "Q1", p: "P57", v: "Q55" },
    { item: "Q1", p: "P345", v: "tt0245429" },
    { item: "Q1", p: "P8729", v: "199" },
    { item: "Q1", p: "P156", v: "Q2" },
    { item: "Q9", p: "P31", v: "Q100269041" },
    { item: "Q9", p: "label", v: "Saison 2", lang: "fr" },
  ];
  const references = new Map<string, Reference>([
    ["Q10", { en: "fantasy film" }],
    ["Q17", { en: "Japan", iso: "JP" }],
    ["Q55", { fr: "Hayao Miyazaki", en: "Hayao Miyazaki" }],
  ]);

  it("construit une fiche complète à partir des triplets", () => {
    const f = normaliserWikidata("Q1", triplets, references, 80, RECUPERE_LE)!;
    expect(f).toMatchObject({
      cle: "wikidata:Q1",
      format: "film",
      technique: "animation",
      origines: ["JP"],
      annee: 2001,
      date_debut: "2001-07-20",
      duree_min: 125,
      genres: ["fantasy"],
      popularite: 80,
    });
    expect(f.titres.map((t) => [t.valeur, t.type])).toEqual([
      ["Le Voyage de Chihiro", "officiel"],
      ["Spirited Away", "officiel"],
      ["千と千尋の神隠し", "officiel"],
    ]);
    expect(f.identifiants.map((i) => `${i.espace}:${i.valeur}`)).toEqual(["wikidata:Q1", "imdb:tt0245429", "anilist:199"]);
    expect(f.credits).toEqual([{ role: "realisation", nom: "Hayao Miyazaki", source: "wikidata" }]);
    expect(f.relations).toEqual([{ type: "suite", cible: "wikidata:Q2", regrouper: false }]);
  });

  it("lit les libellés multilingues (mul) et range les hybrides en technique mixte", () => {
    const avatar: TripletWikidata[] = [
      { item: "Q3", p: "label", v: "Avatar", lang: "mul" },
      { item: "Q3", p: "label", v: "アバター", lang: "ja" },
      { item: "Q3", p: "P31", v: "Q11424" },
      { item: "Q3", p: "P136", v: "Q25110269" },
      { item: "Q3", p: "P57", v: "Q42" },
    ];
    const refs = new Map<string, Reference>([
      ["Q25110269", { en: "live-action/animated film" }],
      ["Q42", { mul: "James Cameron" }],
    ]);
    const f = normaliserWikidata("Q3", avatar, refs, 100, RECUPERE_LE)!;
    expect(f.technique).toBe("mixte");
    expect(f.titres[0]).toMatchObject({ valeur: "Avatar", langue: "mul", type: "officiel" });
    expect(f.credits).toEqual([{ role: "realisation", nom: "James Cameron", source: "wikidata" }]);
  });

  it("déduit le Japon pour une classe « anime » sans pays d'origine", () => {
    const sansPays = triplets.filter((t) => t.p !== "P495");
    expect(normaliserWikidata("Q1", sansPays, references, 80, RECUPERE_LE)!.origines).toEqual(["JP"]);
  });

  it("convertit les durées exprimées en heures", () => {
    const enHeures = triplets.map((t) => (t.p === "P2047" ? { ...t, v: "2|http://www.wikidata.org/entity/Q25235" } : t));
    expect(normaliserWikidata("Q1", enHeures, references, 80, RECUPERE_LE)!.duree_min).toBe(120);
  });

  it("écarte les saisons, qui sont des parties et non des œuvres", () => {
    expect(normaliserWikidata("Q9", triplets, references, 10, RECUPERE_LE)).toBeNull();
  });
});

const SERIE: SerieTvmaze = {
  id: 82,
  name: "Game of Thrones",
  type: "Scripted",
  language: "English",
  genres: ["Drama", "Adventure", "Fantasy"],
  runtime: 60,
  averageRuntime: 61,
  premiered: "2011-04-17",
  weight: 99,
  externals: { imdb: "tt0944947" },
  image: { medium: "https://exemple.test/m.jpg", original: "https://exemple.test/o.jpg" },
  network: { country: { code: "US" } },
  webChannel: null,
  summary: "<p>Neuf familles nobles…</p>",
};

describe("normaliserTvmaze", () => {
  it("traduit une série en prises de vue réelles", () => {
    expect(normaliserTvmaze(SERIE, RECUPERE_LE)).toMatchObject({
      cle: "tvmaze:82",
      format: "serie",
      technique: "prises_de_vue_reelles",
      origines: ["US"],
      annee: 2011,
      duree_min: 61,
      genres: ["drame", "aventure", "fantasy"],
      synopsis: [{ texte: "Neuf familles nobles…", langue: "en", source: "tvmaze" }],
      images: [{ type: "affiche", url: "https://exemple.test/o.jpg", couleur: null, source: "tvmaze" }],
    });
  });

  it("reconnaît un anime diffusé sans chaîne, d'après sa langue", () => {
    const anime = { ...SERIE, type: "Animation", language: "Japanese", network: null, genres: ["Anime", "Action"] };
    expect(normaliserTvmaze(anime, RECUPERE_LE)).toMatchObject({ technique: "animation", origines: ["JP"] });
  });

  it("écarte la téléréalité et les talk-shows", () => {
    expect(normaliserTvmaze({ ...SERIE, type: "Reality" }, RECUPERE_LE)).toBeNull();
    expect(normaliserTvmaze({ ...SERIE, type: "Talk Show" }, RECUPERE_LE)).toBeNull();
  });
});

describe("texteBrut", () => {
  it("retire les balises et décode les entités courantes", () => {
    expect(texteBrut("<b>A</b> &amp; B &quot;C&quot;")).toBe('A & B "C"');
  });
});
