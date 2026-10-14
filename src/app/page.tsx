import Link from "next/link";
import { populaires, statistiques } from "../catalogue/lecture.ts";
import { Rangee } from "../web/composants/Cartes.tsx";
import { CarteFiche } from "../web/composants/Savoir.tsx";
import { RUBRIQUES_UI } from "../web/libelles.ts";
import { base, fiches } from "../web/serveur.ts";

export const dynamic = "force-dynamic";

const FICHES_ACCUEIL = ["debuter-anime", "demographies", "anime-ou-dessin-anime", "fantasy-ou-fantastique"];

export default async function Accueil() {
  const db = await base();
  const [stats, rangees, toutesFiches] = await Promise.all([
    statistiques(db),
    Promise.all(RUBRIQUES_UI.map(async (r) => ({ ...r, cartes: await populaires(db, r.rubrique, 12) }))),
    fiches(),
  ]);
  const enAvant = FICHES_ACCUEIL.map((slug) => toutesFiches.find((f) => f.slug === slug)).filter((f) => f !== undefined);

  return (
    <>
      <section className="accueil-hero">
        <p className="surtitre">Films · séries · anime · dessins animés</p>
        <h1>
          Que regarder <em>ce soir</em> ?
        </h1>
        <p className="intro">
          Un guide pour tout le monde : les fans d'anime, les cinéphiles, et ceux qui veulent simplement découvrir. Cherchez une œuvre, explorez
          une rubrique, ou commencez par comprendre.
        </p>
        <form action="/recherche" role="search" className="recherche-grande">
          <label htmlFor="recherche-accueil" className="sr-only">
            Rechercher une œuvre
          </label>
          <input
            id="recherche-accueil"
            name="q"
            type="search"
            className="champ-recherche"
            placeholder="L'Attaque des Titans, Parasite, Arcane…"
            autoComplete="off"
          />
        </form>
        <p className="bientot">Bientôt : trois propositions pour ce soir, choisies selon vos envies, avec la raison de chaque choix.</p>
      </section>

      <nav className="tuiles" aria-label="Rubriques">
        {RUBRIQUES_UI.map((r) => (
          <Link key={r.rubrique} href={r.chemin} className="tuile">
            <span className="nombre">{stats[r.rubrique].toLocaleString("fr-FR")}</span>
            <strong>{r.libelle}</strong>
            <span>{r.accroche}</span>
          </Link>
        ))}
      </nav>

      {rangees.map((r) => (
        <section key={r.rubrique} className="section" aria-labelledby={`rangee-${r.rubrique}`}>
          <div className="section-tete">
            <h2 id={`rangee-${r.rubrique}`}>{r.libelle} populaires</h2>
            <Link href={r.chemin}>Tout voir</Link>
          </div>
          <Rangee cartes={r.cartes} titre={`${r.libelle} populaires`} />
        </section>
      ))}

      <section className="section" aria-labelledby="comprendre">
        <div className="section-tete">
          <h2 id="comprendre">Comprendre</h2>
          <Link href="/comprendre">Toutes les fiches</Link>
        </div>
        <div className="fiches">
          {enAvant.map((f) => (
            <CarteFiche key={f.slug} fiche={f} />
          ))}
        </div>
      </section>
    </>
  );
}
