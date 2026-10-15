import { LIMITE_TRAITS, traitsDe } from "../../../catalogue/traits.ts";
import { base } from "../../../web/serveur.ts";

export const dynamic = "force-dynamic";

const ID = /^[a-z]+-[A-Za-z0-9]{1,24}$/;

/** Traits des œuvres suivies : le profil est calculé dans le navigateur, pas ici. */
export async function POST(requete: Request): Promise<Response> {
  const corps = (await requete.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = corps?.ids;
  if (!Array.isArray(ids) || ids.length > LIMITE_TRAITS) {
    return Response.json({ erreur: `Liste d'au plus ${LIMITE_TRAITS} identifiants attendue.` }, { status: 400 });
  }
  return Response.json(await traitsDe(await base(), ids.filter((id): id is string => typeof id === "string" && ID.test(id))));
}
