import { CeSoir } from "../../web/decision/CeSoir.tsx";

export const metadata = {
  title: "Ce soir",
  description: "Trois propositions pour ce soir, selon votre temps, votre envie et vos goûts, avec la raison de chaque choix.",
};

export default function PageCeSoir() {
  return (
    <section className="section">
      <p className="surtitre">Ce soir</p>
      <h1>Que regarder ce soir ?</h1>
      <p className="discret" style={{ maxWidth: "60ch" }}>
        Trois questions, trois propositions. Chacune vient avec sa raison ; une d'elles vous fera sortir de vos habitudes.
      </p>
      <CeSoir />
    </section>
  );
}
