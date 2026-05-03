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
  const functional = reqs.filter(r => r.type === "Functional").length;
  const nfr = reqs.filter(r => r.type === "NonFunctional").length;
  const constraint = reqs.filter(r => r.type === "Constraint").length;
  const ambiguous = reqs.filter(r => r.status === "Ambiguous" || (r.ambiguity_flags?.length ?? 0) > 0).length;
  const incomplete = reqs.filter(r => r.status === "Incomplete").length;
  const lowConf = reqs.filter(r => r.confidence < 0.5).length;
  const avgConf = total > 0 ? reqs.reduce((s, r) => s + Number(r.confidence), 0) / total : 0;
  const health = Math.max(0, Math.round(100 - (ambiguous * 5) - (incomplete * 7) - (lowConf * 4)));

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
          <div className={`text-lg font-semibold mt-0.5 ${health >= 75 ? "text-[hsl(var(--confidence-high))]" : health >= 50 ? "text-[hsl(var(--confidence-mid))]" : "text-[hsl(var(--confidence-low))]"}`}>
            {health}/100
          </div>
        </div>
      </div>

      <div className="border border-border rounded bg-card p-6 text-sm text-muted-foreground">
        Full requirements table, filters, inline editing, Improve modal, and Excel/PDF exports come in Phase 2.
        {total === 0 && (
          <div className="mt-3 text-foreground">
            {doc.status === "failed" ? `Analysis failed: ${doc.error_message ?? "unknown error"}` : "No requirements were extracted from this document."}
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="mt-6 border border-border rounded bg-card overflow-hidden">
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
  const map: Record<string, string> = {
    Functional: "bg-[hsl(var(--type-functional-bg))] text-[hsl(var(--type-functional))]",
    NonFunctional: "bg-[hsl(var(--type-nonfunctional-bg))] text-[hsl(var(--type-nonfunctional))]",
    Constraint: "bg-[hsl(var(--type-constraint-bg))] text-[hsl(var(--type-constraint))]",
  };
  return <span className={`text-xs px-2 py-0.5 rounded ${map[type] ?? "bg-secondary text-muted-foreground"}`}>{type}</span>;
}
function ConfBadge({ v }: { v: number }) {
  const pct = Math.round(v * 100);
  const color = v >= 0.75 ? "text-[hsl(var(--confidence-high))]" : v >= 0.5 ? "text-[hsl(var(--confidence-mid))]" : "text-[hsl(var(--confidence-low))]";
  return <span className={`text-xs font-medium ${color}`}>{pct}%</span>;
}
