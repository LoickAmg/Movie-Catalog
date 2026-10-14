import { correspondancesParCle, correspondancesParTitre, LIMITE_CLES, LIMITE_TITRES } from "../../../catalogue/suivi.ts";
import { base } from "../../../web/serveur.ts";

export const dynamic = "force-dynamic";

const CLE = /^(anilist|mal|wikidata|tvmaze|imdb):[A-Za-z0-9]{1,20}$/;

/**
 * Retrouve les œuvres d'un historique importé. Reçoit seulement des
 * identifiants et des titres, jamais le fichier : rien n'est conservé.
 */
export async function POST(requete: Request): Promise<Response> {
  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return Response.json({ erreur: "Corps JSON attendu." }, { status: 400 });
  }
  const { cles = [], titres = [] } = (corps ?? {}) as { cles?: unknown; titres?: unknown };
  if (!Array.isArray(cles) || !Array.isArray(titres) || cles.length > LIMITE_CLES || titres.length > LIMITE_TITRES) {
    return Response.json({ erreur: `Au plus ${LIMITE_CLES} identifiants et ${LIMITE_TITRES} titres par envoi.` }, { status: 400 });
  }
  const clesValides = cles.filter((c): c is string => typeof c === "string" && CLE.test(c));
  const titresValides = titres.map((t) => {
    const { titre, annee } = (t ?? {}) as { titre?: unknown; annee?: unknown };
    return {
      titre: typeof titre === "string" ? titre.slice(0, 300) : "",
      annee: Number.isInteger(annee) && (annee as number) > 1800 && (annee as number) < 2200 ? (annee as number) : null,
    };
  });

  const db = await base();
  const [parCle, parTitre] = await Promise.all([correspondancesParCle(db, clesValides), correspondancesParTitre(db, titresValides)]);
  return Response.json({ parCle, parTitre });
}
