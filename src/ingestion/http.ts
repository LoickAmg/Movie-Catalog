import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Client HTTP poli : User-Agent identifiable, délai minimal entre deux
 * appels, nouvelles tentatives sur 429/5xx, et cache disque des réponses
 * brutes pour ne pas réinterroger les sources à chaque essai.
 */
export interface OptionsClientHttp {
  userAgent: string;
  /** Délai minimal entre deux requêtes réseau, en millisecondes. */
  intervalleMs: number;
  /** Dossier du cache disque ; null pour désactiver. */
  dossierCache: string | null;
  /** Durée de validité du cache, en heures. */
  dureeCacheH?: number;
  /** Ignore le cache existant (mais le réécrit). */
  rafraichir?: boolean;
  tentatives?: number;
  journal?: (message: string) => void;
}

export interface RequeteHttp {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
}

export interface ClientHttp {
  json<T>(url: string, requete?: RequeteHttp): Promise<T>;
}

const attendre = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function creerClientHttp(options: OptionsClientHttp): ClientHttp {
  const tentatives = options.tentatives ?? 5;
  const dureeCacheMs = (options.dureeCacheH ?? 24) * 3_600_000;
  let dernierAppel = 0;

  async function lireCache(fichier: string): Promise<unknown | undefined> {
    if (options.rafraichir) return undefined;
    try {
      const infos = await stat(fichier);
      if (Date.now() - infos.mtimeMs > dureeCacheMs) return undefined;
      return JSON.parse(await readFile(fichier, "utf8"));
    } catch {
      return undefined;
    }
  }

  return {
    async json<T>(url: string, requete: RequeteHttp = {}): Promise<T> {
      const methode = requete.method ?? "GET";
      const empreinte = createHash("sha1")
        .update(`${methode} ${url}\n${requete.body ?? ""}`)
        .digest("hex");
      const fichier = options.dossierCache ? path.join(options.dossierCache, `${empreinte}.json`) : null;
      if (fichier) {
        const enCache = await lireCache(fichier);
        if (enCache !== undefined) return enCache as T;
      }

      for (let essai = 1; ; essai++) {
        const ecart = Date.now() - dernierAppel;
        if (ecart < options.intervalleMs) await attendre(options.intervalleMs - ecart);
        dernierAppel = Date.now();

        let reponse: Response;
        try {
          reponse = await fetch(url, {
            method: methode,
            body: requete.body,
            // Une requête bloquée ne doit pas figer tout l'import.
            signal: AbortSignal.timeout(90_000),
            headers: { "User-Agent": options.userAgent, Accept: "application/json", ...requete.headers },
          });
        } catch (erreur) {
          if (essai >= tentatives) throw erreur;
          options.journal?.(`réseau indisponible (${String(erreur)}), nouvel essai ${essai + 1}/${tentatives}`);
          await attendre(1000 * 2 ** essai);
          continue;
        }

        if (reponse.ok) {
          const donnees = (await reponse.json()) as T;
          if (fichier) {
            await mkdir(path.dirname(fichier), { recursive: true });
            await writeFile(fichier, JSON.stringify(donnees));
          }
          return donnees;
        }

        const reessayable = reponse.status === 429 || reponse.status >= 500;
        if (!reessayable || essai >= tentatives) {
          const extrait = (await reponse.text()).slice(0, 300);
          throw new Error(`HTTP ${reponse.status} sur ${url} : ${extrait}`);
        }
        const retryAfter = Number(reponse.headers.get("retry-after"));
        const pause = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** essai;
        options.journal?.(`HTTP ${reponse.status}, pause de ${Math.round(pause / 1000)} s`);
        await attendre(pause);
      }
    },
  };
}
