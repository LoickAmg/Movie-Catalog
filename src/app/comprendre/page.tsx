import { LIBELLES_TYPE, TYPES_FICHE } from "../../savoir/fiches.ts";
import { CarteFiche } from "../../web/composants/Savoir.tsx";
import { fiches } from "../../web/serveur.ts";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Comprendre",
  description: "Des fiches courtes pour comprendre un terme, un genre ou une différence : seinen, donghua, OVA, fantasy ou fantastique…",
};

export default async function Comprendre() {
  const toutes = await fiches();
  return (
    <section className="section">
      <p className="surtitre">Fiches Savoir</p>
      <h1>Comprendre</h1>
      <p className="discret" style={{ maxWidth: "60ch" }}>
        Un mot inconnu sur une fiche ? Une différence qui vous échappe ? Chaque fiche se lit en une minute, avec des œuvres pour comprendre.
      </p>
      {TYPES_FICHE.map((type) => {
        const liste = toutes.filter((f) => f.type === type);
        if (liste.length === 0) return null;
        return (
          <section key={type} className="section" aria-labelledby={`type-${type}`}>
            <h2 id={`type-${type}`}>{LIBELLES_TYPE[type]}s</h2>
            <div className="fiches">
              {liste.map((f) => (
                <CarteFiche key={f.slug} fiche={f} />
              ))}
            </div>
          </section>
        );
      })}
    </section>
  );
}
