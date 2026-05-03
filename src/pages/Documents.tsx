import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Eye } from "lucide-react";
import { toast } from "sonner";

type Doc = { id: string; name: string; upload_time: string; status: string; req_count: number };

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("documents")
      .select("id, name, upload_time, status, requirements(count)")
      .order("upload_time", { ascending: false });
    if (error) { toast.error(error.message); setLoading(false); return; }
    setDocs((data ?? []).map((d: any) => ({
      id: d.id, name: d.name, upload_time: d.upload_time, status: d.status,
      req_count: d.requirements?.[0]?.count ?? 0,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const del = async (id: string) => {
    if (!confirm("Delete this document and all its requirements?")) return;
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">My Documents</h1>
        <p className="text-sm text-muted-foreground mt-1"><span className="text-accent">// </span>All previously analyzed documents</p>
      </header>

      {/* Desktop table */}
      <div className="hidden md:block glass-panel rounded-lg overflow-hidden neon-border-cyan">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 border-b border-border">
            <tr className="text-left text-xs uppercase tracking-wider text-accent">
              <th className="px-4 py-3 font-medium">Document Name</th>
              <th className="px-4 py-3 font-medium">Upload Date</th>
              <th className="px-4 py-3 font-medium">Requirements</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">Loading…</td></tr>
            ) : docs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                No documents yet. <Link to="/" className="text-primary hover:text-accent transition-colors">Upload one</Link>.
              </td></tr>
            ) : docs.map((d) => (
              <tr key={d.id} className="border-b border-border last:border-0 hover:bg-primary/5 transition-colors">
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(d.upload_time).toLocaleString()}</td>
                <td className="px-4 py-3 text-accent font-mono">{d.req_count}</td>
                <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Link to={`/documents/${d.id}`} className="p-1.5 rounded hover:bg-accent/20 text-accent hover:shadow-[0_0_10px_hsl(var(--accent)/0.5)] transition-all" title="View">
                      <Eye className="w-4 h-4" />
                    </Link>
                    <button onClick={() => del(d.id)} className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="text-center text-muted-foreground text-sm py-8">Loading…</div>
        ) : docs.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8 glass-panel rounded-lg">
            No documents yet. <Link to="/" className="text-primary">Upload one</Link>.
          </div>
        ) : docs.map((d) => (
          <div key={d.id} className="glass-panel rounded-lg p-4 neon-border-cyan">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="font-medium text-sm break-all">{d.name}</div>
              <StatusBadge status={d.status} />
            </div>
            <div className="text-xs text-muted-foreground mb-3">{new Date(d.upload_time).toLocaleString()}</div>
            <div className="flex items-center justify-between">
              <div className="text-xs"><span className="text-muted-foreground">Requirements:</span> <span className="text-accent font-mono">{d.req_count}</span></div>
              <div className="flex gap-2">
                <Link to={`/documents/${d.id}`} className="p-2 rounded bg-accent/10 text-accent">
                  <Eye className="w-4 h-4" />
                </Link>
                <button onClick={() => del(d.id)} className="p-2 rounded bg-destructive/10 text-destructive">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === "completed"
    ? "bg-[hsl(var(--confidence-high))]/15 text-[hsl(var(--confidence-high))] border border-[hsl(var(--confidence-high))]/30"
    : status === "failed"
    ? "bg-destructive/15 text-destructive border border-destructive/30"
    : "bg-accent/15 text-accent border border-accent/30";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-md font-medium uppercase tracking-wider ${cls}`}>
      {status === "completed" ? "Completed" : status === "failed" ? "Failed" : "Processing"}
    </span>
  );
}
