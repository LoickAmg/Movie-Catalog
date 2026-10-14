import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

/**
 * Accès minimal à PostgreSQL. Le reste du code ne connaît que cette
 * interface : PGlite (fichier local, sans serveur) aujourd'hui, un
 * PostgreSQL hébergé plus tard.
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<void>;
  transaction<T>(travail: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Ouvre une base PGlite dans `dossier`, ou en mémoire si `dossier` est null. */
export async function ouvrirPglite(dossier: string | null): Promise<Db> {
  const pg = dossier ? new PGlite(dossier) : new PGlite();
  await pg.waitReady;
  return {
    async query<T>(sql: string, params?: unknown[]) {
      const resultat = await pg.query<T>(sql, params);
      return { rows: resultat.rows };
    },
    async exec(sql: string) {
      await pg.exec(sql);
    },
    async transaction<T>(travail: (tx: Db) => Promise<T>) {
      return pg.transaction(async (tx) =>
        travail({
          async query<U>(sql: string, params?: unknown[]) {
            const resultat = await tx.query<U>(sql, params);
            return { rows: resultat.rows };
          },
          async exec(sql: string) {
            await tx.exec(sql);
          },
          transaction: () => Promise.reject(new Error("transactions imbriquées non prises en charge")),
          close: () => Promise.resolve(),
        }),
      );
    },
    async close() {
      await pg.close();
    },
  };
}

export async function migrer(db: Db): Promise<void> {
  const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  await db.exec(schema);
}
