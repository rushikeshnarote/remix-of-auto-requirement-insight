import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Req = {
  id: string; req_id: string; req_text: string; type: string;
  nfr_subtype: string | null; confidence: number; ambiguity_flags: string[];
  status: string; priority: string; suggested_rewrite: string | null; is_edited: boolean;
};

export default function Dashboard() {
  const { id } = useParams();
  const [doc, setDoc] = useState<any>(null);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: d } = await supabase.from("documents").select("*").eq("id", id).maybeSingle();
      const { data: r } = await supabase.from("requirements").select("*").eq("doc_id", id).order("req_id");
      setDoc(d);
      setReqs((r ?? []) as Req[]);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!doc) return <div className="text-sm text-muted-foreground">Document not found. <Link to="/documents" className="text-primary hover:underline">Back</Link></div>;

  const total = reqs.length;
  const normalizedReqs = reqs.map((r) => ({ ...r, type: normalizeType(r.type) }));
  const functional = normalizedReqs.filter(r => r.type === "Functional").length;
  const nfr = normalizedReqs.filter(r => r.type === "NonFunctional").length;
  const constraint = normalizedReqs.filter(r => r.type === "Constraint").length;
  const ambiguous = normalizedReqs.filter(r => r.status === "Ambiguous" || (r.ambiguity_flags?.length ?? 0) > 0).length;
  const incomplete = normalizedReqs.filter(r => r.status === "Incomplete").length;
  const lowConf = normalizedReqs.filter(r => Number(r.confidence) < 0.5).length;
  const avgConf = total > 0 ? normalizedReqs.reduce((s, r) => s + normalizedConfidence(r.confidence), 0) / total : 0;

  // NFR subtype coverage
  const nfrSubtypes = new Set(normalizedReqs.filter(r => r.type === "NonFunctional" && r.nfr_subtype).map(r => r.nfr_subtype));
  const expectedNfr = ["Performance", "Security", "Usability", "Reliability"];
  const missingNfr = expectedNfr.filter(s => !nfrSubtypes.has(s));

  // Build gap list + health
  const gaps: { label: string; severity: "high" | "med" | "low"; fix: string }[] = [];

  if (total === 0) {
    gaps.push({
      label: "No requirements detected in this document",
      severity: "high",
      fix: "Use modal verbs (shall, must, should, will). Example: \"The system shall allow users to reset their password via email.\"",
    });
  } else {
    if (functional === 0) gaps.push({ label: "No functional requirements", severity: "high", fix: "Describe what the system does — e.g. \"The system shall send a confirmation email after signup.\"" });
    if (nfr === 0) gaps.push({ label: "No non-functional requirements (NFRs)", severity: "high", fix: "Add quality attributes: performance, security, usability, reliability." });
    if (constraint === 0) gaps.push({ label: "No constraints captured", severity: "low", fix: "List technical/business constraints — e.g. \"Must comply with GDPR\" or \"Must run on AWS.\"" });
    missingNfr.forEach(s => {
      const examples: Record<string, string> = {
        Performance: "\"The system shall respond to search queries within 2 seconds under 1000 concurrent users.\"",
        Security: "\"All user passwords shall be hashed using bcrypt with a minimum cost factor of 12.\"",
        Usability: "\"A new user shall be able to complete signup in under 60 seconds without external help.\"",
        Reliability: "\"The system shall maintain 99.9% uptime measured monthly.\"",
      };
      gaps.push({ label: `Missing ${s} NFR`, severity: "med", fix: `Add a ${s.toLowerCase()} requirement. Example: ${examples[s]}` });
    });
    if (ambiguous > 0) gaps.push({ label: `${ambiguous} ambiguous requirement${ambiguous > 1 ? "s" : ""}`, severity: "med", fix: "Replace vague words (fast, easy, user-friendly) with measurable criteria." });
    if (incomplete > 0) gaps.push({ label: `${incomplete} incomplete requirement${incomplete > 1 ? "s" : ""}`, severity: "high", fix: "Add an actor (who) and an action (what). Format: \"The [actor] shall [action] [criteria].\"" });
    if (lowConf > 0) gaps.push({ label: `${lowConf} low-confidence requirement${lowConf > 1 ? "s" : ""}`, severity: "med", fix: "Rewrite using active voice and explicit subjects." });
    if (avgConf < 0.7) gaps.push({ label: `Average confidence is low (${(avgConf * 100).toFixed(0)}%)`, severity: "med", fix: "Tighten language across the document — prefer \"shall\" + measurable outcomes." });
  }

  // Health: score the uploaded document proportionally instead of subtracting every gap to zero.
  const typeCoverage = ([functional, nfr, constraint].filter(Boolean).length / 3) * 100;
  const nfrCoverage = ((expectedNfr.length - missingNfr.length) / expectedNfr.length) * 100;
  const clarityScore = total > 0
    ? Math.max(0, 100 - (ambiguous / total) * 35 - (incomplete / total) * 45 - (lowConf / total) * 25)
    : 0;
  const healthRaw = avgConf * 100 * 0.45 + clarityScore * 0.25 + typeCoverage * 0.2 + nfrCoverage * 0.1;
  const criticalPenalty = total > 0 && functional === 0 ? 15 : 0;
  const health = total === 0 ? 0 : Math.max(10, Math.min(100, Math.round(healthRaw - criticalPenalty)));

  const healthColor = health >= 75 ? "text-[hsl(var(--confidence-high))]" : health >= 50 ? "text-[hsl(var(--confidence-mid))]" : "text-[hsl(var(--confidence-low))]";

  return (
    <div>
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <Link to="/documents" className="text-xs text-muted-foreground hover:text-foreground">← My Documents</Link>
          <h1 className="text-xl font-semibold mt-1">{doc.name}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Analyzed {new Date(doc.upload_time).toLocaleString()}</p>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-3 mb-6">
        {[
          ["Total", total], ["Functional", functional], ["Non-Functional", nfr],
          ["Constraints", constraint], ["Ambiguous", ambiguous], ["Avg Confidence", `${(avgConf * 100).toFixed(0)}%`],
        ].map(([label, val]) => (
          <div key={label as string} className="border border-border rounded bg-card p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-lg font-semibold mt-0.5">{val}</div>
          </div>
        ))}
        <div className="border border-border rounded bg-card p-3">
          <div className="text-xs text-muted-foreground">Health Score</div>
          <div className={`text-lg font-semibold mt-0.5 ${healthColor}`}>
            {health}/100
          </div>
        </div>
      </div>

      {/* Gaps & recommendations */}
      <div className="border border-border rounded bg-card p-5 mb-6">
        <h2 className="text-sm font-semibold mb-1">What this document lacks</h2>
        <p className="text-xs text-muted-foreground mb-4">
          {gaps.length === 0
            ? "Looks solid — no major gaps detected."
            : `${gaps.length} issue${gaps.length > 1 ? "s" : ""} found. Address these to upgrade your requirements quality.`}
        </p>
        {doc.status === "failed" && (
          <div className="text-xs mb-3 text-[hsl(var(--confidence-low))]">
            Analysis failed: {doc.error_message ?? "unknown error"}
          </div>
        )}
        <ul className="space-y-3">
          {gaps.map((g, i) => (
            <li key={i} className="flex gap-3">
              <span className={`mt-0.5 text-[10px] uppercase font-medium px-1.5 py-0.5 rounded shrink-0 ${
                g.severity === "high" ? "bg-[hsl(var(--confidence-low))]/15 text-[hsl(var(--confidence-low))]" :
                g.severity === "med" ? "bg-[hsl(var(--confidence-mid))]/15 text-[hsl(var(--confidence-mid))]" :
                "bg-secondary text-muted-foreground"
              }`}>{g.severity}</span>
              <div>
                <div className="text-sm font-medium">{g.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{g.fix}</div>
              </div>
            </li>
          ))}
        </ul>
        {total === 0 && (
          <div className="mt-5 pt-4 border-t border-border">
            <div className="text-sm font-medium mb-1">How to upgrade</div>
            <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
              <li>Re-upload after rewriting vague statements as testable rules.</li>
              <li>Cover all four NFR categories: Performance, Security, Usability, Reliability.</li>
              <li>Always name the actor (user, admin, system) and the measurable outcome.</li>
            </ol>
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="border border-border rounded bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 border-b border-border">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Requirement</th>
                <th className="px-3 py-2 font-medium">Confidence</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {reqs.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{r.req_id}</td>
                  <td className="px-3 py-2"><TypeBadge type={r.type} /></td>
                  <td className="px-3 py-2">{r.req_text}</td>
                  <td className="px-3 py-2"><ConfBadge v={Number(r.confidence)} /></td>
                  <td className="px-3 py-2 text-xs">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const normalizedType = normalizeType(type);
  const map: Record<string, string> = {
    Functional: "bg-[hsl(var(--type-functional-bg))] text-[hsl(var(--type-functional))]",
    NonFunctional: "bg-[hsl(var(--type-nonfunctional-bg))] text-[hsl(var(--type-nonfunctional))]",
    Constraint: "bg-[hsl(var(--type-constraint-bg))] text-[hsl(var(--type-constraint))]",
  };
  return <span className={`text-xs px-2 py-0.5 rounded ${map[normalizedType] ?? "bg-secondary text-muted-foreground"}`}>{normalizedType}</span>;
}
function ConfBadge({ v }: { v: number }) {
  const confidence = normalizedConfidence(v);
  const pct = Math.round(confidence * 100);
  const color = confidence >= 0.75 ? "text-[hsl(var(--confidence-high))]" : confidence >= 0.5 ? "text-[hsl(var(--confidence-mid))]" : "text-[hsl(var(--confidence-low))]";
  return <span className={`text-xs font-medium ${color}`}>{pct}%</span>;
}

function normalizeType(type: string | null | undefined) {
  const compact = String(type ?? "Unknown").toLowerCase().replace(/[^a-z]/g, "");
  if (compact === "functional") return "Functional";
  if (compact === "nonfunctional" || compact === "nfr") return "NonFunctional";
  if (compact === "constraint") return "Constraint";
  return "Unknown";
}

function normalizedConfidence(value: number | string | null | undefined) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric > 1 ? numeric / 100 : numeric));
}
