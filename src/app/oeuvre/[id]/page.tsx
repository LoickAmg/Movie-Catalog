import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { oeuvreDetaillee, type OeuvreDetaillee } from "../../../catalogue/lecture.ts";
import { badgeAnime } from "../../../domain/classification.ts";
import { accentLisible, encreSur } from "../../../domain/couleur.ts";
import { normaliserTitre } from "../../../domain/texte.ts";
import type { EspaceId } from "../../../domain/types.ts";
import { ficheDuConcept, type FicheSavoir } from "../../../savoir/fiches.ts";
import { Carte } from "../../../web/composants/Cartes.tsx";
import { Jaquette } from "../../../web/composants/Jaquette.tsx";
import { Etiquette } from "../../../web/composants/Savoir.tsx";
import {
  BADGES_UI,
  DEMOGRAPHIES_UI,
  FORMATS_UI,
  RELATIONS_UI,
  SOURCES_UI,
  formaterDuree,
  lienExterne,
  nomLangue,
  nomPays,
  rubriqueUI,
} from "../../../web/libelles.ts";
import { base, fiches } from "../../../web/serveur.ts";

export const dynamic = "force-dynamic";

type Params = { id: string };

/** Fonds du thème par défaut (globals.css), pour corriger la couleur de l'œuvre. */
const FOND_SOMBRE = "#0f0e0c";
const FOND_CLAIR = "#f6f1e8";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const oeuvre = await oeuvreDetaillee(await base(), (await params).id);
  if (!oeuvre) return { title: "Œuvre introuvable" };
  const resume = oeuvre.synopsis[0]?.texte.slice(0, 160);
  return {
    title: oeuvre.annee ? `${oeuvre.titre} (${oeuvre.annee})` : oeuvre.titre,
    description: resume ?? `${rubriqueUI(oeuvre.rubrique).singulier} : fiche, saisons et liens.`,
    openGraph: oeuvre.affiche ? { images: [oeuvre.affiche] } : undefined,
  };
}

function styleTheme(oeuvre: OeuvreDetaillee): { style: CSSProperties; actif: boolean } {
  const sombre = oeuvre.couleur ? accentLisible(oeuvre.couleur, FOND_SOMBRE) : null;
  const clair = oeuvre.couleur ? accentLisible(oeuvre.couleur, FOND_CLAIR) : null;
  const style: Record<string, string> = {};
  if (oeuvre.banniere) style["--banniere"] = `url("${oeuvre.banniere.replace(/"/g, "%22")}")`;
  if (sombre && clair) {
    Object.assign(style, {
      "--accent-oeuvre-sombre": sombre,
      "--accent-ink-oeuvre-sombre": encreSur(sombre),
      "--accent-oeuvre-clair": clair,
      "--accent-ink-oeuvre-clair": encreSur(clair),
    });
  }
  return { style: style as CSSProperties, actif: Boolean(sombre && clair) };
}

function etiquettes(oeuvre: OeuvreDetaillee, toutesFiches: FicheSavoir[]) {
  const liste: Array<{ libelle: string; concept: string; forte?: boolean }> = [];
  const badge = oeuvre.rubrique === "anime" ? badgeAnime(oeuvre.origines) : null;
  liste.push({ libelle: rubriqueUI(oeuvre.rubrique).singulier, concept: `rubrique_${oeuvre.rubrique}`, forte: true });
  if (badge) liste.push({ libelle: BADGES_UI[badge], concept: `badge_${badge}` });
  if (oeuvre.format !== "film" && oeuvre.format !== "serie") liste.push({ libelle: FORMATS_UI[oeuvre.format], concept: `format_${oeuvre.format}` });
  if (oeuvre.demographie) liste.push({ libelle: DEMOGRAPHIES_UI[oeuvre.demographie], concept: `demographie_${oeuvre.demographie}` });
  for (const c of oeuvre.concepts) if (c.type === "genre" && c.libelle) liste.push({ libelle: c.libelle, concept: c.slug });
  return liste.map((e) => ({ ...e, fiche: ficheDuConcept(toutesFiches, e.concept) }));
}

