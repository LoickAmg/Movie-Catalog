import { GENRES } from "../domain/genres.ts";
import { scorePopularite } from "../domain/popularite.ts";
import { normaliserTitre } from "../domain/texte.ts";
import { DEMOGRAPHIES, type Oeuvre, type Relation } from "../domain/types.ts";
import type { Db } from "./client.ts";

/** `espace:valeur` → identifiant de l'œuvre en base, pour garder des identifiants stables. */
export async function chargerCorrespondances(db: Db): Promise<Map<string, string>> {
  const { rows } = await db.query<{ espace: string; valeur: string; oeuvre_id: string }>(
    "SELECT espace, valeur, oeuvre_id FROM identifiant_externe",
  );
  return new Map(rows.map((r) => [`${r.espace}:${r.valeur}`, r.oeuvre_id]));
}

export async function compterOeuvres(db: Db): Promise<number> {
  const { rows } = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM oeuvre");
  return rows[0]?.n ?? 0;
}

const TAILLE_LOT = 2000;

/** Insère un tableau d'objets dans une table, par lots, via jsonb_to_recordset. */
async function inserer(db: Db, table: string, colonnes: Record<string, string>, lignes: object[]): Promise<void> {
  const noms = Object.keys(colonnes);
  const definition = noms.map((n) => `${n} ${colonnes[n]}`).join(", ");
  for (let i = 0; i < lignes.length; i += TAILLE_LOT) {
    await db.query(
      `INSERT INTO ${table} (${noms.join(", ")})
       SELECT ${noms.join(", ")} FROM jsonb_to_recordset($1::jsonb) AS x(${definition})`,
      [JSON.stringify(lignes.slice(i, i + TAILLE_LOT))],
    );
  }
}

/**
 * Remplace tout le catalogue par le résultat d'un import, en une seule
 * transaction : en cas d'erreur, la base reste dans son état précédent.
 */
export async function remplacerCatalogue(
  db: Db,
  oeuvres: readonly Oeuvre[],
  relations: readonly Relation[],
  themes: ReadonlyMap<string, string>,
  rapport: { debut: Date; contenu: unknown },
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.exec(`TRUNCATE oeuvre, titre, partie, identifiant_externe, oeuvre_concept, credit, relation, synopsis, image, concept`);

    const concepts = [
      ...Object.entries(GENRES).map(([slug, libelle]) => ({ slug, type: "genre", libelle_fr: libelle, libelle_en: null })),
      ...DEMOGRAPHIES.map((slug) => ({ slug: `demographie_${slug}`, type: "demographie", libelle_fr: null, libelle_en: slug })),
      ...[...themes].map(([slug, libelle_en]) => ({ slug: `theme_${slug}`, type: "theme", libelle_fr: null, libelle_en })),
    ];
    await inserer(tx, "concept", { slug: "text", type: "text", libelle_fr: "text", libelle_en: "text" }, concepts);

    await inserer(
      tx,
      "oeuvre",
      {
        id: "text",
        titre_principal: "text",
        rubrique: "text",
        format: "text",
        technique: "text",
        origines: "text[]",
        public: "text",
        demographie: "text",
        adulte: "boolean",
        annee: "integer",
        duree_min: "integer",
        popularite: "jsonb",
        score: "real",
        provenance: "jsonb",
      },
      oeuvres.map((o) => ({
        id: o.id,
        titre_principal: o.titre_principal,
        rubrique: o.rubrique,
        format: o.format,
        technique: o.technique,
        origines: o.origines,
        public: o.public,
        demographie: o.demographie,
        adulte: o.adulte,
        annee: o.annee,
        duree_min: o.duree_min,
        popularite: o.popularite,
        score: scorePopularite(o.popularite),
        provenance: o.provenance,
      })),
    );

    await inserer(
      tx,
      "titre",
      { oeuvre_id: "text", valeur: "text", normalise: "text", langue: "text", type: "text", source: "text" },
      oeuvres.flatMap((o) => o.titres.map((t) => ({ oeuvre_id: o.id, ...t, normalise: normaliserTitre(t.valeur) }))),
    );
    await inserer(
      tx,
      "partie",
      {
        cle: "text",
        oeuvre_id: "text",
        ordre: "integer",
        titre: "text",
        format: "text",
        annee: "integer",
        episodes: "integer",
        duree_min: "integer",
        source: "text",
      },
      oeuvres.flatMap((o) => o.parties.map((p) => ({ ...p, oeuvre_id: o.id }))),
    );
    await inserer(
      tx,
      "identifiant_externe",
      { espace: "text", valeur: "text", oeuvre_id: "text", confiance: "real" },
      oeuvres.flatMap((o) => o.identifiants.map((i) => ({ ...i, oeuvre_id: o.id }))),
    );
    await inserer(
      tx,
      "oeuvre_concept",
      { oeuvre_id: "text", concept_slug: "text" },
      oeuvres.flatMap((o) => {
        const slugs = [
          ...o.genres,
          ...o.themes.map((t) => `theme_${t}`),
          ...(o.demographie ? [`demographie_${o.demographie}`] : []),
        ];
        return Array.from(new Set(slugs)).map((concept_slug) => ({ oeuvre_id: o.id, concept_slug }));
      }),
    );
    await inserer(
      tx,
      "credit",
      { oeuvre_id: "text", role: "text", nom: "text", source: "text", ordre: "integer" },
      oeuvres.flatMap((o) => o.credits.map((c, ordre) => ({ ...c, oeuvre_id: o.id, ordre }))),
    );
    await inserer(tx, "relation", { de: "text", vers: "text", type: "text", source: "text" }, [...relations]);
    await inserer(
      tx,
      "synopsis",
      { oeuvre_id: "text", langue: "text", texte: "text", source: "text" },
      oeuvres.flatMap((o) => o.synopsis.map((s) => ({ ...s, oeuvre_id: o.id }))),
    );
    await inserer(
      tx,
      "image",
      { oeuvre_id: "text", type: "text", url: "text", couleur: "text", source: "text" },
      oeuvres.flatMap((o) => o.images.map((i) => ({ ...i, oeuvre_id: o.id }))),
    );

    await tx.query("INSERT INTO import_catalogue (debut, fin, total, rapport) VALUES ($1, now(), $2, $3::jsonb)", [
      rapport.debut.toISOString(),
      oeuvres.length,
      JSON.stringify(rapport.contenu),
    ]);
  });
}
