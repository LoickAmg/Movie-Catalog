import { cartesSuivi, LIMITE_CARTES } from "../../../catalogue/suivi.ts";
import { base } from "../../../web/serveur.ts";

export const dynamic = "force-dynamic";

/** Cartes des œuvres suivies, pour « Ma liste » (le suivi lui-même reste dans le navigateur). */
export async function POST(requete: Request): Promise<Response> {
  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return Response.json({ erreur: "Corps JSON attendu." }, { status: 400 });
  }
  const ids = (corps as { ids?: unknown } | null)?.ids;
  if (!Array.isArray(ids) || ids.length > LIMITE_CARTES) {
    return Response.json({ erreur: `Liste d'au plus ${LIMITE_CARTES} identifiants attendue.` }, { status: 400 });
  }
  const valides = ids.filter((id): id is string => typeof id === "string" && /^[a-z]+-[A-Za-z0-9]{1,24}$/.test(id));
  return Response.json({ cartes: await cartesSuivi(await base(), valides) });
}
