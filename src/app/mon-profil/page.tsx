import { MonProfil } from "../../web/decision/MonProfil.tsx";

export const metadata = { title: "Mes goûts", robots: { index: false } };

export default function PageProfil() {
  return (
    <section className="section">
      <p className="surtitre">Mon profil</p>
      <h1>Mes goûts</h1>
      <p className="discret" style={{ maxWidth: "62ch" }}>
        Voici ce que le guide a compris de vous, et pourquoi. Rien n'est caché : chaque goût vient d'œuvres que vous avez suivies.
      </p>
      <MonProfil />
    </section>
  );
}
