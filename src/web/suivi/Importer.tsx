"use client";

import Link from "next/link";
import { useState } from "react";
import {
  evenementsDepuisImport,
  lireAnilist,
  lireLetterboxd,
  lireMal,
  REQUETE_LISTE_ANILIST,
  type Correspondance,
  type LigneImport,
  type ListeAnilist,
  type ResultatImport,
} from "../../domain/imports.ts";
import type { Origine } from "../../domain/suivi.ts";
import { ajouter } from "./journal.ts";

const PAR_ENVOI = 5000;

/** Envoie seulement identifiants et titres au serveur pour retrouver les œuvres. */
async function trouverCorrespondances(lignes: LigneImport[]): Promise<(ligne: LigneImport, index: number) => Correspondance | null> {
  const cles = Array.from(new Set(lignes.flatMap((l) => (l.cle ? [l.cle] : []))));
  const sansCle = lignes.map((l, i) => [l, i] as const).filter(([l]) => !l.cle && l.titre);
  const parCle: Record<string, Correspondance> = {};
  const parTitre = new Map<number, Correspondance | null>();

  const envoyer = async (corps: object) => {
    const reponse = await fetch("/api/correspondances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    });
    if (!reponse.ok) throw new Error(`Le serveur a répondu ${reponse.status}.`);
    return (await reponse.json()) as { parCle: Record<string, Correspondance>; parTitre: Array<Correspondance | null> };
  };
  for (let i = 0; i < cles.length; i += PAR_ENVOI) Object.assign(parCle, (await envoyer({ cles: cles.slice(i, i + PAR_ENVOI) })).parCle);
  for (let i = 0; i < sansCle.length; i += PAR_ENVOI) {
    const lot = sansCle.slice(i, i + PAR_ENVOI);
    const { parTitre: trouves } = await envoyer({ titres: lot.map(([l]) => ({ titre: l.titre, annee: l.annee })) });
    lot.forEach(([, index], j) => parTitre.set(index, trouves[j] ?? null));
  }
  return (ligne, index) => (ligne.cle ? (parCle[ligne.cle] ?? null) : (parTitre.get(index) ?? null));
}

type Etat =
  | { etape: "repos" }
  | { etape: "analyse" }
  | { etape: "apercu"; source: string; resultat: ResultatImport }
  | { etape: "fait"; source: string; ajoutes: number }
  | { etape: "erreur"; message: string };

async function decompresserSiBesoin(fichier: File): Promise<string> {
  if (!fichier.name.endsWith(".gz")) return fichier.text();
  const flux = fichier.stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(flux).text();
}

export function Importer() {
  const [etat, setEtat] = useState<Etat>({ etape: "repos" });
  const [pseudo, setPseudo] = useState("");

  const analyser = async (source: string, origine: Extract<Origine, `import:${string}`>, lire: () => Promise<LigneImport[]>) => {
    setEtat({ etape: "analyse" });
    try {
      const lignes = await lire();
      if (lignes.length === 0) throw new Error("Aucune œuvre trouvée dans cette source.");
      const trouver = await trouverCorrespondances(lignes);
      setEtat({ etape: "apercu", source, resultat: evenementsDepuisImport(lignes, trouver, origine, new Date().toISOString()) });
    } catch (e) {
      setEtat({ etape: "erreur", message: e instanceof Error ? e.message : String(e) });
    }
  };

  const depuisAnilist = () =>
    analyser("AniList", "import:anilist", async () => {
      const reponse = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: REQUETE_LISTE_ANILIST, variables: { utilisateur: pseudo.trim() } }),
      });
      const donnees = (await reponse.json()) as ListeAnilist;
      if (!reponse.ok || donnees.errors?.length) {
        throw new Error(
          reponse.status === 404 ? "Utilisateur introuvable, ou liste privée sur AniList." : "AniList n'a pas pu fournir cette liste. Vérifiez le pseudo.",
        );
      }
      return lireAnilist(donnees);
    });

  const depuisMal = (fichier: File | undefined) =>
    fichier && analyser("MyAnimeList", "import:mal", async () => lireMal(await decompresserSiBesoin(fichier)));

  const depuisLetterboxd = (fichiers: FileList | null) =>
    fichiers?.length &&
    analyser("Letterboxd", "import:letterboxd", async () => {
      const lignes: LigneImport[] = [];
      for (const f of Array.from(fichiers)) lignes.push(...lireLetterboxd(await f.text(), f.name));
      return lignes;
    });

  const valider = () => {
    if (etat.etape !== "apercu") return;
    ajouter(...etat.resultat.evenements);
    setEtat({ etape: "fait", source: etat.source, ajoutes: etat.resultat.reconnues });
  };

  const occupe = etat.etape === "analyse";

  return (
    <>
      <div className="etapes">
        <section className="encadre" aria-labelledby="import-anilist">
          <h2 id="import-anilist">AniList</h2>
          <p className="discret">Votre liste doit être publique. Indiquez votre pseudo AniList.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pseudo.trim()) depuisAnilist();
            }}
          >
            <label htmlFor="pseudo-anilist" className="sr-only">
              Pseudo AniList
            </label>
            <input id="pseudo-anilist" type="text" value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Pseudo AniList" autoComplete="off" />
            <button type="submit" className="bouton bouton-principal" disabled={occupe || !pseudo.trim()}>
              Lire ma liste
            </button>
          </form>
        </section>

        <section className="encadre" aria-labelledby="import-mal">
          <h2 id="import-mal">MyAnimeList</h2>
          <p className="discret">
            Sur MyAnimeList : <em>Profil → Export</em>, puis « Anime List ». Déposez ici le fichier obtenu (<code>.xml</code> ou <code>.xml.gz</code>).
          </p>
          <label htmlFor="fichier-mal" className="sr-only">
            Fichier d'export MyAnimeList
          </label>
          <input id="fichier-mal" type="file" accept=".xml,.gz" disabled={occupe} onChange={(e) => depuisMal(e.target.files?.[0])} />
        </section>

        <section className="encadre" aria-labelledby="import-letterboxd">
          <h2 id="import-letterboxd">Letterboxd</h2>
          <p className="discret">
            Sur Letterboxd : <em>Settings → Data → Export your data</em>. Décompressez l'archive et déposez <code>watched.csv</code>,{" "}
            <code>ratings.csv</code> et/ou <code>watchlist.csv</code>.
          </p>
          <label htmlFor="fichiers-letterboxd" className="sr-only">
            Fichiers CSV Letterboxd
          </label>
          <input id="fichiers-letterboxd" type="file" accept=".csv" multiple disabled={occupe} onChange={(e) => depuisLetterboxd(e.target.files)} />
        </section>
      </div>

      <div className="resultat-import" aria-live="polite">
        {etat.etape === "analyse" && <p className="discret">Lecture et recherche des œuvres…</p>}
        {etat.etape === "erreur" && (
          <p className="avertissement" role="alert">
            {etat.message}
          </p>
        )}
        {etat.etape === "apercu" && (
          <section className="encadre">
            <h2>Aperçu de l'import {etat.source}</h2>
            <p>
              <strong>{etat.resultat.reconnues}</strong> œuvre{etat.resultat.reconnues > 1 ? "s" : ""} reconnue{etat.resultat.reconnues > 1 ? "s" : ""}
              {etat.resultat.inconnues.length > 0 && (
                <>
                  , <strong>{etat.resultat.inconnues.length}</strong> absente{etat.resultat.inconnues.length > 1 ? "s" : ""} du catalogue pour l'instant
                </>
              )}
              . Rien de ce que vous avez déjà noté ici ne sera écrasé : les actions importées gardent leur date d'origine.
            </p>
            <div className="ligne-actions">
              <button type="button" className="bouton bouton-principal" onClick={valider} disabled={etat.resultat.reconnues === 0}>
                Ajouter à ma liste
              </button>
              <button type="button" className="bouton" onClick={() => setEtat({ etape: "repos" })}>
                Annuler
              </button>
            </div>
            {etat.resultat.inconnues.length > 0 && (
              <details>
                <summary>Voir les œuvres non trouvées</summary>
                <ul>
                  {etat.resultat.inconnues.slice(0, 500).map((l, i) => (
                    <li key={i}>
                      {l.titre ?? l.cle}
                      {l.annee ? ` (${l.annee})` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}
        {etat.etape === "fait" && (
          <p role="status">
            {etat.ajoutes} œuvre{etat.ajoutes > 1 ? "s" : ""} importée{etat.ajoutes > 1 ? "s" : ""} depuis {etat.source}.{" "}
            <Link href="/ma-liste">Voir ma liste</Link>
          </p>
        )}
      </div>
      <p className="note-source">
        Vos fichiers sont lus dans votre navigateur. Seuls les identifiants et les titres des œuvres sont envoyés au serveur pour les retrouver
        dans le catalogue ; rien n'y est conservé.
      </p>
    </>
  );
}
