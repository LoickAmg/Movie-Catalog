import type { Db } from "../db/client.ts";
import type { Correspondance } from "../domain/imports.ts";
import { normaliserTitre } from "../domain/texte.ts";
import type { CarteOeuvre } from "./lecture.ts";

/** Limites des requêtes d'import, pour qu'un appel ne puisse pas saturer le serveur. */
export const LIMITE_CLES = 5000;
export const LIMITE_TITRES = 5000;
export const LIMITE_CARTES = 2000;

/**
 * Œuvre (et saison) désignée par chaque clé externe. Une clé de saison
 * (`anilist:20958`, `mal:25777`) donne la partie précise ; une clé d'œuvre,
 * l'œuvre et sa partie unique s'il n'y en a qu'une.
 */
export async function correspondancesParCle(db: Db, cles: readonly string[]): Promise<Record<string, Correspondance>> {
  const uniques = Array.from(new Set(cles)).slice(0, LIMITE_CLES);
  if (uniques.length === 0) return {};
  const resultat: Record<string, Correspondance> = {};

  const parties = await db.query<{ cle: string; oeuvre_id: string; partie: string; episodes: number | null }>(
    `SELECT DISTINCT ON (x.cle) x.cle, p.oeuvre_id, p.cle AS partie, p.episodes
     FROM unnest($1::text[]) AS x(cle) JOIN partie p ON p.identifiants @> ARRAY[x.cle]
     ORDER BY x.cle, p.ordre`,
    [uniques],
  );
  for (const r of parties.rows) resultat[r.cle] = { oeuvre: r.oeuvre_id, partie: r.partie, episodes: r.episodes };

  const restantes = uniques.filter((c) => !resultat[c]);
  if (restantes.length) {
    const oeuvres = await db.query<{ cle: string; oeuvre_id: string; partie: string | null; episodes: number | null }>(
      `SELECT x.cle, ie.oeuvre_id,
              (SELECT CASE WHEN count(*) = 1 THEN min(p.cle) END FROM partie p WHERE p.oeuvre_id = ie.oeuvre_id) AS partie,
              (SELECT CASE WHEN count(*) = 1 THEN min(p.episodes) END FROM partie p WHERE p.oeuvre_id = ie.oeuvre_id) AS episodes
       FROM unnest($1::text[]) AS x(cle)
       JOIN identifiant_externe ie ON ie.espace || ':' || ie.valeur = x.cle`,
      [restantes],
    );
    for (const r of oeuvres.rows) resultat[r.cle] = { oeuvre: r.oeuvre_id, partie: r.partie, episodes: r.episodes };
  }
  return resultat;
}

/**
 * Films désignés par titre et année (Letterboxd ne fournit pas d'identifiant).
 * Titre exact une fois normalisé, année à un an près ; à égalité, l'année
 * exacte puis la popularité l'emportent.
 */
export async function correspondancesParTitre(
  db: Db,
  titres: ReadonlyArray<{ titre: string; annee: number | null }>,
): Promise<Array<Correspondance | null>> {
  const liste = titres.slice(0, LIMITE_TITRES);
  if (liste.length === 0) return [];
  const { rows } = await db.query<{ i: number; oeuvre_id: string; partie: string | null }>(
    `SELECT DISTINCT ON (x.i) x.i::int AS i, o.id AS oeuvre_id,
            (SELECT p.cle FROM partie p WHERE p.oeuvre_id = o.id ORDER BY p.ordre LIMIT 1) AS partie
     FROM unnest($1::text[], $2::int[]) WITH ORDINALITY AS x(normalise, annee, i)
     JOIN titre t ON t.normalise = x.normalise
     JOIN oeuvre o ON o.id = t.oeuvre_id
     WHERE o.format IN ('film', 'court') AND (x.annee IS NULL OR abs(o.annee - x.annee) <= 1)
     ORDER BY x.i, (o.annee = x.annee) DESC NULLS LAST, o.score DESC`,
    [liste.map((t) => normaliserTitre(t.titre)), liste.map((t) => t.annee)],
  );
  const resultat: Array<Correspondance | null> = liste.map(() => null);
  for (const r of rows) resultat[r.i - 1] = { oeuvre: r.oeuvre_id, partie: r.partie, episodes: null };
  return resultat;
}

export interface CarteSuivi extends CarteOeuvre {
  parties: Array<{ cle: string; titre: string; episodes: number | null }>;
}

/** Cartes des œuvres de « Ma liste », avec leurs parties pour afficher la progression. */
export async function cartesSuivi(db: Db, ids: readonly string[]): Promise<CarteSuivi[]> {
  const uniques = Array.from(new Set(ids)).slice(0, LIMITE_CARTES);
  if (uniques.length === 0) return [];
  const { rows } = await db.query<CarteSuivi>(
    `SELECT o.id, o.titre_principal AS titre, o.rubrique, o.format, o.annee, o.origines, o.demographie,
       (SELECT i.url FROM image i WHERE i.oeuvre_id = o.id AND i.type = 'affiche' ORDER BY i.source LIMIT 1) AS affiche,
       (SELECT i.couleur FROM image i WHERE i.oeuvre_id = o.id AND i.couleur IS NOT NULL LIMIT 1) AS couleur,
       ARRAY[]::text[] AS genres,
       COALESCE((SELECT json_agg(json_build_object('cle', p.cle, 'titre', p.titre, 'episodes', p.episodes) ORDER BY p.ordre)
                 FROM partie p WHERE p.oeuvre_id = o.id), '[]') AS parties
     FROM oeuvre o WHERE o.id = ANY($1::text[])`,
    [uniques],
  );
  return rows;
}
