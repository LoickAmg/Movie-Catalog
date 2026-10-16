import { PageLegale } from "../../web/composants/PageLegale.tsx";
import { pageContact } from "../../web/legal.ts";

// Lu à chaque requête : l'identité de l'éditeur vient de l'environnement.
export const dynamic = "force-dynamic";
export const metadata = { title: "Contact" };

export default function Page() {
  return <PageLegale document={pageContact()} />;
}
