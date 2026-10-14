import { PageRubrique, type ParamsRubrique } from "../../web/composants/PageRubrique.tsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Séries" };

export default async function Page({ searchParams }: { searchParams: Promise<ParamsRubrique> }) {
  return <PageRubrique rubrique="serie" params={await searchParams} />;
}
