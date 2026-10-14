import { describe, expect, it } from "vitest";
import { violations } from "../../src/domain/invariants.ts";
import { CONFIANCE_HEURISTIQUE, rapprocher } from "../../src/ingestion/resolve.ts";
import { fiche } from "../fixtures.ts";

const saison1 = fiche({
  source: "anilist",
  cle: "anilist:16498",
  identifiants: [
    { espace: "anilist", valeur: "16498", confiance: 1 },
    { espace: "mal", valeur: "16498", confiance: 1 },
  ],
  titres: [
    { valeur: "Shingeki no Kyojin", langue: "ja-Latn", type: "romaji", source: "anilist" },
    { valeur: "Attack on Titan", langue: "en", type: "officiel", source: "anilist" },
  ],
  format: "serie",
  technique: "animation",
  origines: ["JP"],
  demographie: "shonen",
  annee: 2013,
  date_debut: "2013-04-07",
  duree_min: 24,
  episodes: 25,
  genres: ["action"],
  relations: [{ type: "suite", cible: "anilist:20958", regrouper: true }],
  popularite: 1000,
});
const saison2 = fiche({
  ...saison1,
  cle: "anilist:20958",
  identifiants: [{ espace: "anilist", valeur: "20958", confiance: 1 }],
  titres: [{ valeur: "Shingeki no Kyojin Season 2", langue: "ja-Latn", type: "romaji", source: "anilist" }],
  annee: 2017,
  date_debut: "2017-04-01",
  episodes: 12,
  relations: [{ type: "prequelle", cible: "anilist:16498", regrouper: true }],
  popularite: 800,
});
const wikidataAot = fiche({
  source: "wikidata",
  cle: "wikidata:Q123",
  identifiants: [
    { espace: "wikidata", valeur: "Q123", confiance: 1 },
    { espace: "anilist", valeur: "16498", confiance: 1 },
    { espace: "tvmaze", valeur: "919", confiance: 1 },
  ],
  titres: [
    { valeur: "L'Attaque des Titans", langue: "fr", type: "officiel", source: "wikidata" },
    { valeur: "Attack on Titan", langue: "en", type: "officiel", source: "wikidata" },
  ],
  format: "serie",
  technique: "animation",
  origines: ["JP"],
  annee: 2013,
  popularite: 70,
});
const tvmazeAot = fiche({
  source: "tvmaze",
  cle: "tvmaze:919",
  titres: [{ valeur: "Attack on Titan", langue: null, type: "officiel", source: "tvmaze" }],
  format: "serie",
  technique: "animation",
  origines: ["JP"],
  annee: 2013,
  synopsis: [{ texte: "Synopsis TVmaze", langue: "en", source: "tvmaze" }],
  popularite: 99,
});

