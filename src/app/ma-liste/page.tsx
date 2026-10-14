import { MaListe } from "../../web/suivi/MaListe.tsx";

export const metadata = { title: "Ma liste", robots: { index: false } };

export default function PageMaListe() {
  return (
    <section className="section">
      <p className="surtitre">Mon suivi</p>
      <h1>Ma liste</h1>
      <p className="discret" style={{ maxWidth: "62ch" }}>
        Ce que vous regardez, avez vu ou voulez voir. Tout est enregistré dans ce navigateur, sans compte : pensez à sauvegarder votre liste de
        temps en temps.
      </p>
      <MaListe />
    </section>
  );
}
