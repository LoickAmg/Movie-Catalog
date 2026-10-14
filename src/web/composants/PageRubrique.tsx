import Link from "next/link";
import { genresDeRubrique, listerRubrique, originesDeRubrique, TAILLE_PAGE, type Tri } from "../../catalogue/lecture.ts";
import type { Rubrique } from "../../domain/types.ts";
import { ficheDuConcept } from "../../savoir/fiches.ts";
import { base, fiches } from "../serveur.ts";
import { BADGES_UI, nomPays, rubriqueUI } from "../libelles.ts";
import { badgeAnime } from "../../domain/classification.ts";
import { Grille, Pagination } from "./Cartes.tsx";

export type ParamsRubrique = { genre?: string; decennie?: string; origine?: string; tri?: string; page?: string };

const TRIS: Array<{ valeur: Tri; libelle: string }> = [
  { valeur: "populaire", libelle: "Les plus populaires" },
  { valeur: "recent", libelle: "Les plus récents" },
  { valeur: "ancien", libelle: "Les plus anciens" },
  { valeur: "titre", libelle: "Par titre" },
];

const DECENNIES = Array.from({ length: 11 }, (_, i) => 2020 - i * 10);

export async function PageRubrique({ rubrique, params }: { rubrique: Rubrique; params: ParamsRubrique }) {
  const ui = rubriqueUI(rubrique);
  const db = await base();
  const [genres, origines, toutesFiches] = await Promise.all([genresDeRubrique(db, rubrique), originesDeRubrique(db, rubrique), fiches()]);

  const genre = genres.some((g) => g.slug === params.genre) ? params.genre! : null;
  const origine = origines.some((o) => o.pays === params.origine) ? params.origine! : null;
  const decennie = DECENNIES.includes(Number(params.decennie)) ? Number(params.decennie) : null;
  const tri = TRIS.some((t) => t.valeur === params.tri) ? (params.tri as Tri) : "populaire";
  const page = Math.max(1, Number(params.page) || 1);
  const resultat = await listerRubrique(db, { rubrique, genre, origine, decennie, tri, page });

  const lien = (p: number) => {
    const u = new URLSearchParams();
    if (genre) u.set("genre", genre);
    if (origine) u.set("origine", origine);
    if (decennie) u.set("decennie", String(decennie));
    if (tri !== "populaire") u.set("tri", tri);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return s ? `${ui.chemin}?${s}` : ui.chemin;
  };
  const ficheRubrique = ficheDuConcept(toutesFiches, `rubrique_${rubrique}`);
  const libelleOrigine = (pays: string) => {
    const badge = rubrique === "anime" ? badgeAnime([pays]) : null;
    if (!badge || BADGES_UI[badge] === nomPays(pays)) return nomPays(pays);
    return `${BADGES_UI[badge]} (${nomPays(pays)})`;
  };

  return (
    <section className="section">
      <p className="surtitre">{ui.accroche}</p>
      <h1>{ui.libelle}</h1>
      {ficheRubrique && (
        <p className="discret">
          Qu'est-ce qui range une œuvre ici ? <Link href={`/comprendre/${ficheRubrique.slug}`}>{ficheRubrique.titre}</Link>
        </p>
      )}

      <form className="filtres" action={ui.chemin}>
        <label>
          Genre
          <select name="genre" defaultValue={genre ?? ""}>
            <option value="">Tous</option>
            {genres.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.libelle} ({g.nombre})
              </option>
            ))}
          </select>
        </label>
        <label>
          Origine
          <select name="origine" defaultValue={origine ?? ""}>
            <option value="">Toutes</option>
            {origines.map((o) => (
              <option key={o.pays} value={o.pays}>
                {libelleOrigine(o.pays)} ({o.nombre})
              </option>
            ))}
          </select>
        </label>
        <label>
          Décennie
          <select name="decennie" defaultValue={decennie ?? ""}>
            <option value="">Toutes</option>
            {DECENNIES.map((d) => (
              <option key={d} value={d}>
                Années {d}
              </option>
            ))}
          </select>
        </label>
        <label>
          Trier
          <select name="tri" defaultValue={tri}>
            {TRIS.map((t) => (
              <option key={t.valeur} value={t.valeur}>
                {t.libelle}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="bouton bouton-principal">
          Filtrer
        </button>
      </form>

      <p className="discret" aria-live="polite">
        {resultat.total.toLocaleString("fr-FR")} œuvre{resultat.total > 1 ? "s" : ""}
      </p>
      <Grille cartes={resultat.resultats} />
      <Pagination page={page} total={resultat.total} parPage={TAILLE_PAGE} lien={lien} />
    </section>
  );
}