describe("rapprocher", () => {
  it("réunit les fiches de trois sources et les saisons en une seule œuvre valide", () => {
    const { oeuvres, conflits } = rapprocher([saison1, saison2, wikidataAot, tvmazeAot]);
    expect(conflits).toEqual([]);
    expect(oeuvres).toHaveLength(1);
    const aot = oeuvres[0]!;
    expect(aot).toMatchObject({
      id: "wd-Q123",
      titre_principal: "L'Attaque des Titans",
      rubrique: "anime",
      format: "serie",
      demographie: "shonen",
      annee: 2013,
      popularite: { anilist: 1000, wikidata: 70, tvmaze: 99 },
    });
    expect(aot.parties.map((p) => [p.cle, p.ordre, p.titre])).toEqual([
      ["anilist:16498", 0, "Shingeki no Kyojin"],
      ["anilist:20958", 1, "Shingeki no Kyojin Season 2"],
    ]);
    // Les titres de la saison 2 restent sur sa partie.
    expect(aot.titres.some((t) => t.valeur.includes("Season 2"))).toBe(false);
    // « Attack on Titan » vient de deux sources mais n'apparaît qu'une fois par langue.
    expect(aot.titres.filter((t) => t.valeur === "Attack on Titan" && t.langue === "en")).toHaveLength(1);
    expect(aot.provenance.titre_principal?.source).toBe("wikidata");
    expect(aot.provenance.demographie?.source).toBe("anilist");
    expect(violations(aot)).toEqual([]);
  });

  it("refuse de fusionner deux éléments Wikidata distincts", () => {
    const autre = fiche({
      ...wikidataAot,
      cle: "wikidata:Q999",
      identifiants: [
        { espace: "wikidata", valeur: "Q999", confiance: 1 },
        { espace: "anilist", valeur: "16498", confiance: 1 },
      ],
    });
    const { oeuvres, conflits } = rapprocher([wikidataAot, autre, saison1]);
    expect(oeuvres).toHaveLength(2);
    expect(conflits).toHaveLength(1);
    expect(conflits[0]).toContain("wikidata:Q999");
  });

  it("rapproche par titre et année quand aucun identifiant n'est partagé, avec une confiance réduite", () => {
    const tvmazeSansLien = fiche({ ...tvmazeAot, cle: "tvmaze:5000", annee: 2014 });
    const { oeuvres, rapprochementsHeuristiques } = rapprocher([saison1, tvmazeSansLien]);
    expect(oeuvres).toHaveLength(1);
    expect(rapprochementsHeuristiques).toBe(1);
    expect(oeuvres[0]!.identifiants.find((i) => i.espace === "tvmaze")?.confiance).toBe(CONFIANCE_HEURISTIQUE);
  });

  it("ne rapproche pas par titre si l'année est trop éloignée ou la correspondance ambiguë", () => {
    const tropTard = fiche({ ...tvmazeAot, cle: "tvmaze:5000", annee: 2020 });
    expect(rapprocher([saison1, tropTard]).oeuvres).toHaveLength(2);

    const remake = fiche({ ...saison1, cle: "anilist:1", identifiants: [{ espace: "anilist", valeur: "1", confiance: 1 }], relations: [] });
    const ambigu = fiche({ ...tvmazeAot, cle: "tvmaze:5000" });
    expect(rapprocher([{ ...saison1, relations: [] }, remake, ambigu]).oeuvres).toHaveLength(3);
  });

  it("ne rapproche jamais deux fiches de la même source par leur titre", () => {
    const a = fiche({ source: "wikidata", cle: "wikidata:Q1", titres: [{ valeur: "Dune", langue: "en", type: "officiel", source: "wikidata" }] });
    const b = fiche({ source: "wikidata", cle: "wikidata:Q2", titres: [{ valeur: "Dune", langue: "en", type: "officiel", source: "wikidata" }] });
    expect(rapprocher([a, b]).oeuvres).toHaveLength(2);
  });

  it("ne regroupe pas en saisons une suite au titre différent (Naruto → Boruto)", () => {
    const naruto = fiche({ ...saison1, cle: "anilist:20", identifiants: [{ espace: "anilist", valeur: "20", confiance: 1 }], titres: [{ valeur: "Naruto", langue: "ja-Latn", type: "romaji", source: "anilist" }], relations: [{ type: "suite", cible: "anilist:97938", regrouper: true }] });
    const boruto = fiche({ ...saison1, cle: "anilist:97938", identifiants: [{ espace: "anilist", valeur: "97938", confiance: 1 }], titres: [{ valeur: "Boruto: Naruto Next Generations", langue: "ja-Latn", type: "romaji", source: "anilist" }], relations: [] });
    expect(rapprocher([naruto, boruto]).oeuvres).toHaveLength(2);
  });

  it("laisse TVmaze séparer deux séries qu'AniList enchaîne (Naruto → Shippūden)", () => {
    const naruto = fiche({ ...saison1, cle: "anilist:20", annee: 2002, identifiants: [{ espace: "anilist", valeur: "20", confiance: 1 }], titres: [{ valeur: "Naruto", langue: "ja-Latn", type: "romaji", source: "anilist" }], relations: [{ type: "suite", cible: "anilist:1735", regrouper: true }] });
    const shippuden = fiche({ ...saison1, cle: "anilist:1735", annee: 2007, identifiants: [{ espace: "anilist", valeur: "1735", confiance: 1 }], titres: [{ valeur: "Naruto: Shippuuden", langue: "ja-Latn", type: "romaji", source: "anilist" }], relations: [] });
    const tvmNaruto = fiche({ ...tvmazeAot, cle: "tvmaze:495", identifiants: [{ espace: "tvmaze", valeur: "495", confiance: 1 }], annee: 2002, titres: [{ valeur: "Naruto", langue: null, type: "officiel", source: "tvmaze" }] });
    const tvmShippuden = fiche({ ...tvmazeAot, cle: "tvmaze:488", identifiants: [{ espace: "tvmaze", valeur: "488", confiance: 1 }], annee: 2007, titres: [{ valeur: "Naruto: Shippuuden", langue: null, type: "officiel", source: "tvmaze" }] });
    const { oeuvres, conflits } = rapprocher([naruto, shippuden, tvmNaruto, tvmShippuden]);
    expect(oeuvres).toHaveLength(2);
    expect(conflits).toHaveLength(1);
  });

  it("garde les identifiants déjà attribués en base", () => {
    const existants = new Map([["anilist:16498", "al-16498"]]);
    const { oeuvres } = rapprocher([saison1, saison2, wikidataAot], existants);
    expect(oeuvres[0]!.id).toBe("al-16498");
  });

  it("n'attribue jamais deux fois le même identifiant interne", () => {
    // En base, « al-16498 » désignait l'œuvre de la fiche TVmaze ; la saison 1 doit en prendre un autre.
    const seule = fiche({ ...tvmazeAot, cle: "tvmaze:777", identifiants: [{ espace: "tvmaze", valeur: "777", confiance: 1 }], annee: 1990, titres: [{ valeur: "Autre", langue: null, type: "officiel", source: "tvmaze" }] });
    const { oeuvres } = rapprocher([seule, { ...saison1, relations: [] }], new Map([["tvmaze:777", "al-16498"]]));
    const ids = oeuvres.map((o) => o.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids).toContain("al-16498");
  });

  it("relie les œuvres distinctes et ignore les cibles absentes", () => {
    const film = fiche({
      source: "anilist",
      cle: "anilist:99",
      technique: "animation",
      origines: ["JP"],
      relations: [{ type: "prequelle", cible: "anilist:16498", regrouper: false }],
    });
    const avecLien = { ...saison1, relations: [...saison1.relations, { type: "suite" as const, cible: "anilist:99", regrouper: false }, { type: "derive" as const, cible: "anilist:404", regrouper: false }] };
    const { relations } = rapprocher([avecLien, saison2, film]);
    expect(relations).toEqual([
      { de: "al-16498", vers: "al-99", type: "suite", source: "anilist" },
      { de: "al-99", vers: "al-16498", type: "prequelle", source: "anilist" },
    ]);
  });
});
