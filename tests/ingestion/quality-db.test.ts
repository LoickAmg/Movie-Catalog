import { describe, expect, it } from "vitest";
import { chargerCorrespondances, compterOeuvres, remplacerCatalogue } from "../../src/db/catalogue.ts";
import { migrer, ouvrirPglite } from "../../src/db/client.ts";
import { violations } from "../../src/domain/invariants.ts";
import { analyser, SEUILS_PAR_DEFAUT, verifierSeuils } from "../../src/ingestion/quality.ts";
import { rapprocher } from "../../src/ingestion/resolve.ts";
import { fiche } from "../fixtures.ts";

const fiches = [
  fiche({
    source: "anilist",
    cle: "anilist:1",
    technique: "animation",
    origines: ["JP"],
    format: "serie",
    demographie: "seinen",
    genres: ["drame"],
    themes: [{ slug: "kaiju", libelle_en: "Kaiju" }],
    credits: [{ role: "studio", nom: "MAPPA", source: "anilist" }],
    images: [{ type: "affiche", url: "https://exemple.test/a.jpg", couleur: "#000000", source: "anilist" }],
    relations: [{ type: "suite", cible: "wikidata:Q2", regrouper: false }],
  }),
  fiche({
    source: "wikidata",
    cle: "wikidata:Q2",
    titres: [{ valeur: "Le Film", langue: "fr", type: "officiel", source: "wikidata" }],
    genres: ["comedie"],
    synopsis: [],
  }),
];

describe("rapport de qualité", () => {
  const { oeuvres } = rapprocher(fiches);
  const rapport = analyser(oeuvres);

  it("compte rubriques, sources et couverture", () => {
    expect(rapport.total).toBe(2);
    expect(rapport.parRubrique).toEqual({ film: 1, serie: 0, anime: 1, dessin_anime: 0 });
    expect(rapport.parSource).toEqual({ anilist: 1, wikidata: 1 });
    expect(rapport.couverture.genres).toBe(1);
    expect(rapport.couverture.affiche).toBe(0.5);
    expect(rapport.couvertureParRubrique.anime.affiche).toBe(1);
  });

  it("signale les seuils non respectés", () => {
    expect(verifierSeuils(rapport, { ...SEUILS_PAR_DEFAUT, oeuvresMin: 1 })).toEqual([]);
    expect(verifierSeuils(rapport, SEUILS_PAR_DEFAUT)).toEqual(["2 œuvres (minimum 100)"]);
    expect(verifierSeuils(rapport, { ...SEUILS_PAR_DEFAUT, oeuvresMin: 1 }, 10)).toEqual([
      "2 œuvres contre 10 à l'import précédent",
    ]);
    expect(
      verifierSeuils(rapport, { ...SEUILS_PAR_DEFAUT, oeuvresMin: 1, couvertureMin: { affiche: 0.9 } }),
    ).toEqual(["couverture « affiche » à 50.0 % (minimum 90 %)"]);
  });

  it("repère les doublons suspects", () => {
    const double = analyser([...oeuvres, { ...oeuvres[1]!, id: "wd-Q3" }]);
    expect(double.doublonsSuspects).toEqual([{ titre: "Le Film", annee: 2000, ids: ["wd-Q2", "wd-Q3"] }]);
  });

  it("détecte une œuvre qui viole les invariants", () => {
    expect(violations({ ...oeuvres[0]!, annee: 1500, origines: ["japon"] })).toEqual([
      "al-1: pays invalide « japon »",
      "al-1: année hors limites (1500)",
      // Changer le pays sans recalculer la rubrique la rend incohérente.
      "al-1: rubrique incohérente avec les axes",
    ]);
  });
});

describe("catalogue en base", () => {
  it("enregistre, relit les correspondances et remplace sans perte d'identifiant", async () => {
    const db = await ouvrirPglite(null);
    try {
      await migrer(db);
      await migrer(db); // idempotent
      const premier = rapprocher(fiches);
      const themes = new Map([["kaiju", "Kaiju"]]);
      await remplacerCatalogue(db, premier.oeuvres, premier.relations, themes, { debut: new Date(), contenu: {} });
      expect(await compterOeuvres(db)).toBe(2);

      const correspondances = await chargerCorrespondances(db);
      expect(correspondances.get("anilist:1")).toBe("al-1");

      const { rows: concepts } = await db.query<{ concept_slug: string }>(
        "SELECT concept_slug FROM oeuvre_concept WHERE oeuvre_id = 'al-1' ORDER BY concept_slug",
      );
      expect(concepts.map((c) => c.concept_slug)).toEqual(["demographie_seinen", "drame", "theme_kaiju"]);
      const { rows: relations } = await db.query("SELECT de, vers, type FROM relation");
      expect(relations).toEqual([{ de: "al-1", vers: "wd-Q2", type: "suite" }]);

      // Deuxième import : Wikidata déclare maintenant le lien vers AniList.
      const lie = fiche({ ...fiches[1]!, identifiants: [...fiches[1]!.identifiants, { espace: "anilist", valeur: "1", confiance: 1 }] });
      const second = rapprocher([fiches[0]!, lie], correspondances);
      expect(second.oeuvres.map((o) => o.id)).toEqual(["al-1"]);
      await remplacerCatalogue(db, second.oeuvres, second.relations, themes, { debut: new Date(), contenu: {} });
      expect(await compterOeuvres(db)).toBe(1);
      const { rows: imports } = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM import_catalogue");
      expect(imports[0]!.n).toBe(2);
    } finally {
      await db.close();
    }
  });
});
