import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { oeuvresParCles } from "../../../catalogue/lecture.ts";
import { LIBELLES_TYPE } from "../../../savoir/fiches.ts";
import { Grille } from "../../../web/composants/Cartes.tsx";
import { AvertissementBrouillon, CarteFiche, Markdown } from "../../../web/composants/Savoir.tsx";
import { base, fiches } from "../../../web/serveur.ts";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const fiche = (await fiches()).find((f) => f.slug === slug);
  return fiche ? { title: fiche.titre, description: fiche.accroche } : { title: "Fiche introuvable" };
}

export default async function PageFiche({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const toutes = await fiches();
  const fiche = toutes.find((f) => f.slug === slug);
  if (!fiche) notFound();
  const oeuvres = await oeuvresParCles(await base(), fiche.oeuvres);
  const liees = fiche.liees.map((s) => toutes.find((f) => f.slug === s)).filter((f) => f !== undefined);

  return (
    <article className="section">
      <p className="surtitre">
        <Link href="/comprendre">Comprendre</Link> · {LIBELLES_TYPE[fiche.type]}
      </p>
      <h1>{fiche.titre}</h1>
      <p className="discret" style={{ fontSize: "1.15rem" }}>
        {fiche.accroche}
      </p>
      <AvertissementBrouillon fiche={fiche} />
      <Markdown texte={fiche.carte} className="prose carte-savoir" />
      {fiche.plus && (
        <section aria-label="En savoir plus">
          <Markdown texte={fiche.plus} className="prose" />
        </section>
      )}

      {oeuvres.length > 0 && (
        <section className="section" aria-labelledby="pour-comprendre">
          <h2 id="pour-comprendre">{fiche.type === "parcours" ? "Le parcours" : "Pour comprendre"}</h2>
          <Grille cartes={oeuvres} />
        </section>
      )}

      {liees.length > 0 && (
        <section className="section" aria-labelledby="fiches-liees">
          <h2 id="fiches-liees">Fiches liées</h2>
          <div className="fiches">
            {liees.map((f) => (
              <CarteFiche key={f.slug} fiche={f} />
            ))}
          </div>
        </section>
      )}

      <footer className="note-source">
        Sources :{" "}
        {fiche.sources.map((s, i) => (
          <span key={s.url}>
            {i > 0 && ", "}
            <a href={s.url} rel="noopener noreferrer">
              {s.titre}
            </a>
          </span>
        ))}
        . Texte original, rédigé pour ce guide.
      </footer>
    </article>
  );
}
