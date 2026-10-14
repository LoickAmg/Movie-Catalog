import Link from "next/link";
import { marked } from "marked";
import type { FicheSavoir } from "../../savoir/fiches.ts";
import { LIBELLES_TYPE } from "../../savoir/fiches.ts";

/** Markdown des fiches Savoir. Contenu versionné dans le dépôt et relu : pas de saisie utilisateur. */
export function Markdown({ texte, className }: { texte: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: marked.parse(texte, { async: false }) }} />;
}

/**
 * Étiquette d'une page d'œuvre. Si une fiche Savoir explique le concept,
 * l'étiquette ouvre une mini-carte (API Popover native, sans JavaScript).
 */
export function Etiquette({ libelle, fiche, forte, idUnique }: { libelle: string; fiche?: FicheSavoir; forte?: boolean; idUnique: string }) {
  const classe = `etiquette${forte ? " etiquette-forte" : ""}`;
  if (!fiche) return <span className={classe}>{libelle}</span>;
  const id = `fiche-${idUnique}`;
  return (
    <>
      <button type="button" className={classe} popoverTarget={id} aria-label={`${libelle} : qu'est-ce que c'est ?`}>
        {libelle}
      </button>
      <div id={id} popover="auto" className="mini-carte" role="dialog" aria-labelledby={`${id}-titre`}>
        <p className="surtitre">{LIBELLES_TYPE[fiche.type]}</p>
        <h3 id={`${id}-titre`}>{fiche.titre}</h3>
        <Markdown texte={fiche.carte} className="prose" />
        <div className="actions">
          <Link href={`/comprendre/${fiche.slug}`}>Lire la fiche</Link>
          <button type="button" className="bouton" popoverTarget={id} popoverTargetAction="hide">
            Fermer
          </button>
        </div>
      </div>
    </>
  );
}

export function CarteFiche({ fiche }: { fiche: FicheSavoir }) {
  return (
    <Link href={`/comprendre/${fiche.slug}`} className="fiche-carte">
      <span className="surtitre">{LIBELLES_TYPE[fiche.type]}</span>
      <h3>{fiche.titre}</h3>
      <p>{fiche.accroche}</p>
    </Link>
  );
}

export function AvertissementBrouillon({ fiche }: { fiche: FicheSavoir }) {
  if (fiche.statut === "relue") return null;
  return <p className="avertissement">Brouillon : cette fiche n'a pas encore été relue.</p>;
}
