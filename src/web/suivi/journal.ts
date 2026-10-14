"use client";

import { useSyncExternalStore } from "react";
import { etatsDepuis, fusionnerJournaux, validerJournal, type EtatSuivi, type Evenement } from "../../domain/suivi.ts";

/**
 * Journal de suivi du mode invité : stocké dans ce navigateur uniquement
 * (localStorage). Les comptes et la synchronisation viendront au lot 5.
 */
const CLE = "cine:journal:v1";

interface Instantane {
  evenements: Evenement[];
  etats: Map<string, EtatSuivi>;
  /** Vrai si le navigateur refuse le stockage (navigation privée stricte, quota…). */
  stockageIndisponible: boolean;
}

const VIDE: Instantane = { evenements: [], etats: new Map(), stockageIndisponible: false };
let courant: Instantane | null = null;
const abonnes = new Set<() => void>();

function lire(): Instantane {
  try {
    const brut = localStorage.getItem(CLE);
    const { evenements } = validerJournal(brut ? JSON.parse(brut) : []);
    return { evenements, etats: etatsDepuis(evenements), stockageIndisponible: false };
  } catch {
    return { ...VIDE, stockageIndisponible: true };
  }
}

function publier(evenements: Evenement[]): boolean {
  let stockageIndisponible = false;
  try {
    localStorage.setItem(CLE, JSON.stringify(evenements));
  } catch {
    // On garde le suivi en mémoire pour la session en cours.
    stockageIndisponible = true;
  }
  courant = { evenements, etats: etatsDepuis(evenements), stockageIndisponible };
  for (const f of abonnes) f();
  return !stockageIndisponible;
}

function instantane(): Instantane {
  courant ??= lire();
  return courant;
}

function abonner(rappel: () => void): () => void {
  abonnes.add(rappel);
  // Un autre onglet a modifié le journal.
  const surStockage = (e: StorageEvent) => {
    if (e.key === CLE) {
      courant = lire();
      rappel();
    }
  };
  window.addEventListener("storage", surStockage);
  return () => {
    abonnes.delete(rappel);
    window.removeEventListener("storage", surStockage);
  };
}

export function useJournal(): Instantane {
  return useSyncExternalStore(abonner, instantane, () => VIDE);
}

export function useEtat(oeuvre: string): EtatSuivi | undefined {
  return useJournal().etats.get(oeuvre);
}

export function ajouter(...evenements: Evenement[]): boolean {
  return publier(fusionnerJournaux(instantane().evenements, evenements));
}

/** Fichier de sauvegarde lisible, à garder ou à restaurer plus tard. */
export function exporter(): Blob {
  const contenu = { format: "cine-catalogue/journal", version: 1, exporte_le: new Date().toISOString(), evenements: instantane().evenements };
  return new Blob([JSON.stringify(contenu, null, 2)], { type: "application/json" });
}

/** Restaure une sauvegarde en la fusionnant au journal actuel (rien n'est écrasé). */
export function restaurer(texte: string): { ajoutes: number; rejetes: number } {
  const donnees = JSON.parse(texte) as { evenements?: unknown } | unknown[];
  const { evenements, rejetes } = validerJournal(Array.isArray(donnees) ? donnees : donnees?.evenements);
  const avant = instantane().evenements.length;
  publier(fusionnerJournaux(instantane().evenements, evenements));
  return { ajoutes: instantane().evenements.length - avant, rejetes };
}

export function toutEffacer(): void {
  publier([]);
}
