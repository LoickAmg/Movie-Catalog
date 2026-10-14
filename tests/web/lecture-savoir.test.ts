import { describe, expect, it } from "vitest";
import { listerRubrique, oeuvreDetaillee, oeuvresParCles, rechercher } from "../../src/catalogue/lecture.ts";
import { remplacerCatalogue } from "../../src/db/catalogue.ts";
import { migrer, ouvrirPglite } from "../../src/db/client.ts";
import { accentLisible, contraste, encreSur } from "../../src/domain/couleur.ts";
import { GENRES } from "../../src/domain/genres.ts";
import { DEMOGRAPHIES } from "../../src/domain/types.ts";
import { rapprocher } from "../../src/ingestion/resolve.ts";
import { chargerFiches, compterMots, ficheDuConcept, lireFiche, verifierFiches } from "../../src/savoir/fiches.ts";
import { CONCEPTS_INTERFACE, formaterDuree, lienExterne, nomLangue } from "../../src/web/libelles.ts";
import { fiche } from "../fixtures.ts";

async function baseDeTest() {
  const db = await ouvrirPglite(null);
  await migrer(db);
  const { oeuvres, relations } = rapprocher([
    fiche({
      source: "wikidata",
      cle: "wikidata:Q1",
      titres: [
        { valeur: "L'Attaque des Titans", langue: "fr", type: "officiel", source: "wikidata" },
        { valeur: "Shingeki no Kyojin", langue: "ja-Latn", type: "officiel", source: "wikidata" },
      ],
      technique: "animation",
      origines: ["JP"],
      format: "serie",
      genres: ["action"],
      popularite: 50,
      annee: 2013,
    }),
    fiche({
      source: "wikidata",
      cle: "wikidata:Q2",
      titres: [{ valeur: "Titans", langue: "en", type: "officiel", source: "wikidata" }],
      genres: ["action"],
      popularite: 90,
      annee: 2018,
      format: "serie",
    }),
    fiche({
      source: "wikidata",
      cle: "wikidata:Q3",
      titres: [{ valeur: "Le Choc des Titans", langue: "fr", type: "officiel", source: "wikidata" }],
      popularite: 20,
      annee: 1981,
      relations: [{ type: "remake", cible: "wikidata:Q2", regrouper: false }],
    }),
  ]);
  await remplacerCatalogue(db, oeuvres, relations, new Map(), { debut: new Date(), contenu: {} });
  return db;
}

describe("lecture du catalogue", () => {
  it("cherche dans tous les titres, mots dans le désordre, sans accents", async () => {
    const db = await baseDeTest();
    try {
      const r = await rechercher(db, { texte: "kyojin shingeki" });
      expect(r.resultats.map((c) => c.titre)).toEqual(["L'Attaque des Titans"]);
      expect((await rechercher(db, { texte: "ATTAQUE des titans" })).total).toBe(1);
      expect((await rechercher(db, { texte: "   " })).total).toBe(0);
    } finally {
      await db.close();
    }
  });

  it("classe le titre exact avant le début de titre, avant la simple présence", async () => {
    const db = await baseDeTest();
    try {
      const r = await rechercher(db, { texte: "titans" });
      // « Titans » est exact ; les deux autres le contiennent, départagés par la popularité.
      expect(r.resultats.map((c) => c.titre)).toEqual(["Titans", "L'Attaque des Titans", "Le Choc des Titans"]);
      expect(r.total).toBe(3);
      const anime = await rechercher(db, { texte: "titans", rubrique: "anime" });
      expect(anime.resultats.map((c) => c.titre)).toEqual(["L'Attaque des Titans"]);
    } finally {
      await db.close();
    }
  });

  it("filtre une rubrique par genre et décennie, et pagine", async () => {
    const db = await baseDeTest();
    try {
      expect((await listerRubrique(db, { rubrique: "serie", genre: "action" })).total).toBe(1);
      expect((await listerRubrique(db, { rubrique: "film", decennie: 1980 })).resultats[0]?.titre).toBe("Le Choc des Titans");
      expect((await listerRubrique(db, { rubrique: "film", decennie: 1990 })).total).toBe(0);
      const page2 = await listerRubrique(db, { rubrique: "serie", parPage: 1, page: 2 });
      expect(page2.total).toBe(1);
      expect(page2.resultats).toEqual([]);
    } finally {
      await db.close();
    }
  });

  it("détaille une œuvre avec ses titres, concepts et relations", async () => {
    const db = await baseDeTest();
    try {
      const o = await oeuvreDetaillee(db, "wd-Q3");
      expect(o?.relations.map((r) => [r.type, r.oeuvre.titre])).toEqual([["remake", "Titans"]]);
      expect(await oeuvreDetaillee(db, "wd-inconnu")).toBeNull();
      const aot = await oeuvreDetaillee(db, "wd-Q1");
      expect(aot?.concepts.map((c) => c.slug)).toEqual(["action"]);
      expect(await oeuvresParCles(db, ["wikidata:Q3", "anilist:404", "wikidata:Q1"])).toMatchObject([{ id: "wd-Q3" }, { id: "wd-Q1" }]);
    } finally {
      await db.close();
    }
  });
});

