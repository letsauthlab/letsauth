import type { APIRoute } from "astro";
import { getDataset } from "@/lib/data";
import { buildExport } from "@/lib/export";

export const GET: APIRoute = () =>
  new Response(JSON.stringify(buildExport(getDataset()), null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
