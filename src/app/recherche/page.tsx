import type { Metadata } from "next";
import Link from "next/link";
import { rechercher, TAILLE_PAGE } from "../../catalogue/lecture.ts";
import type { Rubrique } from "../../domain/types.ts";
import { Grille, Pagination } from "../../web/composants/Cartes.tsx";
import { RUBRIQUES_UI } from "../../web/libelles.ts";
import { base } from "../../web/serveur.ts";

export const dynamic = "force-dynamic";

type Params = { q?: string; rubrique?: string; page?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `Recherche « ${q} »` : "Recherche", robots: { index: false } };
}

export default async function Recherche({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 120);
  const rubrique = RUBRIQUES_UI.find((r) => r.rubrique === params.rubrique)?.rubrique ?? null;
  const page = Math.max(1, Number(params.page) || 1);
  const resultat = q ? await rechercher(await base(), { texte: q, rubrique, page }) : { total: 0, resultats: [] };

  const lien = (changements: { rubrique?: Rubrique | null; page?: number }) => {
    const u = new URLSearchParams({ q });
    const r = changements.rubrique === undefined ? rubrique : changements.rubrique;
    if (r) u.set("rubrique", r);
    if (changements.page && changements.page > 1) u.set("page", String(changements.page));
    return `/recherche?${u}`;
  };

  return (
    <section className="section">
      <p className="surtitre">Recherche</p>
      <h1>{q ? `« ${q} »` : "Rechercher"}</h1>
      <form action="/recherche" role="search" className="recherche-grande" style={{ marginBlock: "16px 20px" }}>
        <label htmlFor="recherche-page" className="sr-only">
          Rechercher une œuvre
        </label>
        <input id="recherche-page" name="q" type="search" defaultValue={q} className="champ-recherche" placeholder="Titre original, français, romaji…" />
        {rubrique && <input type="hidden" name="rubrique" value={rubrique} />}
      </form>
      {q && (
        <>
          <nav className="etiquettes" aria-label="Filtrer par rubrique">
            <Link href={lien({ rubrique: null })} className={`etiquette${rubrique ? "" : " etiquette-forte"}`}>
              Tout
            </Link>
            {RUBRIQUES_UI.map((r) => (
              <Link key={r.rubrique} href={lien({ rubrique: r.rubrique })} className={`etiquette${rubrique === r.rubrique ? " etiquette-forte" : ""}`}>
                {r.libelle}
              </Link>
            ))}
          </nav>
          <p className="discret" aria-live="polite">
            {resultat.total.toLocaleString("fr-FR")} résultat{resultat.total > 1 ? "s" : ""}
          </p>
          <Grille cartes={resultat.resultats} />
          <Pagination page={page} total={resultat.total} parPage={TAILLE_PAGE} lien={(p) => lien({ page: p })} />
        </>
      )}
    </section>
  );
}
