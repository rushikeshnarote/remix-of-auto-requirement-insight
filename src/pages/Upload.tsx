import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileText, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STAGES = ["Parsing", "Extracting", "Validating"] as const;

export default function UploadPage() {
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [usePaste, setUsePaste] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(-1);

  const onFile = (f: File | null) => {
    if (!f) return;
    const ok = f.type === "application/pdf" || f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || /\.(pdf|docx)$/i.test(f.name);
    if (!ok) { toast.error("Only PDF and DOCX files are supported"); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error("File exceeds 10MB limit"); return; }
    setFile(f);
  };

  const analyze = async () => {
    if (!file && !text.trim()) { toast.error("Provide a file or paste text"); return; }
    setBusy(true);
    setStage(0);

    const fd = new FormData();
    fd.append("name", name.trim() || (file?.name ?? "Pasted Text"));
    if (file) fd.append("file", file);
    else fd.append("text", text);

    // Walk through visible stages while the request runs
    const stageTimer = setInterval(() => setStage((s) => (s < 2 ? s + 1 : s)), 1500);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-requirements`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: fd,
      });
      const data = await resp.json();
      clearInterval(stageTimer);
      if (!resp.ok) {
        toast.error(data.error ?? "Analysis failed");
        setBusy(false);
        setStage(-1);
        return;
      }
      setStage(3);
      toast.success(`Extracted ${data.count} requirements`);
      setTimeout(() => nav(`/documents/${data.doc_id}`), 600);
    } catch (e: any) {
      clearInterval(stageTimer);
      toast.error(e.message ?? "Network error");
      setBusy(false);
      setStage(-1);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">AutoReq — Requirements Extraction</h1>
        <p className="text-sm text-muted-foreground mt-2">
          <span className="text-accent">// </span>
          Upload stakeholder docs. Extract clean, IEEE 830 compliant requirements automatically.
        </p>
      </header>

      <div className="glass-panel rounded-lg p-4 sm:p-6 space-y-5 neon-border-cyan">
        <div>
          <label className="block text-xs font-medium mb-1.5 text-accent uppercase tracking-wider">Document Name <span className="text-muted-foreground font-normal normal-case">(optional)</span></label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sprint 3 Stakeholder Notes"
            className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {!usePaste ? (
          <div>
            <label className="block text-xs font-medium mb-1.5 text-accent uppercase tracking-wider">Document</label>
            <label
              htmlFor="file-input"
              className="flex flex-col items-center justify-center border-2 border-dashed border-primary/40 rounded-lg p-8 sm:p-12 cursor-pointer hover:border-primary hover:bg-primary/5 hover:shadow-[0_0_30px_hsl(var(--primary)/0.2)] transition-all"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0] ?? null); }}
            >
              {file ? (
                <>
                  <FileText className="w-10 h-10 text-primary mb-2 animate-pulse" />
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-muted-foreground mt-1">{(file.size / 1024).toFixed(0)} KB · click to replace</span>
                </>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-accent mb-2" />
                  <span className="text-sm font-medium text-foreground">Drop a PDF or DOCX here</span>
                  <span className="text-xs text-muted-foreground mt-1">or click to browse · max 10MB</span>
                </>
              )}
              <input id="file-input" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium mb-1.5 text-accent uppercase tracking-wider">Paste meeting notes / transcript</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              placeholder="Paste raw text here…"
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => { setUsePaste(!usePaste); setFile(null); setText(""); }}
          className="text-xs text-accent hover:text-primary transition-colors"
        >
          {usePaste ? "← Use file upload instead" : "Or paste text directly →"}
        </button>

        {stage >= 0 && (
          <div className="border-t border-border pt-5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-2">
              {STAGES.map((s, i) => {
                const done = stage > i || stage === 3;
                const active = stage === i;
                return (
                  <div key={s} className="flex-1 flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      done ? "bg-primary text-primary-foreground shadow-[0_0_15px_hsl(var(--primary)/0.6)]"
                        : active ? "bg-primary/20 text-primary border border-primary animate-pulse-glow"
                        : "bg-secondary text-muted-foreground"
                    }`}>
                      {done ? <Check className="w-4 h-4" /> : active ? <Loader2 className="w-4 h-4 animate-spin" /> : i + 1}
                    </div>
                    <span className={`text-xs ${active || done ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s}</span>
                    {i < STAGES.length - 1 && <div className={`hidden sm:block flex-1 h-px ${done ? "bg-primary" : "bg-border"}`} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={analyze}
            disabled={busy || (!file && !text.trim())}
            className="cyber-btn text-primary-foreground px-6 py-2.5 rounded-md text-sm font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "Analyzing…" : "⚡ Analyze"}
          </button>
        </div>
      </div>
    </div>
  );
}
