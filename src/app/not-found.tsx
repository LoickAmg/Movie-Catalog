import Link from "next/link";

export default function Introuvable() {
  return (
    <section className="section">
      <p className="surtitre">Erreur 404</p>
      <h1>Rien à l'affiche ici</h1>
      <p className="discret">Cette page n'existe pas, ou plus. L'œuvre a peut-être changé d'adresse lors d'une mise à jour du catalogue.</p>
      <p>
        <Link href="/" className="bouton bouton-principal">
          Retour à l'accueil
        </Link>
      </p>
    </section>
  );
}
