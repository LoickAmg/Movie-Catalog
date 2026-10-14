"use client";

import { useState } from "react";
import { creerEvenement, type Avis, type Statut } from "../../domain/suivi.ts";
import { ajouter, useJournal } from "./journal.ts";
import { AVIS_UI, decrire, libelleStatut, STATUTS_UI } from "./libelles.ts";

export interface PartieSuivie {
  cle: string;
  titre: string;
  episodes: number | null;
}

const FORMAT_DATE = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

/** Bloc « Mon suivi » d'une page d'œuvre : statut, avis, progression, historique. */
export function SuiviOeuvre({ oeuvre, film, parties }: { oeuvre: string; film: boolean; parties: PartieSuivie[] }) {
  const { etats, evenements, stockageIndisponible } = useJournal();
  const etat = etats.get(oeuvre);
  const [erreur, setErreur] = useState<string | null>(null);

  const enregistrer = (...e: Parameters<typeof ajouter>) => {
    if (!ajouter(...e)) setErreur("Ce navigateur refuse l'enregistrement : votre suivi sera perdu à la fermeture de la page.");
  };
  const choisirStatut = (statut: Statut) => {
    if (etat?.statut !== statut) enregistrer(creerEvenement("statut", { oeuvre, statut }));
  };
  const basculerAvis = (avis: Avis) => enregistrer(creerEvenement("avis", { oeuvre, avis: etat?.avis === avis ? null : avis }));

  // Partie suivie : la dernière commencée, sinon la première.
  const commencees = parties.filter((p) => (etat?.progression[p.cle] ?? 0) > 0);
  const [partieChoisie, setPartieChoisie] = useState<string | null>(null);
  const partie = parties.find((p) => p.cle === partieChoisie) ?? commencees.at(-1) ?? parties[0];
  const vu = partie ? (etat?.progression[partie.cle] ?? 0) : 0;
  const indexPartie = partie ? parties.indexOf(partie) : -1;
  const partieFinie = Boolean(partie?.episodes && vu >= partie.episodes);
  const suivante = partieFinie && indexPartie < parties.length - 1 ? parties[indexPartie + 1] : undefined;

  const noterEpisode = (episode: number) => {
    if (!partie) return;
    const borne = Math.max(0, partie.episodes ? Math.min(episode, partie.episodes) : episode);
    if (borne !== vu) enregistrer(creerEvenement("progression", { oeuvre, partie: partie.cle, episode: borne }));
  };

  const historique = evenements.filter((e) => e.oeuvre === oeuvre).slice(-5).reverse();

  return (
    <section className="encadre suivi" aria-labelledby="mon-suivi">
      <h2 id="mon-suivi">Mon suivi</h2>
      {(stockageIndisponible || erreur) && (
        <p className="avertissement" role="alert">
          {erreur ?? "Ce navigateur bloque l'enregistrement local : votre suivi ne sera pas conservé."}
        </p>
      )}

      <div className="choix" role="group" aria-label="Statut">
        {STATUTS_UI.filter((s) => !(film && s.statut === "en_pause")).map((s) => (
          <button
            key={s.statut}
            type="button"
            className="bouton"
            aria-pressed={etat?.statut === s.statut}
            onClick={() => choisirStatut(s.statut)}
          >
            {libelleStatut(s.statut, film)}
          </button>
        ))}
      </div>

      <div className="choix" role="group" aria-label="Mon avis">
        {(Object.keys(AVIS_UI) as Avis[]).map((a) => (
          <button key={a} type="button" className="bouton" aria-pressed={etat?.avis === a} onClick={() => basculerAvis(a)}>
            {AVIS_UI[a]}
          </button>
        ))}
      </div>

      {!film && partie && (
        <div className="progression">
          {parties.length > 1 && (
            <label>
              <span className="sr-only">Saison ou partie</span>
              <select value={partie.cle} onChange={(e) => setPartieChoisie(e.target.value)}>
                {parties.map((p) => (
                  <option key={p.cle} value={p.cle}>
                    {p.titre}
                    {(etat?.progression[p.cle] ?? 0) > 0 ? ` (${etat?.progression[p.cle]}/${p.episodes ?? "?"})` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="compteur">
            <button type="button" className="bouton" onClick={() => noterEpisode(vu - 1)} disabled={vu <= 0} aria-label="Épisode précédent">
              −
            </button>
            <label>
              <span className="discret">Épisode </span>
              <input
                type="number"
                min={0}
                max={partie.episodes ?? undefined}
                value={vu}
                inputMode="numeric"
                onChange={(e) => noterEpisode(Number(e.target.value) || 0)}
                aria-label="Dernier épisode vu"
              />
              <span className="discret"> / {partie.episodes ?? "?"}</span>
            </label>
            <button
              type="button"
              className="bouton bouton-principal"
              onClick={() => noterEpisode(vu + 1)}
              disabled={partieFinie}
              aria-label="J'ai vu l'épisode suivant"
            >
              +1
            </button>
          </div>
          {partie.episodes && (
            <div className="barre" role="progressbar" aria-valuemin={0} aria-valuemax={partie.episodes} aria-valuenow={vu} aria-label="Progression">
              <span style={{ width: `${Math.min(100, (vu / partie.episodes) * 100)}%` }} />
            </div>
          )}
          {suivante && (
            <button type="button" className="bouton" onClick={() => setPartieChoisie(suivante.cle)}>
              Passer à : {suivante.titre}
            </button>
          )}
          {partieFinie && !suivante && etat?.statut !== "termine" && (
            <button type="button" className="bouton bouton-principal" onClick={() => choisirStatut("termine")}>
              Tout vu : marquer comme terminé
            </button>
          )}
        </div>
      )}

      {etat && (
        <>
          <details className="historique">
            <summary>Historique</summary>
            <ol>
              {historique.map((e) => (
                <li key={e.id}>
                  <time dateTime={e.date}>{FORMAT_DATE.format(new Date(e.date))}</time> — {decrire(e)}
                </li>
              ))}
            </ol>
          </details>
          <button type="button" className="lien-discret" onClick={() => enregistrer(creerEvenement("retrait", { oeuvre }))}>
            Retirer de ma liste
          </button>
        </>
      )}
      <p className="note-source">Enregistré dans ce navigateur uniquement. Les comptes arriveront plus tard.</p>
    </section>
  );
}
