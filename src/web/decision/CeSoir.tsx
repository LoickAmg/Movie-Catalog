"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { decider, ENVIES, genresEnvie, type Contexte, type Envie, type Proposition } from "../../domain/decision.ts";
import { principauxGouts } from "../../domain/profil.ts";
import { creerEvenement } from "../../domain/suivi.ts";
import { estFilm, type Traits } from "../../domain/traits.ts";
import { RUBRIQUES, type Rubrique } from "../../domain/types.ts";
import { Jaquette } from "../composants/Jaquette.tsx";
import { nomPays, rubriqueUI } from "../libelles.ts";
import { ajouter, useJournal } from "../suivi/journal.ts";
import { libelleTrait, retenirLibelles, useProfil } from "./useProfil.ts";

const DUREES: Array<{ valeur: number | null; libelle: string }> = [
  { valeur: 30, libelle: "30 min" },
  { valeur: 60, libelle: "1 h" },
  { valeur: 100, libelle: "1 h 40" },
  { valeur: 130, libelle: "2 h 10" },
  { valeur: 180, libelle: "3 h" },
  { valeur: null, libelle: "Peu importe" },
];
const FORMATS: Array<{ valeur: Contexte["format"]; libelle: string }> = [
  { valeur: "film", libelle: "Un film" },
  { valeur: "serie", libelle: "Une série" },
  { valeur: null, libelle: "Peu importe" },
];

/** Statuts déjà « pris » : le serveur n'a pas besoin de les proposer. */
const EXCLUS = new Set(["termine", "abandonne", "en_cours", "revisionnage", "en_pause"]);

