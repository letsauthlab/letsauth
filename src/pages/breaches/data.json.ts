import type { APIRoute } from "astro";
import { buildBreachesExport } from "@/lib/breaches";
import { getDataset } from "@/lib/data";

export const GET: APIRoute = () =>
  new Response(JSON.stringify(buildBreachesExport(getDataset()), null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
