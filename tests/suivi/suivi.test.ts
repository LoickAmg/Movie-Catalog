import { describe, expect, it } from "vitest";
import { cartesSuivi, correspondancesParCle, correspondancesParTitre } from "../../src/catalogue/suivi.ts";
import { remplacerCatalogue } from "../../src/db/catalogue.ts";
import { migrer, ouvrirPglite } from "../../src/db/client.ts";
import { evenementsDepuisImport, lireAnilist, lireCsv, lireLetterboxd, lireMal, type LigneImport } from "../../src/domain/imports.ts";
import { compterParStatut, creerEvenement, etatsDepuis, fusionnerJournaux, validerJournal, type Evenement } from "../../src/domain/suivi.ts";
import { rapprocher } from "../../src/ingestion/resolve.ts";
import { fiche } from "../fixtures.ts";

let n = 0;
const outils = (date: string) => ({ id: () => `e${++n}`, maintenant: () => date });

describe("journal de suivi", () => {
  it("déduit statut, avis et progression, dans l'ordre chronologique", () => {
    const journal: Evenement[] = [
      creerEvenement("statut", { oeuvre: "al-1", statut: "prevu" }, outils("2026-01-01T10:00:00Z")),
      creerEvenement("progression", { oeuvre: "al-1", partie: "anilist:1", episode: 3 }, outils("2026-01-03T10:00:00Z")),
      creerEvenement("avis", { oeuvre: "al-1", avis: "jaime" }, outils("2026-01-04T10:00:00Z")),
      // Arrivé après coup mais daté avant : ne doit pas écraser l'épisode 3.
      creerEvenement("progression", { oeuvre: "al-1", partie: "anilist:1", episode: 1 }, outils("2026-01-02T10:00:00Z")),
    ];
    const etat = etatsDepuis(journal).get("al-1")!;
    expect(etat).toMatchObject({
      statut: "en_cours",
      avis: "jaime",
      progression: { "anilist:1": 3 },
      commence_le: "2026-01-02T10:00:00Z",
      maj_le: "2026-01-04T10:00:00Z",
    });
  });

  it("noter un épisode d'une œuvre terminée ne la remet pas « en cours »", () => {
    const journal = [
      creerEvenement("statut", { oeuvre: "al-1", statut: "termine" }, outils("2026-01-01T00:00:00Z")),
      creerEvenement("progression", { oeuvre: "al-1", partie: "anilist:1", episode: 12 }, outils("2026-01-02T00:00:00Z")),
    ];
    expect(etatsDepuis(journal).get("al-1")?.statut).toBe("termine");
  });

  it("retire une œuvre puis la laisse revenir", () => {
    const journal = [
      creerEvenement("statut", { oeuvre: "al-1", statut: "en_cours" }, outils("2026-01-01T00:00:00Z")),
      creerEvenement("retrait", { oeuvre: "al-1" }, outils("2026-01-02T00:00:00Z")),
    ];
    expect(etatsDepuis(journal).has("al-1")).toBe(false);
    const retour = [...journal, creerEvenement("statut", { oeuvre: "al-1", statut: "prevu" }, outils("2026-01-03T00:00:00Z"))];
    expect(etatsDepuis(retour).get("al-1")).toMatchObject({ statut: "prevu", progression: {} });
  });

  it("valide un journal externe en écartant seulement les lignes invalides", () => {
    const bon = creerEvenement("statut", { oeuvre: "wd-Q1", statut: "termine" }, outils("2026-01-01T00:00:00Z"));
    const { evenements, rejetes } = validerJournal([
      bon,
      bon, // doublon
      { ...bon, id: "x1", oeuvre: "../../etc" },
      { ...bon, id: "x2", statut: "inconnu" },
      { ...bon, id: "x3", type: "progression", partie: "anilist:1", episode: -2 },
      { ...bon, id: "x4", origine: "pirate" },
      "pas un objet",
    ]);
    expect(evenements).toEqual([bon]);
    expect(rejetes).toBe(6);
    expect(validerJournal({ pas: "une liste" })).toEqual({ evenements: [], rejetes: 0 });
  });

  it("fusionne deux journaux sans doublon et compte par statut", () => {
    const a = creerEvenement("statut", { oeuvre: "al-1", statut: "termine" }, outils("2026-01-01T00:00:00Z"));
    const b = creerEvenement("avis", { oeuvre: "al-2", avis: "jaime" }, outils("2026-01-01T00:00:00Z"));
    const fusion = fusionnerJournaux([a], [a, b]);
    expect(fusion).toHaveLength(2);
    expect(compterParStatut(etatsDepuis(fusion).values())).toMatchObject({ termine: 1, jaime: 1, en_cours: 0 });
  });
});

