import type { DocumentLegal } from "../legal.ts";

export function PageLegale({ document }: { document: DocumentLegal }) {
  return (
    <article className="section prose">
      <p className="surtitre">Informations</p>
      <h1>{document.titre}</h1>
      {document.maj && <p className="discret">{document.maj}</p>}
      {document.sections.map((s) => (
        <section key={s.titre}>
          <h2>{s.titre}</h2>
          {s.paragraphes.map((p) => (
            <p key={p.slice(0, 40)}>{p}</p>
          ))}
        </section>
      ))}
    </article>
  );
}
