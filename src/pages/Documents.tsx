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
        <h1 className="text-xl font-semibold">My Documents</h1>
        <p className="text-sm text-muted-foreground mt-1">All previously analyzed documents.</p>
      </header>

      <div className="border border-border rounded bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 border-b border-border">
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Document Name</th>
              <th className="px-4 py-2.5 font-medium">Upload Date</th>
              <th className="px-4 py-2.5 font-medium">Total Requirements</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">Loading…</td></tr>
            ) : docs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                No documents yet. <Link to="/" className="text-primary hover:underline">Upload one</Link>.
              </td></tr>
            ) : docs.map((d) => (
              <tr key={d.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                <td className="px-4 py-2.5 font-medium">{d.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{new Date(d.upload_time).toLocaleString()}</td>
                <td className="px-4 py-2.5">{d.req_count}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    d.status === "completed" ? "bg-[hsl(var(--type-functional-bg))] text-[hsl(var(--type-functional))]"
                    : d.status === "failed" ? "bg-destructive/10 text-destructive"
                    : "bg-secondary text-muted-foreground"
                  }`}>
                    {d.status === "completed" ? "Completed" : d.status === "failed" ? "Failed" : "Processing"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-2">
                    <Link to={`/documents/${d.id}`} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="View Results">
                      <Eye className="w-4 h-4" />
                    </Link>
                    <button onClick={() => del(d.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
