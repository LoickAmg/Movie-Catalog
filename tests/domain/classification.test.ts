import { describe, expect, it } from "vitest";
import { badgeAnime, deriverRubrique } from "../../src/domain/classification.ts";
import { genresAnilist, genresTvmaze, genresWikidata } from "../../src/domain/genres.ts";
import { normaliserTitre, slugifier } from "../../src/domain/texte.ts";

describe("deriverRubrique", () => {
  it("range l'animation japonaise, chinoise et coréenne dans Anime", () => {
    for (const pays of ["JP", "CN", "KR"]) {
      expect(deriverRubrique({ technique: "animation", format: "serie", origines: [pays] })).toBe("anime");
    }
  });

  it("range l'animation d'autres pays dans Dessin animé", () => {
    expect(deriverRubrique({ technique: "animation", format: "film", origines: ["FR"] })).toBe("dessin_anime");
    expect(deriverRubrique({ technique: "animation", format: "serie", origines: ["US", "JP"] })).toBe("dessin_anime");
  });

  it("utilise le pays principal (le premier) pour une coproduction", () => {
    expect(deriverRubrique({ technique: "animation", format: "film", origines: ["JP", "FR"] })).toBe("anime");
  });

  it("range une animation sans origine connue dans Dessin animé", () => {
    expect(deriverRubrique({ technique: "animation", format: "serie", origines: [] })).toBe("dessin_anime");
  });

  it("sépare films et séries en prises de vue réelles", () => {
    expect(deriverRubrique({ technique: "prises_de_vue_reelles", format: "film", origines: ["KR"] })).toBe("film");
    expect(deriverRubrique({ technique: "prises_de_vue_reelles", format: "court", origines: [] })).toBe("film");
    expect(deriverRubrique({ technique: "prises_de_vue_reelles", format: "serie", origines: ["JP"] })).toBe("serie");
  });

  it("traite la technique mixte comme des prises de vue réelles", () => {
    expect(deriverRubrique({ technique: "mixte", format: "film", origines: ["US"] })).toBe("film");
  });

  it("donne le badge d'origine des anime", () => {
    expect(badgeAnime(["JP"])).toBe("japon");
    expect(badgeAnime(["CN"])).toBe("donghua");
    expect(badgeAnime(["KR"])).toBe("aeni");
    expect(badgeAnime(["FR"])).toBeNull();
  });
});

describe("genres", () => {
  it("traduit les genres AniList et ignore les inconnus", () => {
    expect(genresAnilist(["Action", "Slice of Life", "Mahou Shoujo", "Hentai"])).toEqual([
      "action",
      "tranche_de_vie",
      "magical_girl",
    ]);
  });

  it("traduit les genres TVmaze", () => {
    expect(genresTvmaze(["Drama", "Science-Fiction", "Food"])).toEqual(["drame", "science_fiction"]);
  });

  it("reconnaît les libellés Wikidata, y compris composés", () => {
    expect(genresWikidata("romantic comedy film")).toEqual(["romance", "comedie"]);
    expect(genresWikidata("comedy-drama")).toEqual(["comedie", "drame"]);
    expect(genresWikidata("science fiction television series")).toEqual(["science_fiction"]);
    expect(genresWikidata("neo-noir")).toEqual(["film_noir"]);
    expect(genresWikidata("melodrama")).toEqual(["drame"]);
    expect(genresWikidata("LGBTQ-related film")).toEqual([]);
  });

  it("ne confond pas « war » avec un mot qui le contient", () => {
    expect(genresWikidata("award")).toEqual([]);
  });
});

describe("normaliserTitre", () => {
  it("ignore casse, accents, apostrophes typographiques et ponctuation", () => {
    expect(normaliserTitre("L’Attaque des Titans")).toBe(normaliserTitre("l'attaque des titans"));
    expect(normaliserTitre("Amélie!")).toBe("amelie");
    expect(normaliserTitre("進撃の巨人")).toBe("進撃の巨人");
  });

  it("produit des slugs stables", () => {
    expect(slugifier("Slice of Life")).toBe("slice_of_life");
  });
});