describe("lecteurs d'import", () => {
  it("lit une liste AniList", () => {
    const lignes = lireAnilist({
      data: {
        MediaListCollection: {
          lists: [
            {
              entries: [
                { mediaId: 16498, status: "COMPLETED", progress: 25, score: 90, updatedAt: 1_700_000_000 },
                { mediaId: 20958, status: "CURRENT", progress: 4, score: 0, updatedAt: null },
                { mediaId: 5, status: "DROPPED", progress: 1, score: 30, updatedAt: null },
              ],
            },
          ],
        },
      },
    });
    expect(lignes).toEqual([
      { cle: "anilist:16498", titre: null, annee: null, statut: "termine", progression: 25, avis: "jaime", date: "2023-11-14T22:13:20.000Z" },
      { cle: "anilist:20958", titre: null, annee: null, statut: "en_cours", progression: 4, avis: null, date: null },
      { cle: "anilist:5", titre: null, annee: null, statut: "abandonne", progression: 1, avis: "pas_pour_moi", date: null },
    ]);
    expect(() => lireAnilist({ errors: [{ message: "User not found" }] })).toThrow("User not found");
  });

  it("lit un export MyAnimeList, avec CDATA et dates vides", () => {
    const xml = `<?xml version="1.0"?><myanimelist>
      <myinfo><user_name>test</user_name></myinfo>
      <anime><series_animedb_id>5114</series_animedb_id><series_title><![CDATA[Fullmetal Alchemist: Brotherhood]]></series_title>
        <my_watched_episodes>64</my_watched_episodes><my_score>10</my_score><my_status>Completed</my_status>
        <my_start_date>0000-00-00</my_start_date><my_finish_date>2021-03-05</my_finish_date></anime>
      <anime><series_animedb_id>1535</series_animedb_id><series_title><![CDATA[Death Note]]></series_title>
        <my_watched_episodes>0</my_watched_episodes><my_score>0</my_score><my_status>Plan to Watch</my_status>
        <my_finish_date>0000-00-00</my_finish_date></anime>
    </myanimelist>`;
    expect(lireMal(xml)).toEqual([
      { cle: "mal:5114", titre: "Fullmetal Alchemist: Brotherhood", annee: null, statut: "termine", progression: 64, avis: "jaime", date: "2021-03-05T00:00:00.000Z" },
      { cle: "mal:1535", titre: "Death Note", annee: null, statut: "prevu", progression: null, avis: null, date: null },
    ]);
    expect(() => lireMal("<html></html>")).toThrow(/export MyAnimeList/);
  });

  it("lit un CSV avec guillemets, virgules et retours à la ligne", () => {
    expect(lireCsv('﻿a,b\r\n"x, y","il a dit ""oui""\nfin"\n\n')).toEqual([
      ["a", "b"],
      ["x, y", 'il a dit "oui"\nfin'],
    ]);
  });

  it("lit les fichiers Letterboxd : vus, notes et liste à voir", () => {
    const notes = "Date,Name,Year,Letterboxd URI,Rating\n2024-02-01,\"Parasite\",2019,https://boxd.it/x,4.5\n2024-02-02,Cats,2019,https://boxd.it/y,1\n";
    expect(lireLetterboxd(notes, "ratings.csv")).toEqual([
      { cle: null, titre: "Parasite", annee: 2019, statut: "termine", progression: null, avis: "jaime", date: "2024-02-01T00:00:00.000Z" },
      { cle: null, titre: "Cats", annee: 2019, statut: "termine", progression: null, avis: "pas_pour_moi", date: "2024-02-02T00:00:00.000Z" },
    ]);
    const aVoir = lireLetterboxd("Date,Name,Year,Letterboxd URI\n2024-01-01,Heat,1995,https://boxd.it/z\n", "watchlist.csv");
    expect(aVoir[0]).toMatchObject({ titre: "Heat", statut: "prevu" });
    expect(() => lireLetterboxd("a,b\n1,2", "x.csv")).toThrow(/Name/);
  });

  it("transforme les lignes reconnues en actions, sans doublon au réimport", () => {
    const lignes: LigneImport[] = [
      { cle: "anilist:16498", titre: null, annee: null, statut: "termine", progression: 20, avis: "jaime", date: "2023-01-01T00:00:00.000Z" },
      { cle: "anilist:404", titre: null, annee: null, statut: "en_cours", progression: 2, avis: null, date: null },
    ];
    const trouver = (l: LigneImport) => (l.cle === "anilist:16498" ? { oeuvre: "al-16498", partie: "anilist:16498", episodes: 25 } : null);
    const r = evenementsDepuisImport(lignes, trouver, "import:anilist", "2026-10-14T00:00:00.000Z");
    expect(r.reconnues).toBe(1);
    expect(r.inconnues).toHaveLength(1);
    // Terminé : la progression est portée au nombre total d'épisodes.
    expect(etatsDepuis(r.evenements).get("al-16498")).toMatchObject({ statut: "termine", avis: "jaime", progression: { "anilist:16498": 25 } });
    const deuxFois = fusionnerJournaux(r.evenements, evenementsDepuisImport(lignes, trouver, "import:anilist", "2026-10-15T00:00:00.000Z").evenements);
    expect(deuxFois).toHaveLength(r.evenements.length);
  });
});

