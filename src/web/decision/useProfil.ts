"use client";

import { useEffect, useMemo, useState } from "react";
import { calculerProfil, type Profil } from "../../domain/profil.ts";
import { reglagesDepuis } from "../../domain/suivi.ts";
import type { Traits } from "../../domain/traits.ts";
import { useJournal } from "../suivi/journal.ts";

/** Traits déjà chargés pendant la session, partagés entre les pages. */
const cache = new Map<string, Traits>();
const libellesConnus = new Map<string, string>();
const PAR_ENVOI = 2000;

export function retenirLibelles(libelles: Record<string, string>) {
  for (const [cle, valeur] of Object.entries(libelles)) libellesConnus.set(cle, valeur);
}

export function libelleTrait(cle: string): string {
  return libellesConnus.get(cle) ?? cle.slice(cle.indexOf(":") + 1).replace(/_/g, " ");
}

async function chargerTraits(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += PAR_ENVOI) {
    const reponse = await fetch("/api/traits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ids.slice(i, i + PAR_ENVOI) }),
    });
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    const { traits, libelles } = (await reponse.json()) as { traits: Traits[]; libelles: Record<string, string> };
    retenirLibelles(libelles);
    for (const t of traits) cache.set(t.id, t);
  }
}

/**
 * Profil de goûts calculé dans le navigateur à partir du suivi local et des
 * traits des œuvres suivies.
 */
export function useProfil(): { profil: Profil; traits: ReadonlyMap<string, Traits>; pret: boolean; erreur: boolean } {
  const { etats, evenements } = useJournal();
  const [version, setVersion] = useState(0);
  const [erreur, setErreur] = useState(false);
  const ids = [...etats.keys()];
  const manquants = ids.filter((id) => !cache.has(id));
  const cleManquants = manquants.join(",");

  useEffect(() => {
    if (!cleManquants) return;
    let annule = false;
    chargerTraits(cleManquants.split(","))
      .then(() => !annule && setVersion((v) => v + 1))
      .catch(() => !annule && setErreur(true));
    return () => {
      annule = true;
    };
  }, [cleManquants]);

  const reglages = useMemo(() => reglagesDepuis(evenements), [evenements]);
  const profil = useMemo(
    () => calculerProfil(etats.values(), cache, reglages),
    // `version` signale l'arrivée de nouveaux traits dans le cache.
    [etats, reglages, version],
  );
  return { profil, traits: cache, pret: manquants.length === 0, erreur };
}
