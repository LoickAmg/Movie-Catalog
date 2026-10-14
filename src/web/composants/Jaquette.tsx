import type { CSSProperties } from "react";
import type { Rubrique } from "../../domain/types.ts";
import { rubriqueUI } from "../libelles.ts";

/** Teinte stable dérivée du titre : une même œuvre garde toujours la même jaquette. */
export function teinteDe(texte: string): number {
  let h = 0;
  for (const c of texte) h = (h * 31 + c.codePointAt(0)!) % 360;
  return h;
}

/**
 * Affiche de la source si elle existe, sinon jaquette typographique générée
 * (première version ; la personnalisation complète vient au lot 7).
 */
export function Jaquette(props: {
  titre: string;
  affiche: string | null;
  rubrique: Rubrique;
  annee: number | null;
  grande?: boolean;
  prioritaire?: boolean;
}) {
  if (props.affiche) {
    return (
      <div className="jaquette">
        <img
          src={props.affiche}
          alt=""
          loading={props.prioritaire ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }
  return (
    <div
      className={`jaquette jaquette-generee${props.grande ? " jaquette-grande" : ""}`}
      style={{ "--teinte": teinteDe(props.titre) } as CSSProperties}
      aria-hidden="true"
    >
      <span className="jaquette-pied">{rubriqueUI(props.rubrique).singulier}</span>
      <span className="jaquette-titre">{props.titre}</span>
      <span className="jaquette-pied">{props.annee ?? ""}</span>
    </div>
  );
}
