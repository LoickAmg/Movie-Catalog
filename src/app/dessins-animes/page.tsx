import { PageRubrique, type ParamsRubrique } from "../../web/composants/PageRubrique.tsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dessins animés" };

export default async function Page({ searchParams }: { searchParams: Promise<ParamsRubrique> }) {
  return <PageRubrique rubrique="dessin_anime" params={await searchParams} />;
}
