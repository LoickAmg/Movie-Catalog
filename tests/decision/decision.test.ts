import { describe, expect, it } from "vitest";
import { candidats, traitsDe } from "../../src/catalogue/traits.ts";
import { remplacerCatalogue } from "../../src/db/catalogue.ts";
import { migrer, ouvrirPglite } from "../../src/db/client.ts";
import { affinite, decider, respecteContraintes, type Contexte } from "../../src/domain/decision.ts";
import { calculerProfil, principauxGouts, signal } from "../../src/domain/profil.ts";
import { creerEvenement, etatsDepuis, reglagesDepuis, validerJournal, type EtatSuivi } from "../../src/domain/suivi.ts";
import type { Traits } from "../../src/domain/traits.ts";
import { rapprocher } from "../../src/ingestion/resolve.ts";
import { fiche } from "../fixtures.ts";

function oeuvre(id: string, partiel: Partial<Traits> & { cles: string[] }): Traits {
  return {
    id,
    titre: id,
    rubrique: "film",
    format: "film",
    annee: 2010,
    duree_min: 110,
    origines: ["US"],
    demographie: null,
    score: 0.5,
    affiche: null,
    couleur: null,
    episodes: null,
    ...partiel,
  };
}

const etat = (oeuvre: string, partiel: Partial<EtatSuivi>): EtatSuivi => ({
  oeuvre,
  statut: null,
  avis: null,
  progression: {},
  maj_le: "2026-01-01T00:00:00Z",
  commence_le: null,
  termine_le: null,
  ...partiel,
});

// Un amateur de thrillers seinen, qui n'aime pas l'horreur.
const vus = new Map<string, Traits>([
  ["al-1", oeuvre("al-1", { titre: "Monster", rubrique: "anime", format: "serie", duree_min: 24, cles: ["rubrique:anime", "origine:JP", "genre:thriller", "genre:mystere", "demo:seinen", "credit:madhouse"] })],
  ["al-2", oeuvre("al-2", { titre: "Death Note", rubrique: "anime", format: "serie", duree_min: 23, cles: ["rubrique:anime", "origine:JP", "genre:thriller", "genre:psychologique", "demo:shonen", "credit:madhouse"] })],
  ["al-3", oeuvre("al-3", { titre: "Erased", rubrique: "anime", format: "serie", duree_min: 23, cles: ["rubrique:anime", "origine:JP", "genre:thriller", "genre:mystere", "demo:seinen"] })],
  ["al-4", oeuvre("al-4", { titre: "Another", rubrique: "anime", format: "serie", duree_min: 24, cles: ["rubrique:anime", "origine:JP", "genre:horreur", "genre:mystere"] })],
]);
const etats = new Map([
  ["al-1", etat("al-1", { statut: "termine", avis: "jaime" })],
  ["al-2", etat("al-2", { statut: "termine" })],
  ["al-3", etat("al-3", { statut: "termine", avis: "jaime" })],
  ["al-4", etat("al-4", { statut: "abandonne", avis: "pas_pour_moi" })],
]);
const libelle = (cle: string) => cle.slice(cle.indexOf(":") + 1);
const SANS_CONTRAINTE: Contexte = { duree: null, format: null, envie: null, surprendre: false };

