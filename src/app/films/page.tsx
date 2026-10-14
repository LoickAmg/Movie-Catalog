import { PageRubrique, type ParamsRubrique } from "../../web/composants/PageRubrique.tsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Films" };

export default async function Page({ searchParams }: { searchParams: Promise<ParamsRubrique> }) {
  return <PageRubrique rubrique="film" params={await searchParams} />;
}
