"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CarteSuivi } from "../../catalogue/suivi.ts";
import { compterParStatut, creerEvenement, type EtatSuivi, type Statut } from "../../domain/suivi.ts";
import { Carte } from "../composants/Cartes.tsx";
import { ajouter, exporter, restaurer, toutEffacer, useJournal } from "./journal.ts";
import { decrire, STATUTS_UI } from "./libelles.ts";

type Onglet = Statut | "jaime" | "historique";

const PAR_LOT = 2000;
const FORMAT_DATE = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

async function chargerCartes(ids: string[]): Promise<Map<string, CarteSuivi>> {
  const cartes = new Map<string, CarteSuivi>();
  for (let i = 0; i < ids.length; i += PAR_LOT) {
    const reponse = await fetch("/api/cartes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ids.slice(i, i + PAR_LOT) }),
    });
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    for (const c of ((await reponse.json()) as { cartes: CarteSuivi[] }).cartes) cartes.set(c.id, c);
  }
  return cartes;
}

/** Partie en cours d'une série : la dernière commencée, sinon la première. */
function partieCourante(carte: CarteSuivi, etat: EtatSuivi) {
  const commencees = carte.parties.filter((p) => (etat.progression[p.cle] ?? 0) > 0);
  return commencees.at(-1) ?? carte.parties[0];
}

function Progression({ carte, etat }: { carte: CarteSuivi; etat: EtatSuivi }) {
  const partie = partieCourante(carte, etat);
  if (!partie || carte.format === "film") return null;
  const vu = etat.progression[partie.cle] ?? 0;
  const fini = partie.episodes !== null && vu >= partie.episodes;
  return (
    <div className="carte-progression">
      <span>
        {carte.parties.length > 1 ? `Partie ${carte.parties.indexOf(partie) + 1} · ` : ""}ép. {vu}/{partie.episodes ?? "?"}
      </span>
      {!fini && (
        <button
          type="button"
          className="bouton"
          aria-label={`J'ai vu l'épisode ${vu + 1} de ${carte.titre}`}
          onClick={() => ajouter(creerEvenement("progression", { oeuvre: carte.id, partie: partie.cle, episode: vu + 1 }))}
        >
          +1
        </button>
      )}
    </div>
  );
}

export function MaListe() {
  const { etats, evenements, stockageIndisponible } = useJournal();
  const [onglet, setOnglet] = useState<Onglet>("en_cours");
  const [cartes, setCartes] = useState<Map<string, CarteSuivi>>(new Map());
  const [message, setMessage] = useState<string | null>(null);
  const fichier = useRef<HTMLInputElement>(null);

  const ids = useMemo(() => [...etats.keys()].sort(), [etats]);
  const cleIds = ids.join(",");
  useEffect(() => {
    const manquants = cleIds ? cleIds.split(",").filter((id) => !cartes.has(id)) : [];
    if (manquants.length === 0) return;
    let annule = false;
    chargerCartes(manquants)
      .then((nouvelles) => !annule && setCartes((avant) => new Map([...avant, ...nouvelles])))
      .catch(() => !annule && setMessage("Impossible de charger les fiches des œuvres. Réessayez plus tard."));
    return () => {
      annule = true;
    };
    // `cartes` est volontairement exclu : on ne recharge que si la liste d'œuvres change.
  }, [cleIds]);

  const comptes = compterParStatut(etats.values());
  const liste = [...etats.values()]
    .filter((e) => (onglet === "jaime" ? e.avis === "jaime" : e.statut === onglet))
    .sort((a, b) => b.maj_le.localeCompare(a.maj_le));

  const telecharger = () => {
    const url = URL.createObjectURL(exporter());
    const a = document.createElement("a");
    a.href = url;
    a.download = `ma-liste-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const surFichier = async (f: File | undefined) => {
    if (!f) return;
    try {
      const { ajoutes, rejetes } = restaurer(await f.text());
      setMessage(`${ajoutes} action${ajoutes > 1 ? "s" : ""} restaurée${ajoutes > 1 ? "s" : ""}${rejetes ? `, ${rejetes} ignorée${rejetes > 1 ? "s" : ""} (illisibles)` : ""}.`);
    } catch {
      setMessage("Ce fichier n'est pas une sauvegarde lisible.");
    }
    if (fichier.current) fichier.current.value = "";
  };
  const effacer = () => {
    if (window.confirm("Effacer tout votre suivi de ce navigateur ? Pensez à sauvegarder avant : cette action est définitive.")) toutEffacer();
  };

  const onglets: Array<{ id: Onglet; libelle: string; nombre?: number }> = [
    ...STATUTS_UI.map((s) => ({ id: s.statut as Onglet, libelle: s.libelle, nombre: comptes[s.statut] })),
    { id: "jaime", libelle: "J'aime", nombre: comptes.jaime },
    { id: "historique", libelle: "Historique", nombre: evenements.length },
  ];

  return (
    <>
      {stockageIndisponible && (
        <p className="avertissement" role="alert">
          Ce navigateur bloque l'enregistrement local : votre liste ne sera pas conservée.
        </p>
      )}
      <div className="ligne-actions">
        <Link href="/ma-liste/importer" className="bouton bouton-principal">
          Importer depuis AniList, MyAnimeList ou Letterboxd
        </Link>
        <button type="button" className="bouton" onClick={telecharger} disabled={evenements.length === 0}>
          Sauvegarder
        </button>
        <label className="bouton">
          Restaurer
          <input ref={fichier} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => surFichier(e.target.files?.[0])} />
        </label>
        {evenements.length > 0 && (
          <button type="button" className="lien-discret" onClick={effacer}>
            Tout effacer
          </button>
        )}
      </div>
      {message && (
        <p className="discret" role="status">
          {message}
        </p>
      )}

      <nav className="onglets" aria-label="Filtrer ma liste">
        {onglets.map((o) => (
          <button key={o.id} type="button" className="bouton" aria-pressed={onglet === o.id} onClick={() => setOnglet(o.id)}>
            {o.libelle}
            {o.nombre !== undefined ? ` (${o.nombre})` : ""}
          </button>
        ))}
      </nav>

      {onglet === "historique" ? (
        evenements.length === 0 ? (
          <p className="vide">Aucune action pour l'instant.</p>
        ) : (
          <ol className="prose">
            {[...evenements]
              .reverse()
              .slice(0, 200)
              .map((e) => (
                <li key={e.id}>
                  <time dateTime={e.date}>{FORMAT_DATE.format(new Date(e.date))}</time> —{" "}
                  <Link href={`/oeuvre/${e.oeuvre}`}>{cartes.get(e.oeuvre)?.titre ?? e.oeuvre}</Link> : {decrire(e)}
                </li>
              ))}
          </ol>
        )
      ) : liste.length === 0 ? (
        <p className="vide">
          {etats.size === 0
            ? "Votre liste est vide. Ouvrez une œuvre et choisissez « À voir », « En cours » ou « Vu », ou importez votre historique."
            : "Rien dans cette catégorie."}
        </p>
      ) : (
        <div className="grille">
          {liste.map((etat) => {
            const carte = cartes.get(etat.oeuvre);
            if (!carte) return <div key={etat.oeuvre} className="jaquette" aria-busy="true" />;
            return (
              <div key={etat.oeuvre}>
                <Carte carte={carte} />
                {(onglet === "en_cours" || onglet === "revisionnage") && <Progression carte={carte} etat={etat} />}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
