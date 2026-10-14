import type { FicheSource } from "../src/ingestion/fiche.ts";

export const RECUPERE_LE = "2026-10-14T00:00:00.000Z";

/** Fiche minimale à compléter selon le test. */
export function fiche(partielle: Partial<FicheSource> & Pick<FicheSource, "source" | "cle">): FicheSource {
  const [espace, valeur] = partielle.cle.split(":") as [FicheSource["identifiants"][number]["espace"], string];
  return {
    identifiants: [{ espace, valeur, confiance: 1 }],
    titres: [{ valeur: "Titre", langue: "en", type: "officiel", source: partielle.source }],
    format: "film",
    technique: "prises_de_vue_reelles",
    origines: ["US"],
    public: null,
    demographie: null,
    adulte: false,
    annee: 2000,
    date_debut: "2000",
    duree_min: 100,
    episodes: null,
    genres: [],
    themes: [],
    credits: [],
    synopsis: [],
    images: [],
    popularite: 1,
    relations: [],
    recupere_le: RECUPERE_LE,
    ...partielle,
  };
}