describe("correspondances en base", () => {
  it("retrouve une saison par son identifiant AniList ou MyAnimeList, et un film par titre et année", async () => {
    const db = await ouvrirPglite(null);
    try {
      await migrer(db);
      const { oeuvres, relations } = rapprocher([
        fiche({
          source: "anilist",
          cle: "anilist:16498",
          identifiants: [
            { espace: "anilist", valeur: "16498", confiance: 1 },
            { espace: "mal", valeur: "16498", confiance: 1 },
          ],
          titres: [{ valeur: "Shingeki no Kyojin", langue: "ja-Latn", type: "romaji", source: "anilist" }],
          technique: "animation",
          origines: ["JP"],
          format: "serie",
          episodes: 25,
          relations: [{ type: "suite", cible: "anilist:20958", regrouper: true }],
        }),
        fiche({
          source: "anilist",
          cle: "anilist:20958",
          identifiants: [
            { espace: "anilist", valeur: "20958", confiance: 1 },
            { espace: "mal", valeur: "25777", confiance: 1 },
          ],
          titres: [{ valeur: "Shingeki no Kyojin Season 2", langue: "ja-Latn", type: "romaji", source: "anilist" }],
          technique: "animation",
          origines: ["JP"],
          format: "serie",
          episodes: 12,
          date_debut: "2017",
        }),
        fiche({
          source: "wikidata",
          cle: "wikidata:Q1",
          titres: [{ valeur: "Parasite", langue: "en", type: "officiel", source: "wikidata" }],
          annee: 2019,
        }),
      ]);
      await remplacerCatalogue(db, oeuvres, relations, new Map(), { debut: new Date(), contenu: {} });

      const parCle = await correspondancesParCle(db, ["mal:25777", "anilist:16498", "wikidata:Q1", "anilist:404"]);
      expect(parCle).toEqual({
        "mal:25777": { oeuvre: "al-16498", partie: "anilist:20958", episodes: 12 },
        "anilist:16498": { oeuvre: "al-16498", partie: "anilist:16498", episodes: 25 },
        "wikidata:Q1": { oeuvre: "wd-Q1", partie: "wikidata:Q1", episodes: null },
      });

      expect(await correspondancesParTitre(db, [{ titre: "PARASITE", annee: 2019 }, { titre: "Parasite", annee: 1982 }, { titre: "Inconnu", annee: null }])).toEqual([
        { oeuvre: "wd-Q1", partie: "wikidata:Q1", episodes: null },
        null,
        null,
      ]);

      const [carte] = await cartesSuivi(db, ["al-16498"]);
      expect(carte?.parties.map((p) => [p.cle, p.episodes])).toEqual([
        ["anilist:16498", 25],
        ["anilist:20958", 12],
      ]);
    } finally {
      await db.close();
    }
  });
});
