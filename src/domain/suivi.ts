/**
 * Suivi personnel (lot 3). Ce que fait l'utilisateur est enregistré comme un
 * journal d'actions qu'on n'efface jamais ; son état (statut, avis,
 * progression) en est déduit. On peut ainsi rejouer, exporter, importer et
 * fusionner sans perte.
 */

export const STATUTS = ["en_cours", "termine", "en_pause", "abandonne", "prevu", "revisionnage"] as const;
export type Statut = (typeof STATUTS)[number];

export const AVIS = ["jaime", "pas_pour_moi"] as const;
export type Avis = (typeof AVIS)[number];

/** D'où vient une action : l'utilisateur lui-même, ou un import. */
export type Origine = "manuel" | "import:anilist" | "import:mal" | "import:letterboxd" | "restauration";

interface Base {
  id: string;
  oeuvre: string;
  /** Date ISO 8601 de l'action (pour un import : date d'origine si connue). */
  date: string;
  origine: Origine;
}

/** Correction du profil de goûts, trait par trait (lot 4). */
export type ValeurReglage = "plus" | "moins" | "jamais";

export type Evenement =
  | (Omit<Base, "oeuvre"> & { type: "reglage"; oeuvre?: undefined; trait: string; reglage: ValeurReglage | null })
  | (Base & { type: "statut"; statut: Statut })
  | (Base & { type: "avis"; avis: Avis | null })
  | (Base & { type: "progression"; partie: string; episode: number })
  | (Base & { type: "retrait" });

export interface EtatSuivi {
  oeuvre: string;
  statut: Statut | null;
  avis: Avis | null;
  /** Dernier épisode vu, par partie (clé `anilist:16498`, `wikidata:Q1`…). */
  progression: Record<string, number>;
  maj_le: string;
  commence_le: string | null;
  termine_le: string | null;
}

/** Ordre de lecture : chronologique ; à date égale, l'ordre d'enregistrement. */
function chronologique(evenements: readonly Evenement[]): Evenement[] {
  return evenements.map((e, i) => [e, i] as const).sort((a, b) => a[0].date.localeCompare(b[0].date) || a[1] - b[1]).map(([e]) => e);
}

export function etatsDepuis(evenements: readonly Evenement[]): Map<string, EtatSuivi> {
  const etats = new Map<string, EtatSuivi>();
  for (const e of chronologique(evenements)) {
    if (e.type === "reglage") continue;
    if (e.type === "retrait") {
      etats.delete(e.oeuvre);
      continue;
    }
    const etat = etats.get(e.oeuvre) ?? {
      oeuvre: e.oeuvre,
      statut: null,
      avis: null,
      progression: {},
      maj_le: e.date,
      commence_le: null,
      termine_le: null,
    };
    etat.maj_le = e.date;
    switch (e.type) {
      case "statut":
        etat.statut = e.statut;
        if ((e.statut === "en_cours" || e.statut === "revisionnage") && !etat.commence_le) etat.commence_le = e.date;
        if (e.statut === "termine") etat.termine_le = e.date;
        break;
      case "avis":
        etat.avis = e.avis;
        break;
      case "progression":
        etat.progression = { ...etat.progression, [e.partie]: e.episode };
        // Noter un épisode, c'est avoir commencé.
        if (etat.statut === null || etat.statut === "prevu") {
          etat.statut = "en_cours";
          etat.commence_le ??= e.date;
        }
        break;
    }
    etats.set(e.oeuvre, etat);
  }
  return etats;
}

/** Fabrique d'actions : l'identifiant et l'horloge sont injectés (tests, imports). */
export function creerEvenement<T extends Evenement["type"]>(
  type: T,
  champs: Omit<Extract<Evenement, { type: T }>, "id" | "type" | "date" | "origine"> & { date?: string; origine?: Origine },
  outils: { id: () => string; maintenant: () => string } = { id: () => crypto.randomUUID(), maintenant: () => new Date().toISOString() },
): Extract<Evenement, { type: T }> {
  const { date, origine, ...reste } = champs;
  return { ...reste, id: outils.id(), type, date: date ?? outils.maintenant(), origine: origine ?? "manuel" } as Extract<Evenement, { type: T }>;
}

const DATE_ISO = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/;
const ORIGINES: readonly Origine[] = ["manuel", "import:anilist", "import:mal", "import:letterboxd", "restauration"];

/**
 * Valide un journal venu de l'extérieur (fichier de sauvegarde, ancien
 * stockage) ; écarte les lignes invalides au lieu de tout refuser.
 */
export function validerJournal(donnees: unknown): { evenements: Evenement[]; rejetes: number } {
  if (!Array.isArray(donnees)) return { evenements: [], rejetes: 0 };
  const evenements: Evenement[] = [];
  let rejetes = 0;
  const ids = new Set<string>();
  for (const brut of donnees) {
    const e = brut as Partial<Evenement> & Record<string, unknown>;
    const commun =
      e && typeof e.id === "string" && !ids.has(e.id) && typeof e.date === "string" && DATE_ISO.test(e.date) && ORIGINES.includes(e.origine as Origine);
    const reglage =
      commun &&
      e.type === "reglage" &&
      typeof e.trait === "string" &&
      /^(genre|theme|demo|rubrique|origine|credit):[\p{L}\p{N}_-]{1,60}$/u.test(e.trait) &&
      (e.reglage === null || ["plus", "moins", "jamais"].includes(e.reglage as string));
    const base = commun && typeof e.oeuvre === "string" && /^[a-z]+-[A-Za-z0-9]+$/.test(e.oeuvre);
    const valide =
      reglage ||
      (base &&
      ((e.type === "statut" && STATUTS.includes(e.statut as Statut)) ||
        (e.type === "avis" && (e.avis === null || AVIS.includes(e.avis as Avis))) ||
        (e.type === "progression" &&
          typeof e.partie === "string" &&
          Number.isInteger(e.episode) &&
          (e.episode as number) >= 0 &&
          (e.episode as number) < 100_000) ||
        e.type === "retrait"));
    if (!valide) {
      rejetes++;
      continue;
    }
    ids.add(e.id as string);
    evenements.push(e as Evenement);
  }
  return { evenements, rejetes };
}

/** Dernier réglage de chaque trait (un réglage `null` annule le précédent). */
export function reglagesDepuis(evenements: readonly Evenement[]): Map<string, ValeurReglage> {
  const reglages = new Map<string, ValeurReglage>();
  for (const e of chronologique(evenements)) {
    if (e.type !== "reglage") continue;
    if (e.reglage) reglages.set(e.trait, e.reglage);
    else reglages.delete(e.trait);
  }
  return reglages;
}

/** Fusionne deux journaux sans doublon (même identifiant = même action). */
export function fusionnerJournaux(a: readonly Evenement[], b: readonly Evenement[]): Evenement[] {
  const vus = new Set(a.map((e) => e.id));
  return [...a, ...b.filter((e) => !vus.has(e.id))];
}

export function compterParStatut(etats: Iterable<EtatSuivi>): Record<Statut, number> & { jaime: number } {
  const comptes = { ...Object.fromEntries(STATUTS.map((s) => [s, 0])), jaime: 0 } as Record<Statut, number> & { jaime: number };
  for (const etat of etats) {
    if (etat.statut) comptes[etat.statut]++;
    if (etat.avis === "jaime") comptes.jaime++;
  }
  return comptes;
}