export default async function PageOeuvre({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const [oeuvre, toutesFiches] = await Promise.all([oeuvreDetaillee(await base(), id), fiches()]);
  if (!oeuvre) notFound();

  const ui = rubriqueUI(oeuvre.rubrique);
  const theme = styleTheme(oeuvre);
  // Titre original, romanisé et anglais seulement : les traductions dans d'autres langues n'aident pas ici.
  const vus = new Set([normaliserTitre(oeuvre.titre)]);
  const autresTitres = oeuvre.titres
    .filter((t) => t.type === "original" || t.type === "romaji" || (t.type === "officiel" && (t.langue === "en" || t.langue === "mul")))
    .map((t) => t.valeur)
    .filter((v) => {
      const cle = normaliserTitre(v.replace(/\s*\([^)]*\)$/, ""));
      if (vus.has(cle)) return false;
      vus.add(cle);
      return true;
    })
    .slice(0, 3);
  const duree = formaterDuree(oeuvre.duree_min, oeuvre.format);
  const episodes = oeuvre.parties.reduce((n, p) => n + (p.episodes ?? 0), 0);
  const credits = (role: string) => oeuvre.credits.filter((c) => c.role === role).map((c) => c.nom);
  const synopsis = oeuvre.synopsis[0];
  // Un lien par site : pour une œuvre à plusieurs saisons, celui de la première.
  const liens = Array.from(
    new Map(
      oeuvre.parties
        .map((p) => p.cle.split(":") as [string, string])
        .concat(oeuvre.identifiants.map((i) => [i.espace, i.valeur]))
        .map(([espace, valeur]) => lienExterne(espace as EspaceId, valeur))
        .filter((l): l is { nom: string; url: string } => l !== null)
        .reverse()
        .map((l) => [l.nom, l] as const),
    ).values(),
  ).sort((a, b) => a.nom.localeCompare(b.nom));
  const sourcesUtilisees = Array.from(new Set(Object.values(oeuvre.provenance).map((p) => p.source)));

  return (
    <article className="theme-oeuvre" data-accent={theme.actif ? "" : undefined} style={theme.style}>
      <header className="oeuvre-hero">
        <div className="oeuvre-grille">
          <Jaquette titre={oeuvre.titre} affiche={oeuvre.affiche} rubrique={oeuvre.rubrique} annee={oeuvre.annee} grande prioritaire />
          <div>
            <p className="surtitre">
              <Link href={ui.chemin}>{ui.libelle}</Link>
            </p>
            <h1>{oeuvre.titre}</h1>
            {autresTitres.length > 0 && <p className="titres-autres">{autresTitres.join(" · ")}</p>}
            <ul className="faits">
              {oeuvre.annee && <li>{oeuvre.annee}</li>}
              {oeuvre.origines.length > 0 && <li>{oeuvre.origines.map(nomPays).join(", ")}</li>}
              {duree && <li>{duree}</li>}
              {oeuvre.parties.length > 1 && <li>{oeuvre.parties.length} saisons ou parties</li>}
              {episodes > 0 && <li>{episodes} épisodes</li>}
            </ul>
            <div className="etiquettes">
              {etiquettes(oeuvre, toutesFiches).map((e, i) => (
                <Etiquette key={`${e.concept}-${i}`} libelle={e.libelle} fiche={e.fiche} forte={e.forte} idUnique={`${i}`} />
              ))}
            </div>
            {synopsis && (
              <>
                <p className="synopsis">{synopsis.texte}</p>
                <p className="note-source">
                  Synopsis {synopsis.langue === "fr" ? "" : `en ${nomLangue(synopsis.langue)} `}· source : {SOURCES_UI[synopsis.source]?.nom ?? synopsis.source}
                  {synopsis.langue !== "fr" && " · la version française arrivera avec une nouvelle source"}
                </p>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="colonnes">
        <div>
          {oeuvre.parties.length > 1 && (
            <section className="section" aria-labelledby="parties">
              <h2 id="parties">Saisons et parties</h2>
              <ol className="parties">
                {oeuvre.parties.map((p) => (
                  <li key={p.cle}>
                    <span>{p.titre}</span>
                    <span className="discret">
                      {[FORMATS_UI[p.format], p.annee, p.episodes ? `${p.episodes} ép.` : null].filter(Boolean).join(" · ")}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {oeuvre.relations.length > 0 && (
            <section className="section" aria-labelledby="liees">
              <h2 id="liees">Œuvres liées</h2>
              <div className="grille">
                {oeuvre.relations.slice(0, 12).map((r) => (
                  <div key={`${r.type}-${r.oeuvre.id}`}>
                    <p className="surtitre">{RELATIONS_UI[r.type]}</p>
                    <Carte carte={r.oeuvre} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="encadre" aria-labelledby="fiche-technique">
          <h2 id="fiche-technique">Fiche</h2>
          <dl>
            <dt>Format</dt>
            <dd>{FORMATS_UI[oeuvre.format]}</dd>
            {credits("realisation").length > 0 && (
              <>
                <dt>Réalisation</dt>
                <dd>{credits("realisation").join(", ")}</dd>
              </>
            )}
            {credits("creation").length > 0 && (
              <>
                <dt>Création</dt>
                <dd>{credits("creation").join(", ")}</dd>
              </>
            )}
            {credits("studio").length > 0 && (
              <>
                <dt>Studio</dt>
                <dd>{credits("studio").slice(0, 4).join(", ")}</dd>
              </>
            )}
            {oeuvre.titres
              .filter((t) => t.type === "original" || t.type === "romaji")
              .slice(0, 2)
              .map((t) => (
                <div key={t.valeur} style={{ display: "contents" }}>
                  <dt>Titre {t.type === "romaji" ? "romanisé" : "original"}</dt>
                  <dd lang={t.langue ?? undefined}>{t.valeur}</dd>
                </div>
              ))}
          </dl>
          {liens.length > 0 && (
            <>
              <h3 style={{ marginTop: 20 }}>Ailleurs</h3>
              <ul className="liens-externes">
                {liens.map((l) => (
                  <li key={l.url}>
                    <a className="etiquette" href={l.url} rel="noopener noreferrer" target="_blank">
                      {l.nom}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="note-source" style={{ marginTop: 16 }}>
            Sources de cette fiche : {sourcesUtilisees.map((s) => SOURCES_UI[s]?.nom ?? s).join(", ")}.
          </p>
        </aside>
      </div>
    </article>
  );
}
