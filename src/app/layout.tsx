import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { RUBRIQUES_UI } from "../web/libelles.ts";
import "./globals.css";

const titre = Instrument_Serif({ subsets: ["latin", "latin-ext"], weight: "400", style: ["normal", "italic"], variable: "--police-titre" });
const texte = Inter({ subsets: ["latin", "latin-ext"], variable: "--police-texte" });

export const metadata: Metadata = {
  title: { default: "Ciné Catalogue — quoi regarder ce soir", template: "%s · Ciné Catalogue" },
  description: "Films, séries, anime et dessins animés : trouver quoi regarder, et comprendre ce qu'on regarde.",
};

export default function Racine({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${titre.variable} ${texte.variable}`}>
      <body>
        <a href="#contenu" className="lien-evitement">
          Aller au contenu
        </a>
        <header className="entete">
          <div className="page entete-interieur">
            <Link href="/" className="marque">
              Ciné <span>Catalogue</span>
            </Link>
            <nav className="navigation" aria-label="Rubriques">
              {RUBRIQUES_UI.map((r) => (
                <Link key={r.rubrique} href={r.chemin}>
                  {r.libelle}
                </Link>
              ))}
              <Link href="/comprendre">Comprendre</Link>
              <Link href="/ma-liste">Ma liste</Link>
            </nav>
            <form action="/recherche" role="search" className="recherche">
              <label htmlFor="recherche-entete" className="sr-only">
                Rechercher une œuvre
              </label>
              <input id="recherche-entete" name="q" type="search" className="champ-recherche" placeholder="Rechercher un titre…" />
            </form>
          </div>
        </header>
        <main id="contenu" className="page">
          {children}
        </main>
        <footer className="pied">
          <div className="page">
            <p>
              Données issues d'<a href="https://anilist.co">AniList</a>, de <a href="https://www.wikidata.org">Wikidata</a> (CC0) et de{" "}
              <a href="https://www.tvmaze.com">TVmaze</a> (CC BY-SA). Les affiches appartiennent à leurs ayants droit. Chaque fiche indique la
              source de ses informations.
            </p>
            <p>Version en construction : l'ancien catalogue reste disponible pendant la migration.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
