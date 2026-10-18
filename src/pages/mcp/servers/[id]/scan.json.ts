import type { APIRoute } from "astro";
import { getDataset } from "@/lib/data";
import { latestScan, reportFromView } from "@/lib/scanner";

export function getStaticPaths() {
  return getDataset()
    .servers.filter((s) => !s.withdrawn)
    .map((server) => ({ params: { id: server.id }, props: { server } }));
}

export const GET: APIRoute = ({ props }) => {
  const data = getDataset();
  const report = reportFromView(latestScan(data, props.server), new Date().toISOString());
  return new Response(JSON.stringify(report, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
