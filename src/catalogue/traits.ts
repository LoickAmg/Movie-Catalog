import type { Db } from "../db/client.ts";
import { GENRES, type Genre } from "../domain/genres.ts";
import { slugifier } from "../domain/texte.ts";
import type { Traits } from "../domain/traits.ts";
import type { Demographie, Format, Rubrique } from "../domain/types.ts";
import { DEMOGRAPHIES_UI, nomPays, RUBRIQUES_UI } from "../web/libelles.ts";

/** Lecture des traits d'œuvres pour le profil et « Ce soir ». */

export const LIMITE_TRAITS = 2000;

interface Ligne {
  id: string;
  titre: string;
  rubrique: Rubrique;
  format: Format;
  annee: number | null;
  duree_min: number | null;
  origines: string[];
  demographie: Demographie | null;
  score: number;
  affiche: string | null;
  couleur: string | null;
  episodes: number | null;
  concepts: string[];
  credits: string[];
}

const SELECTION = `
  o.id, o.titre_principal AS titre, o.rubrique, o.format, o.annee, o.duree_min, o.origines, o.demographie, o.score,
  (SELECT i.url FROM image i WHERE i.oeuvre_id = o.id AND i.type = 'affiche' ORDER BY i.source LIMIT 1) AS affiche,
  (SELECT i.couleur FROM image i WHERE i.oeuvre_id = o.id AND i.couleur IS NOT NULL LIMIT 1) AS couleur,
  (SELECT sum(p.episodes)::int FROM partie p WHERE p.oeuvre_id = o.id) AS episodes,
  ARRAY(SELECT oc.concept_slug FROM oeuvre_concept oc WHERE oc.oeuvre_id = o.id) AS concepts,
  ARRAY(SELECT c.nom FROM credit c WHERE c.oeuvre_id = o.id ORDER BY c.ordre LIMIT 4) AS credits`;

export interface TraitsEtLibelles {
  traits: Traits[];
  /** Libellé lisible de chaque clé de trait rencontrée. */
  libelles: Record<string, string>;
}

async function versTraits(db: Db, lignes: Ligne[]): Promise<TraitsEtLibelles> {
  const libelles: Record<string, string> = {};
  const themes = new Set<string>();
  const traits = lignes.map((l) => {
    const cles: string[] = [`rubrique:${l.rubrique}`];
    libelles[`rubrique:${l.rubrique}`] = RUBRIQUES_UI.find((r) => r.rubrique === l.rubrique)!.libelle;
    if (l.origines[0]) {
      cles.push(`origine:${l.origines[0]}`);
      libelles[`origine:${l.origines[0]}`] = nomPays(l.origines[0]);
    }
    for (const concept of l.concepts) {
      if (concept.startsWith("theme_")) {
        cles.push(`theme:${concept.slice(6)}`);
        themes.add(concept);
      } else if (concept.startsWith("demographie_")) {
        const d = concept.slice(12) as Demographie;
        cles.push(`demo:${d}`);
        libelles[`demo:${d}`] = DEMOGRAPHIES_UI[d];
      } else if (concept in GENRES) {
        cles.push(`genre:${concept}`);
        libelles[`genre:${concept}`] = GENRES[concept as Genre];
      }
    }
    for (const nom of l.credits) {
      const cle = `credit:${slugifier(nom)}`;
      if (cle.length > 7 && !cles.includes(cle)) {
        cles.push(cle);
        libelles[cle] = nom;
      }
    }
    const { concepts: _c, credits: _cr, ...reste } = l;
    return { ...reste, score: Number(l.score), cles };
  });
  if (themes.size) {
    const { rows } = await db.query<{ slug: string; libelle: string }>(
      "SELECT slug, COALESCE(libelle_fr, libelle_en) AS libelle FROM concept WHERE slug = ANY($1::text[])",
      [[...themes]],
    );
    for (const r of rows) libelles[`theme:${r.slug.slice(6)}`] = r.libelle;
  }
  return { traits, libelles };
}

export async function traitsDe(db: Db, ids: readonly string[]): Promise<TraitsEtLibelles> {
  const uniques = Array.from(new Set(ids)).slice(0, LIMITE_TRAITS);
  if (uniques.length === 0) return { traits: [], libelles: {} };
  const { rows } = await db.query<Ligne>(`SELECT ${SELECTION} FROM oeuvre o WHERE o.id = ANY($1::text[])`, [uniques]);
  return versTraits(db, rows);
}

export interface DemandeCandidats {
  duree: number | null;
  format: "film" | "serie" | null;
  /** Genres de l'envie du moment : au moins un est requis. */
  genres: string[];
  /** Genres préférés du profil, pour aller chercher au-delà des plus populaires. */
  genresProfil: string[];
  /** Rubriques peu fréquentées, pour la place « découverte ». */
  rubriquesDecouverte: Rubrique[];
  exclure: string[];
}

const TAILLE_POOL = 250;
const TAILLE_DECOUVERTE = 120;

/**
 * Candidats respectant les contraintes dures, en trois viviers : les plus
 * suivis, les plus proches des goûts, et des univers peu fréquentés.
 */
export async function candidats(db: Db, d: DemandeCandidats): Promise<TraitsEtLibelles> {
  const filtres = `
    NOT o.adulte
    AND o.id <> ALL($1::text[])
    AND ($2::int IS NULL OR (o.duree_min IS NOT NULL AND o.duree_min <= $2))
    AND ($3::text IS NULL OR ($3 = 'film') = (o.format IN ('film', 'court')))
    AND (cardinality($4::text[]) = 0 OR EXISTS (SELECT 1 FROM oeuvre_concept oc WHERE oc.oeuvre_id = o.id AND oc.concept_slug = ANY($4::text[])))`;
  const params = [d.exclure, d.duree, d.format, d.genres];
  const viviers = await Promise.all([
    db.query<{ id: string }>(`SELECT o.id FROM oeuvre o WHERE ${filtres} ORDER BY o.score DESC LIMIT ${TAILLE_POOL}`, params),
    d.genresProfil.length
      ? db.query<{ id: string }>(
          `SELECT o.id FROM oeuvre o WHERE ${filtres}
           ORDER BY (SELECT count(*) FROM oeuvre_concept oc WHERE oc.oeuvre_id = o.id AND oc.concept_slug = ANY($5::text[])) DESC, o.score DESC
           LIMIT ${TAILLE_POOL}`,
          [...params, d.genresProfil],
        )
      : Promise.resolve({ rows: [] }),
    d.rubriquesDecouverte.length
      ? db.query<{ id: string }>(
          `SELECT o.id FROM oeuvre o WHERE ${filtres} AND o.rubrique = ANY($5::text[]) ORDER BY o.score DESC LIMIT ${TAILLE_DECOUVERTE}`,
          [...params, d.rubriquesDecouverte],
        )
      : Promise.resolve({ rows: [] }),
  ]);
  const ids = Array.from(new Set(viviers.flatMap((v) => v.rows.map((r) => r.id))));
  return traitsDe(db, ids);
}