function Choix<T>({ legende, options, valeur, changer }: { legende: string; options: Array<{ valeur: T; libelle: string }>; valeur: T; changer: (v: T) => void }) {
  return (
    <fieldset className="question">
      <legend>{legende}</legend>
      <div className="choix">
        {options.map((o) => (
          <button key={String(o.libelle)} type="button" className="bouton" aria-pressed={o.valeur === valeur} onClick={() => changer(o.valeur)}>
            {o.libelle}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function CarteProposition({ p, autre }: { p: Proposition; autre: () => void }) {
  const t = p.oeuvre;
  const meta = [rubriqueUI(t.rubrique).singulier, t.annee, t.origines[0] ? nomPays(t.origines[0]) : null].filter(Boolean).join(" · ");
  const marquer = (e: Parameters<typeof ajouter>[0]) => {
    ajouter(e);
    autre();
  };
  return (
    <article className={`proposition${p.decouverte ? " proposition-decouverte" : ""}`}>
      <Link href={`/oeuvre/${t.id}`} className="proposition-visuel" aria-label={`Ouvrir la fiche de ${t.titre}`}>
        <Jaquette titre={t.titre} affiche={t.affiche} rubrique={t.rubrique} annee={t.annee} />
      </Link>
      <div className="proposition-corps">
        {p.decouverte && <p className="surtitre">Découverte</p>}
        <h3>
          <Link href={`/oeuvre/${t.id}`}>{t.titre}</Link>
        </h3>
        <p className="carte-meta">{meta}</p>
        <ul className="raisons">
          {p.raisons.map((r, i) => (
            <li key={i} className={`raison raison-${r.type}`}>
              {r.texte}
            </li>
          ))}
        </ul>
        <div className="choix">
          <button type="button" className="bouton" onClick={() => marquer(creerEvenement("statut", { oeuvre: t.id, statut: "prevu" }))}>
            Plus tard
          </button>
          <button type="button" className="bouton" onClick={() => marquer(creerEvenement("statut", { oeuvre: t.id, statut: "termine" }))}>
            Déjà vu
          </button>
          <button type="button" className="bouton" onClick={() => marquer(creerEvenement("avis", { oeuvre: t.id, avis: "pas_pour_moi" }))}>
            Pas pour moi
          </button>
        </div>
      </div>
    </article>
  );
}

export function CeSoir() {
  const { etats } = useJournal();
  const { profil, traits, pret } = useProfil();
  const [contexte, setContexte] = useState<Contexte>({ duree: null, format: null, envie: null, surprendre: false });
  const [candidats, setCandidats] = useState<Traits[] | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [montrees, setMontrees] = useState<Set<string>>(new Set());
  const [demande, setDemande] = useState(0);
  const resultats = useRef<HTMLDivElement>(null);

  const proposer = async () => {
    setChargement(true);
    setErreur(null);
    setMontrees(new Set());
    const gouts = principauxGouts(profil, 30);
    const genresProfil = gouts.filter((g) => g.cle.startsWith("genre:")).slice(0, 6).map((g) => g.cle.slice(6));
    const rubriquesDecouverte = RUBRIQUES.filter((r) => (profil.gouts.get(`rubrique:${r}`)?.poids ?? 0) < 0.15) as Rubrique[];
    const exclure = [...etats.values()].filter((e) => (e.statut && EXCLUS.has(e.statut)) || e.avis === "pas_pour_moi").map((e) => e.oeuvre);
    try {
      const reponse = await fetch("/api/candidats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duree: contexte.duree,
          format: contexte.format,
          genres: genresEnvie(contexte.envie),
          genresProfil,
          rubriquesDecouverte: profil.base >= 3 ? rubriquesDecouverte : [],
          exclure,
        }),
      });
      if (!reponse.ok) throw new Error();
      const donnees = (await reponse.json()) as { traits: Traits[]; libelles: Record<string, string> };
      retenirLibelles(donnees.libelles);
      setCandidats(donnees.traits);
      setDemande((d) => d + 1);
    } catch {
      setErreur("Impossible de préparer des propositions pour l'instant. Réessayez dans un moment.");
    } finally {
      setChargement(false);
    }
  };

  const propositions = useMemo(
    () => (candidats ? decider(candidats, profil, etats, contexte, libelleTrait, montrees) : []),
    // Les propositions ne changent qu'à la demande, « Autre chose », ou quand le suivi change.
    [candidats, montrees, etats, demande],
  );
  useEffect(() => {
    if (demande > 0) resultats.current?.focus();
  }, [demande]);

  const autreChose = () => setMontrees((m) => new Set([...m, ...propositions.map((p) => p.oeuvre.id)]));

  // « Reprendre » : séries en cours dont un épisode tient dans le temps disponible.
  const aReprendre = [...etats.values()]
    .filter((e) => e.statut === "en_cours" || e.statut === "revisionnage")
    .map((e) => ({ etat: e, t: traits.get(e.oeuvre) }))
    .filter((x): x is { etat: typeof x.etat; t: Traits } => Boolean(x.t))
    .filter(({ t }) => contexte.duree === null || (t.duree_min !== null && t.duree_min <= contexte.duree))
    .filter(({ t }) => contexte.format === null || (contexte.format === "film") === estFilm(t.format))
    .sort((a, b) => b.etat.maj_le.localeCompare(a.etat.maj_le))
    .slice(0, 3);

  return (
    <>
      <form
        className="questions"
        onSubmit={(e) => {
          e.preventDefault();
          proposer();
        }}
      >
        <Choix legende="Combien de temps avez-vous ?" options={DUREES} valeur={contexte.duree} changer={(duree) => setContexte({ ...contexte, duree })} />
        <Choix legende="Plutôt…" options={FORMATS} valeur={contexte.format} changer={(format) => setContexte({ ...contexte, format })} />
        <Choix
          legende="Envie de quoi ?"
          options={[...ENVIES.map((e) => ({ valeur: e.id as Envie | null, libelle: e.libelle })), { valeur: null, libelle: "Peu importe" }]}
          valeur={contexte.envie}
          changer={(envie) => setContexte({ ...contexte, envie })}
        />
        <label className="interrupteur">
          <input type="checkbox" checked={contexte.surprendre} onChange={(e) => setContexte({ ...contexte, surprendre: e.target.checked })} />
          Surprenez-moi : plus de découvertes hors de mes habitudes
        </label>
        <div className="ligne-actions">
          <button type="submit" className="bouton bouton-principal" disabled={chargement}>
            {chargement ? "Je cherche…" : "Que regarder ce soir ?"}
          </button>
          {!pret && <span className="discret">Lecture de votre liste…</span>}
        </div>
        {profil.base < 3 && (
          <p className="discret">
            Je vous connais encore peu : les propositions s'appuient surtout sur votre envie et sur les œuvres les plus suivies. Notez quelques
            œuvres, ou <Link href="/ma-liste/importer">importez votre historique</Link>, pour des choix vraiment à vous.
          </p>
        )}
      </form>

      {aReprendre.length > 0 && candidats && (
        <section className="section" aria-labelledby="reprendre">
          <h2 id="reprendre">Ou reprendre là où vous en étiez</h2>
          <ul className="reprendre">
            {aReprendre.map(({ etat, t }) => {
              const vu = Math.max(0, ...Object.values(etat.progression));
              return (
                <li key={t.id}>
                  <Link href={`/oeuvre/${t.id}`}>{t.titre}</Link>
                  <span className="discret"> — prochain : épisode {vu + 1}{t.duree_min ? ` (${t.duree_min} min)` : ""}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div ref={resultats} tabIndex={-1} aria-live="polite" className="resultats-ce-soir">
        {erreur && (
          <p className="avertissement" role="alert">
            {erreur}
          </p>
        )}
        {candidats && propositions.length === 0 && !chargement && (
          <p className="vide">
            Rien ne correspond à toutes ces conditions. Essayez avec plus de temps ou « Peu importe ».
          </p>
        )}
        {propositions.length > 0 && (
          <>
            <h2 className="sr-only">Propositions pour ce soir</h2>
            <div className="propositions">
              {propositions.map((p) => (
                <CarteProposition key={p.oeuvre.id} p={p} autre={() => setMontrees((m) => new Set([...m, p.oeuvre.id]))} />
              ))}
            </div>
            <div className="ligne-actions">
              <button type="button" className="bouton" onClick={autreChose}>
                Autre chose
              </button>
              <Link href="/mon-profil" className="lien-discret">
                Pourquoi ces choix ? Voir et corriger mes goûts
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}