describe("couleurs de thème", () => {
  it("corrige une couleur trop sombre pour un fond sombre", () => {
    const corrigee = accentLisible("#1a1a40", "#0f0e0c")!;
    expect(contraste(corrigee, "#0f0e0c")).toBeGreaterThanOrEqual(4.5);
    expect(accentLisible("#f1a143", "#0f0e0c")).toBe("#f1a143");
    expect(accentLisible("pas une couleur", "#000000")).toBeNull();
  });

  it("choisit l'encre la plus lisible", () => {
    expect(encreSur("#f1a143")).toBe("#000000");
    expect(encreSur("#1a1a40")).toBe("#ffffff");
  });
});

describe("libellés", () => {
  it("formate les durées et les langues", () => {
    expect(formaterDuree(142, "film")).toBe("2 h 22");
    expect(formaterDuree(24, "serie")).toBe("24 min par épisode");
    expect(formaterDuree(null, "film")).toBeNull();
    expect(nomLangue("ja-Latn")).toBe("japonais romanisé");
    expect(nomLangue("en")).toBe("anglais");
  });

  it("construit les liens vers les sources", () => {
    expect(lienExterne("anilist", "16498")?.url).toBe("https://anilist.co/anime/16498");
    expect(lienExterne("tmdb_serie", "1396")?.url).toBe("https://www.themoviedb.org/tv/1396");
  });
});

describe("fiches Savoir", () => {
  const exemple = `---
titre: Test
type: definition
niveau: decouverte
accroche: Une accroche.
concepts: [mecha]
oeuvres: ["anilist:80"]
sources:
  - titre: Source
    url: https://exemple.test
statut: brouillon
---
Carte courte.

<!-- plus -->
Suite.`;

  it("lit une fiche valide et sépare la carte de la suite", () => {
    const f = lireFiche("test", exemple);
    expect(f).toMatchObject({ titre: "Test", carte: "Carte courte.", plus: "Suite.", concepts: ["mecha"] });
  });

  it("refuse une fiche incomplète en listant les problèmes", () => {
    expect(() => lireFiche("Mauvais Nom", exemple.replace("statut: brouillon", "statut: publie"))).toThrow(
      /nom de fichier invalide.*statut invalide/,
    );
    expect(() => lireFiche("test", "pas d'en-tête")).toThrow(/en-tête YAML manquant/);
    const tropLongue = exemple.replace("Carte courte.", "mot ".repeat(81));
    expect(() => lireFiche("test", tropLongue)).toThrow(/carte trop longue \(81 mots/);
  });

  it("compte les mots sans la syntaxe Markdown", () => {
    expect(compterMots("**Seinen** (青年) [lien](https://x.test) - ok")).toBe(4);
  });

  it("valide toutes les fiches du dépôt : format, longueurs, liens et concepts", async () => {
    const fiches = await chargerFiches();
    expect(fiches.length).toBeGreaterThanOrEqual(10);
    const concepts = new Set<string>([
      ...Object.keys(GENRES),
      ...DEMOGRAPHIES.map((d) => `demographie_${d}`),
      ...CONCEPTS_INTERFACE,
    ]);
    expect(verifierFiches(fiches, concepts)).toEqual([]);
    expect(ficheDuConcept(fiches, "demographie_seinen")?.slug).toBe("seinen");
  });
});