describe("profil de goûts", () => {
  const profil = calculerProfil(etats.values(), vus);

  it("pondère les signaux du suivi", () => {
    expect(signal(etat("x", { statut: "termine", avis: "jaime" }))).toBe(4);
    expect(signal(etat("x", { statut: "termine", avis: "pas_pour_moi" }))).toBe(-3);
    expect(signal(etat("x", { statut: "abandonne" }))).toBe(-2);
  });

  it("met en tête les traits récurrents des œuvres aimées, avec leurs preuves", () => {
    const [premier] = principauxGouts(profil, 3);
    expect(premier?.cle).toBe("genre:thriller");
    expect(premier?.preuves.map((p) => p.titre)).toEqual(["Monster", "Erased", "Death Note"]);
    expect(profil.gouts.get("genre:horreur")!.poids).toBeLessThan(0);
    expect(profil.base).toBe(4);
  });

  it("applique les corrections : plus, moins, jamais", () => {
    const corrige = calculerProfil(etats.values(), vus, new Map([["genre:horreur", "plus"], ["demo:seinen", "jamais"], ["genre:western", "moins"]]));
    expect(corrige.gouts.get("genre:horreur")!.poids).toBeGreaterThan(0);
    expect(corrige.gouts.get("genre:horreur")!.poidsCalcule).toBeLessThan(0);
    expect(corrige.exclus.has("demo:seinen")).toBe(true);
    expect(corrige.gouts.get("genre:western")).toMatchObject({ poids: -0.5, nombre: 0, reglage: "moins" });
  });

  it("enregistre les réglages dans le journal et garde le dernier", () => {
    const outils = (d: string, id: string) => ({ id: () => id, maintenant: () => d });
    const journal = [
      creerEvenement("reglage", { trait: "genre:horreur", reglage: "jamais" }, outils("2026-01-01T00:00:00Z", "r1")),
      creerEvenement("reglage", { trait: "genre:horreur", reglage: null }, outils("2026-01-02T00:00:00Z", "r2")),
      creerEvenement("reglage", { trait: "credit:mappa", reglage: "plus" }, outils("2026-01-03T00:00:00Z", "r3")),
    ];
    expect([...reglagesDepuis(journal)]).toEqual([["credit:mappa", "plus"]]);
    expect(validerJournal(journal).evenements).toHaveLength(3);
    expect(validerJournal([{ ...journal[0], trait: "pirate:<script>" }]).rejetes).toBe(1);
    expect(etatsDepuis(journal).size).toBe(0);
  });
});

describe("« Ce soir »", () => {
  const profil = calculerProfil(etats.values(), vus);
  const pool = [
    oeuvre("wd-pluto", { titre: "Pluto", rubrique: "anime", format: "serie", duree_min: 60, score: 0.6, cles: ["rubrique:anime", "origine:JP", "genre:thriller", "genre:mystere", "demo:seinen"] }),
    oeuvre("wd-psycho", { titre: "Psycho-Pass", rubrique: "anime", format: "serie", duree_min: 23, score: 0.7, cles: ["rubrique:anime", "origine:JP", "genre:thriller", "genre:psychologique", "credit:madhouse"] }),
    oeuvre("wd-horreur", { titre: "Horreur", rubrique: "anime", format: "serie", duree_min: 24, score: 0.9, cles: ["rubrique:anime", "origine:JP", "genre:horreur"] }),
    oeuvre("wd-memories", { titre: "Memories of Murder", rubrique: "film", format: "film", duree_min: 132, score: 0.7, origines: ["KR"], cles: ["rubrique:film", "origine:KR", "genre:thriller", "genre:crime"] }),
    oeuvre("wd-comedie", { titre: "Comédie", rubrique: "film", format: "film", duree_min: 95, score: 0.95, cles: ["rubrique:film", "origine:US", "genre:comedie"] }),
    oeuvre("al-1", { ...vus.get("al-1")!, score: 1 }),
  ];

  it("respecte les contraintes dures", () => {
    const t = pool[3]!;
    expect(respecteContraintes(t, { ...SANS_CONTRAINTE, duree: 100 }, profil, undefined)).toBe(false);
    expect(respecteContraintes(t, { ...SANS_CONTRAINTE, format: "serie" }, profil, undefined)).toBe(false);
    expect(respecteContraintes(t, { ...SANS_CONTRAINTE, envie: "rire" }, profil, undefined)).toBe(false);
    expect(respecteContraintes(t, { ...SANS_CONTRAINTE, envie: "frissonner" }, profil, undefined)).toBe(true);
    // Déjà vu : jamais reproposé.
    expect(respecteContraintes(pool[5]!, SANS_CONTRAINTE, profil, etats.get("al-1"))).toBe(false);
  });

  it("propose trois œuvres expliquées, dont une découverte hors des habitudes", () => {
    const props = decider(pool, profil, etats, SANS_CONTRAINTE, libelle);
    expect(props).toHaveLength(3);
    expect(props.map((p) => p.oeuvre.id)).not.toContain("al-1");
    expect(props.map((p) => p.oeuvre.id)).not.toContain("wd-horreur");
    const [premiere] = props;
    expect(["wd-pluto", "wd-psycho"]).toContain(premiere!.oeuvre.id);
    expect(premiere!.raisons.find((r) => r.type === "gouts")?.texte).toMatch(/^Vous avez aimé « Monster »/);
    const decouverte = props.find((p) => p.decouverte);
    expect(decouverte?.oeuvre.id).toBe("wd-memories");
    expect(decouverte?.raisons[0]?.texte).toBe("Hors de vos habitudes (film), mais côté thriller, comme vous aimez.");
  });

  it("cite le studio commun quand c'est la meilleure raison", () => {
    const [p] = decider([pool[1]!], profil, etats, SANS_CONTRAINTE, libelle);
    expect(p!.raisons[0]!.texte).toMatch(/même création : madhouse/);
  });

  it("ne repropose pas ce qui a déjà été montré, et explique durée et envie", () => {
    const contexte: Contexte = { duree: 60, format: "serie", envie: "frissonner", surprendre: false };
    const props = decider(pool, profil, etats, contexte, libelle, new Set(["wd-psycho"]));
    expect(props.map((p) => p.oeuvre.id)).toEqual(["wd-pluto"]);
    expect(props[0]!.raisons.map((r) => r.type)).toEqual(["gouts", "envie", "duree"]);
  });

  it("sans historique, s'appuie sur la popularité et le dit", () => {
    const vide = calculerProfil([], new Map());
    const props = decider(pool, vide, new Map(), SANS_CONTRAINTE, libelle);
    expect(props[0]!.oeuvre.id).toBe("al-1");
    expect(props.every((p) => !p.decouverte)).toBe(true);
    expect(props[0]!.raisons.map((r) => r.type)).toEqual(["populaire"]);
  });

  it("calcule une affinité bornée", () => {
    const a = affinite(pool[0]!, profil);
    expect(a.valeur).toBeGreaterThan(0);
    expect(a.valeur).toBeLessThanOrEqual(1);
    expect(affinite(pool[2]!, profil).valeur).toBeLessThan(0);
  });
});

