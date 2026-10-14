import type { Avis, Evenement, Statut } from "../../domain/suivi.ts";

export const STATUTS_UI: Array<{ statut: Statut; libelle: string; court: string }> = [
  { statut: "prevu", libelle: "À voir", court: "À voir" },
  { statut: "en_cours", libelle: "En cours", court: "En cours" },
  { statut: "termine", libelle: "Terminé", court: "Vu" },
  { statut: "en_pause", libelle: "En pause", court: "Pause" },
  { statut: "abandonne", libelle: "Abandonné", court: "Abandonné" },
  { statut: "revisionnage", libelle: "Je revois", court: "Je revois" },
];

export function libelleStatut(statut: Statut, film = false): string {
  if (statut === "termine" && film) return "Vu";
  return STATUTS_UI.find((s) => s.statut === statut)!.libelle;
}

export const AVIS_UI: Record<Avis, string> = { jaime: "J'aime", pas_pour_moi: "Pas pour moi" };

const ORIGINES_UI: Record<Evenement["origine"], string> = {
  manuel: "",
  "import:anilist": " (import AniList)",
  "import:mal": " (import MyAnimeList)",
  "import:letterboxd": " (import Letterboxd)",
  restauration: " (restauration)",
};

/** Phrase lisible pour l'historique : « Statut : En cours », « Épisode 5 »… */
export function decrire(e: Evenement): string {
  const suffixe = ORIGINES_UI[e.origine];
  switch (e.type) {
    case "statut":
      return `Statut : ${libelleStatut(e.statut)}${suffixe}`;
    case "avis":
      return `${e.avis ? AVIS_UI[e.avis] : "Avis retiré"}${suffixe}`;
    case "progression":
      return `Épisode ${e.episode}${suffixe}`;
    case "retrait":
      return `Retiré de la liste${suffixe}`;
  }
}
