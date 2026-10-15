"use client";

import { creerEvenement } from "../../domain/suivi.ts";
import { ajouter, useJournal } from "../suivi/journal.ts";

/** Avancement d'un parcours d'initiation, d'après « Ma liste ». */
export function ParcoursSuivi({ oeuvres }: { oeuvres: string[] }) {
  const { etats } = useJournal();
  const vues = oeuvres.filter((id) => etats.get(id)?.statut === "termine" || etats.get(id)?.statut === "revisionnage").length;
  const absentes = oeuvres.filter((id) => !etats.get(id)?.statut);
  const prochaine = oeuvres.find((id) => {
    const s = etats.get(id)?.statut;
    return s !== "termine" && s !== "revisionnage" && s !== "abandonne";
  });

  return (
    <div className="encadre parcours-suivi">
      <div className="gout-tete">
        <strong>
          {vues} / {oeuvres.length} vue{vues > 1 ? "s" : ""}
        </strong>
        {vues === oeuvres.length && oeuvres.length > 0 && <span className="discret">Parcours terminé, bravo !</span>}
      </div>
      <div className="barre" role="progressbar" aria-valuemin={0} aria-valuemax={oeuvres.length} aria-valuenow={vues} aria-label="Avancement du parcours">
        <span style={{ width: `${oeuvres.length ? (vues / oeuvres.length) * 100 : 0}%` }} />
      </div>
      <div className="ligne-actions">
        {absentes.length > 0 && (
          <button
            type="button"
            className="bouton bouton-principal"
            onClick={() => ajouter(...absentes.map((oeuvre) => creerEvenement("statut", { oeuvre, statut: "prevu" })))}
          >
            Ajouter {absentes.length === oeuvres.length ? "le parcours" : `les ${absentes.length} restantes`} à « À voir »
          </button>
        )}
        {prochaine && vues < oeuvres.length && (
          <a className="bouton" href={`/oeuvre/${prochaine}`}>
            Étape suivante
          </a>
        )}
      </div>
    </div>
  );
}
