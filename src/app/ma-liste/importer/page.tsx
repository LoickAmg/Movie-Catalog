import Link from "next/link";
import { Importer } from "../../../web/suivi/Importer.tsx";

export const metadata = { title: "Importer mon historique", robots: { index: false } };

export default function PageImporter() {
  return (
    <section className="section">
      <p className="surtitre">
        <Link href="/ma-liste">Ma liste</Link>
      </p>
      <h1>Importer mon historique</h1>
      <p className="discret" style={{ maxWidth: "62ch" }}>
        Vous tenez déjà une liste ailleurs ? Retrouvez-la ici en quelques secondes. Vous verrez un aperçu avant que quoi que ce soit ne soit
        ajouté.
      </p>
      <Importer />
    </section>
  );
}
