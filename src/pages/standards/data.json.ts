import type { APIRoute } from "astro";
import { getDataset } from "@/lib/data";
import { buildStandardsExport } from "@/lib/standards-export";

export const GET: APIRoute = () =>
  new Response(JSON.stringify(buildStandardsExport(getDataset()), null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