describe("traits et candidats en base", () => {
  it("construit les traits et filtre les candidats", async () => {
    const db = await ouvrirPglite(null);
    try {
      await migrer(db);
      const { oeuvres, relations } = rapprocher([
        fiche({
          source: "anilist",
          cle: "anilist:1",
          titres: [{ valeur: "Monster", langue: "en", type: "officiel", source: "anilist" }],
          technique: "animation",
          origines: ["JP"],
          format: "serie",
          demographie: "seinen",
          duree_min: 24,
          episodes: 74,
          genres: ["thriller", "mystere"],
          themes: [{ slug: "detective", libelle_en: "Detective" }],
          credits: [{ role: "studio", nom: "Madhouse", source: "anilist" }],
        }),
        fiche({ source: "wikidata", cle: "wikidata:Q2", titres: [{ valeur: "Long film", langue: "fr", type: "officiel", source: "wikidata" }], genres: ["drame"], duree_min: 200 }),
      ]);
      await remplacerCatalogue(db, oeuvres, relations, new Map([["detective", "Detective"]]), { debut: new Date(), contenu: {} });

      const { traits, libelles } = await traitsDe(db, ["al-1"]);
      expect(traits[0]).toMatchObject({ titre: "Monster", episodes: 74, duree_min: 24 });
      expect(traits[0]!.cles.sort()).toEqual(
        ["credit:madhouse", "demo:seinen", "genre:mystere", "genre:thriller", "origine:JP", "rubrique:anime", "theme:detective"].sort(),
      );
      expect(libelles).toMatchObject({ "credit:madhouse": "Madhouse", "demo:seinen": "Seinen", "theme:detective": "Detective", "rubrique:anime": "Anime" });

      const base = { duree: null, format: null, genres: [], genresProfil: [], rubriquesDecouverte: [], exclure: [] };
      expect((await candidats(db, base)).traits).toHaveLength(2);
      expect((await candidats(db, { ...base, duree: 120 })).traits.map((t) => t.id)).toEqual(["al-1"]);
      expect((await candidats(db, { ...base, format: "film" })).traits.map((t) => t.id)).toEqual(["wd-Q2"]);
      expect((await candidats(db, { ...base, genres: ["thriller"] })).traits.map((t) => t.id)).toEqual(["al-1"]);
      expect((await candidats(db, { ...base, exclure: ["al-1"] })).traits.map((t) => t.id)).toEqual(["wd-Q2"]);
      expect((await candidats(db, { ...base, rubriquesDecouverte: ["film"], genresProfil: ["drame"] })).traits).toHaveLength(2);
    } finally {
      await db.close();
    }
  });
});
