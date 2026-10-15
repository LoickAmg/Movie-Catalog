import { candidats } from "../../../catalogue/traits.ts";
import { GENRES } from "../../../domain/genres.ts";
import { RUBRIQUES, type Rubrique } from "../../../domain/types.ts";
import { base } from "../../../web/serveur.ts";

export const dynamic = "force-dynamic";

const ID = /^[a-z]+-[A-Za-z0-9]{1,24}$/;
const EXCLUSIONS_MAX = 5000;

const genresValides = (v: unknown) => (Array.isArray(v) ? v.filter((g): g is string => typeof g === "string" && g in GENRES).slice(0, 12) : []);

/**
 * Candidats pour « Ce soir ». Reçoit des contraintes et des genres, jamais
 * l'historique : le classement final se fait dans le navigateur.
 */
export async function POST(requete: Request): Promise<Response> {
  const c = (await requete.json().catch(() => null)) as Record<string, unknown> | null;
  if (!c) return Response.json({ erreur: "Corps JSON attendu." }, { status: 400 });
  const duree = Number.isInteger(c.duree) && (c.duree as number) > 0 && (c.duree as number) <= 1000 ? (c.duree as number) : null;
  const format = c.format === "film" || c.format === "serie" ? c.format : null;
  const exclure = Array.isArray(c.exclure) ? c.exclure.filter((id): id is string => typeof id === "string" && ID.test(id)).slice(0, EXCLUSIONS_MAX) : [];
  const rubriquesDecouverte = Array.isArray(c.rubriquesDecouverte)
    ? c.rubriquesDecouverte.filter((r): r is Rubrique => RUBRIQUES.includes(r as Rubrique))
    : [];
  return Response.json(
    await candidats(await base(), {
      duree,
      format,
      genres: genresValides(c.genres),
      genresProfil: genresValides(c.genresProfil),
      rubriquesDecouverte,
      exclure,
    }),
  );
}
