import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Zap } from "lucide-react";

const registerSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(50),
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});

const loginSchema = z.object({
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(1, "Required"),
});

export default function AuthPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "register") {
        const parsed = registerSchema.safeParse(form);
        if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { data: { username: parsed.data.username }, emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) { toast.error(error.message); return; }
        toast.success("Account created");
        nav("/");
      } else {
        const parsed = loginSchema.safeParse(form);
        if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email, password: parsed.data.password,
        });
        if (error) { toast.error(error.message); return; }
        nav("/");
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 sm:px-6 relative">
      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <Zap className="w-8 h-8 text-primary animate-pulse" />
            <h1 className="text-4xl font-bold gradient-text">AutoReq</h1>
          </div>
          <p className="text-sm text-accent neon-text-cyan tracking-widest uppercase">// Requirements Extraction Tool</p>
        </div>

        <div className="glass-panel rounded-lg p-6 sm:p-8 neon-border scan-line">
          <div className="flex border-b border-border mb-6">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 pb-3 text-sm font-medium border-b-2 -mb-px transition-all ${
                  mode === m ? "border-primary text-primary neon-text" : "border-transparent text-muted-foreground hover:text-accent"
                }`}
              >
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <Field label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
            )}
            <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <Field label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />

            <button
              type="submit"
              disabled={busy}
              className="w-full cyber-btn text-primary-foreground py-2.5 rounded-md text-sm font-bold uppercase tracking-wider disabled:opacity-50"
            >
              {busy ? "Connecting…" : mode === "login" ? "Access System" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-accent mb-1.5 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
        required
      />
    </div>
  );
}
