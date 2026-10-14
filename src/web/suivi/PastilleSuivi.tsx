"use client";

import { useEtat } from "./journal.ts";
import { libelleStatut } from "./libelles.ts";

/** Petit badge posé sur une jaquette quand l'œuvre est dans « Ma liste ». */
export function PastilleSuivi({ oeuvre, film }: { oeuvre: string; film: boolean }) {
  const etat = useEtat(oeuvre);
  if (!etat?.statut && !etat?.avis) return null;
  const texte = etat.statut ? libelleStatut(etat.statut, film) : etat.avis === "jaime" ? "J'aime" : "Pas pour moi";
  return (
    <span className={`pastille pastille-${etat.statut ?? etat.avis}`}>
      {texte}
      {etat.avis === "jaime" && etat.statut ? " ♥" : ""}
    </span>
  );
}
