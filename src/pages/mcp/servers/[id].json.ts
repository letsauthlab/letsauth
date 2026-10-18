import type { APIRoute } from "astro";
import { getDataset } from "@/lib/data";
import { buildServerExport } from "@/lib/export";

export function getStaticPaths() {
  return getDataset()
    .servers.filter((s) => !s.withdrawn)
    .map((s) => ({ params: { id: s.id } }));
}

export const GET: APIRoute = ({ params }) =>
  new Response(JSON.stringify(buildServerExport(getDataset(), params.id as string), null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
