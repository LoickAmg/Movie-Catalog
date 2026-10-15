"use client";

import Link from "next/link";
import { principauxGouts, type Gout, type Reglage } from "../../domain/profil.ts";
import { creerEvenement } from "../../domain/suivi.ts";
import { familleDe, type FamilleTrait } from "../../domain/traits.ts";
import { ajouter } from "../suivi/journal.ts";
import { libelleTrait, useProfil } from "./useProfil.ts";

const FAMILLES: Array<{ familles: FamilleTrait[]; titre: string; aide: string }> = [
  { familles: ["genre"], titre: "Genres", aide: "Ce que vous aimez regarder." },
  { familles: ["rubrique", "origine"], titre: "Univers", aide: "Films, séries, anime, dessins animés, et les pays que vous fréquentez." },
  { familles: ["demo"], titre: "Publics visés", aide: "Shōnen, seinen, josei… pour l'anime." },
  { familles: ["credit"], titre: "Créateurs et studios", aide: "Réalisateurs, créateurs et studios qui reviennent dans vos choix." },
  { familles: ["theme"], titre: "Thèmes", aide: "Des sujets plus précis (encore en anglais, traduction à venir)." },
];

const REGLAGES: Array<{ valeur: Reglage; libelle: string; aide: string }> = [
  { valeur: "plus", libelle: "Plus", aide: "Proposez-m'en davantage" },
  { valeur: "moins", libelle: "Moins", aide: "Proposez-m'en moins" },
  { valeur: "jamais", libelle: "Jamais", aide: "Ne me proposez jamais ça" },
];

function LigneGout({ gout }: { gout: Gout }) {
  const nom = libelleTrait(gout.cle);
  const regler = (valeur: Reglage) =>
    ajouter(creerEvenement("reglage", { trait: gout.cle, reglage: gout.reglage === valeur ? null : valeur }) as Parameters<typeof ajouter>[0]);
  const positif = gout.poids >= 0;
  const preuves = gout.preuves.slice(0, 3);
  return (
    <li className="gout">
      <div className="gout-tete">
        <strong>{nom}</strong>
        <span className="discret">
          {gout.nombre > 0 ? `${gout.nombre} œuvre${gout.nombre > 1 ? "s" : ""}` : "réglé à la main"}
          {gout.reglage && gout.poids !== gout.poidsCalcule ? " · corrigé" : ""}
        </span>
      </div>
      <div
        className={`jauge ${positif ? "jauge-positive" : "jauge-negative"}`}
        role="meter"
        aria-label={`Intensité de « ${nom} »`}
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={Math.round(gout.poids * 100)}
      >
        <span style={{ width: `${Math.min(100, Math.abs(gout.poids) * 100)}%` }} />
      </div>
      {preuves.length > 0 && (
        <p className="gout-preuves">
          D'après{" "}
          {preuves.map((p, i) => (
            <span key={p.oeuvre}>
              {i > 0 && (i === preuves.length - 1 ? " et " : ", ")}
              <Link href={`/oeuvre/${p.oeuvre}`}>{p.titre}</Link>
              {p.aime ? " ♥" : ""}
              {p.poids < 0 ? " (rejetée)" : ""}
            </span>
          ))}
        </p>
      )}
      <div className="choix" role="group" aria-label={`Régler « ${nom} »`}>
        {REGLAGES.map((r) => (
          <button key={r.valeur} type="button" className="bouton" aria-pressed={gout.reglage === r.valeur} title={r.aide} onClick={() => regler(r.valeur)}>
            {r.libelle}
          </button>
        ))}
      </div>
    </li>
  );
}

export function MonProfil() {
  const { profil, pret, erreur } = useProfil();
  const tous = [...profil.gouts.values()];

  if (pret && profil.base === 0 && tous.length === 0) {
    return (
      <p className="vide">
        Votre profil se construit à partir de ce que vous regardez et aimez. Notez quelques œuvres (« Vu », « J'aime », « Pas pour moi »), ou{" "}
        <Link href="/ma-liste/importer">importez votre historique</Link>.
      </p>
    );
  }

  const evites = principauxGouts(profil, 12, true);
  return (
    <>
      {erreur && (
        <p className="avertissement" role="alert">
          Une partie de votre liste n'a pas pu être lue. Le profil est peut-être incomplet.
        </p>
      )}
      <p className="discret">
        Calculé à partir de {profil.base} œuvre{profil.base > 1 ? "s" : ""} de votre liste. Corrigez ce qui ne vous ressemble pas : « Plus »,
        « Moins » ou « Jamais ». Recliquez pour annuler.
      </p>
      <div className="profil">
        {FAMILLES.map((f) => {
          const gouts = tous
            .filter((g) => f.familles.includes(familleDe(g.cle)) && g.poids > 0.05)
            .sort((a, b) => b.poids - a.poids)
            .slice(0, f.familles.includes("theme") ? 8 : 10);
          if (gouts.length === 0) return null;
          return (
            <section key={f.titre} className="encadre" aria-labelledby={`famille-${f.familles[0]}`}>
              <h2 id={`famille-${f.familles[0]}`}>{f.titre}</h2>
              <p className="discret">{f.aide}</p>
              <ul className="gouts">
                {gouts.map((g) => (
                  <LigneGout key={g.cle} gout={g} />
                ))}
              </ul>
            </section>
          );
        })}
        {evites.length > 0 && (
          <section className="encadre" aria-labelledby="evites">
            <h2 id="evites">Ce que vous évitez</h2>
            <p className="discret">Ces traits font baisser une proposition. « Jamais » les exclut complètement.</p>
            <ul className="gouts">
              {evites.map((g) => (
                <LigneGout key={g.cle} gout={g} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
