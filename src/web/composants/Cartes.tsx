import Link from "next/link";
import type { CarteOeuvre } from "../../catalogue/lecture.ts";
import { badgeAnime } from "../../domain/classification.ts";
import { BADGES_UI, nomPays, rubriqueUI } from "../libelles.ts";
import { Jaquette } from "./Jaquette.tsx";

function meta(carte: CarteOeuvre): string {
  const badge = badgeAnime(carte.origines);
  const origine = carte.rubrique === "anime" && badge ? BADGES_UI[badge] : carte.origines[0] ? nomPays(carte.origines[0]) : null;
  return [rubriqueUI(carte.rubrique).singulier, carte.annee, origine].filter(Boolean).join(" · ");
}

export function Carte({ carte, prioritaire }: { carte: CarteOeuvre; prioritaire?: boolean }) {
  return (
    <Link href={`/oeuvre/${carte.id}`} className="carte">
      <Jaquette titre={carte.titre} affiche={carte.affiche} rubrique={carte.rubrique} annee={carte.annee} prioritaire={prioritaire} />
      <span className="carte-titre">{carte.titre}</span>
      <span className="carte-meta">{meta(carte)}</span>
    </Link>
  );
}

export function Grille({ cartes }: { cartes: CarteOeuvre[] }) {
  if (cartes.length === 0) return <p className="vide">Aucune œuvre ne correspond.</p>;
  return (
    <div className="grille">
      {cartes.map((c, i) => (
        <Carte key={c.id} carte={c} prioritaire={i < 6} />
      ))}
    </div>
  );
}

export function Rangee({ cartes, titre }: { cartes: CarteOeuvre[]; titre: string }) {
  return (
    <div className="rangee" role="list" aria-label={titre}>
      {cartes.map((c) => (
        <div role="listitem" key={c.id}>
          <Carte carte={c} />
        </div>
      ))}
    </div>
  );
}

/** Pagination par liens : fonctionne sans JavaScript. */
export function Pagination({ page, total, parPage, lien }: { page: number; total: number; parPage: number; lien: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / parPage));
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <Link className="bouton" href={lien(page - 1)} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined}>
        Précédent
      </Link>
      <span className="discret">
        Page {page} sur {pages}
      </span>
      <Link className="bouton" href={lien(page + 1)} aria-disabled={page >= pages} tabIndex={page >= pages ? -1 : undefined}>
        Suivant
      </Link>
    </nav>
  );
}
