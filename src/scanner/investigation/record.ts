import { crossCheck, type Dataset } from "../../lib/data";
import { type Observation, observationSchema } from "../../schema";
import { citations, digest, endpoint, type Report, redact } from "./model";

export function observation(
  data: Dataset,
  input: {
    server: string;
    feature: string;
    status: string;
    by: string;
    evidence: string;
    revision?: string;
    at?: string;
    report?: Report;
  },
): Observation {
  const evidence = input.evidence.trim();
  if (evidence.length < 20 || evidence.length > 12_000)
    throw new Error(
      "evidence note must have 20–12000 characters describing procedure, result and limitations",
    );
  if (redact(evidence) !== evidence)
    throw new Error(
      "evidence contains a credential pattern or control character; redact the note before recording",
    );
  const citation = citations(data, input.feature, input.revision)[0];
  if (!citation) throw new Error("feature citation is required");
  const report = input.report;
  const server = data.servers.find((s) => s.id === input.server);
  // URL investigations may precede adding the server to the atlas. Bind those reports to
  // the exact resource endpoint; an AS registration endpoint cannot establish this mapping.
  const matchesServer =
    report &&
    server &&
    (report.server === input.server ||
      (!report.server && report.recipe !== "dcr" && endpoint(server.url) === report.target));
  if (
    report &&
    (!matchesServer ||
      !report.citations.some(
        (c) =>
          c.feature === input.feature &&
          c.spec === citation.spec &&
          c.revision === citation.revision,
      ))
  )
    throw new Error("report does not cite this server, feature and revision");
  const entry = observationSchema.parse({
    server: input.server,
    feature: input.feature,
    status: input.status,
    method: "manual",
    observedBy: input.by,
    observedAt: input.at ?? report?.completedAt ?? new Date().toISOString(),
    evidence: `${evidence}${report ? ` [investigation ${report.runner}; report sha256:${digest(report)}; ${report.startedAt}–${report.completedAt}]` : ""}`,
    revision: { spec: citation.spec, revision: citation.revision },
  });
  const issues = crossCheck({ ...data, observations: [...data.observations, entry] });
  if (issues.length) throw new Error(issues.map((i) => `${i.path}: ${i.message}`).join("\n"));
  if (Date.parse(entry.observedAt) > Date.now())
    throw new Error("observation timestamp is in the future");
  if (data.observations.some((o) => digest(o) === digest(entry)))
    throw new Error("identical observation already exists");
  return entry;
}
