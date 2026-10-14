import path from "node:path";
import { cache } from "react";
import { ouvrirPglite, type Db } from "../db/client.ts";
import { chargerFiches, type FicheSavoir } from "../savoir/fiches.ts";

/**
 * Accès aux données côté serveur. Une seule connexion par processus :
 * PGlite ne peut pas ouvrir le même dossier deux fois (l'import doit donc
 * tourner serveur arrêté).
 */
const global = globalThis as typeof globalThis & { __catalogue?: Promise<Db> };

export function base(): Promise<Db> {
  global.__catalogue ??= ouvrirPglite(process.env.CATALOGUE_DB ?? path.join(process.cwd(), "data", "db"));
  return global.__catalogue;
}

/** Fiches Savoir, relues à chaque requête en développement pour voir ses modifications. */
export const fiches = cache(async (): Promise<FicheSavoir[]> => chargerFiches());
