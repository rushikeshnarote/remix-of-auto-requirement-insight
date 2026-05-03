import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { LogOut, Zap, Menu, X } from "lucide-react";
import { useState } from "react";

export function Navbar() {
  const { profile, signOut } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  const linkCls = (path: string) =>
    `px-3 py-1.5 text-sm rounded-md transition-all ${
      loc.pathname === path
        ? "text-primary neon-text bg-primary/10 border border-primary/30"
        : "text-muted-foreground hover:text-accent hover:bg-accent/5"
    }`;

  return (
    <header className="relative z-20 border-b border-border glass-panel sticky top-0">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-6">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
            <Zap className="w-5 h-5 text-primary animate-pulse" />
            <span className="gradient-text text-lg">AutoReq</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <Link to="/" className={linkCls("/")}>Upload</Link>
            <Link to="/documents" className={linkCls("/documents")}>My Documents</Link>
          </nav>
        </div>
        <div className="hidden md:flex items-center gap-3 text-sm">
          <span className="text-accent neon-text-cyan">{profile?.username ?? ""}</span>
          <button
            onClick={async () => { await signOut(); nav("/auth"); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-primary/40 rounded-md text-primary hover:bg-primary/10 hover:shadow-[0_0_15px_hsl(var(--primary)/0.4)] transition-all"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
        <button onClick={() => setOpen(!open)} className="md:hidden p-2 text-primary">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-border glass-panel px-4 py-3 space-y-2 animate-fade-in">
          <Link to="/" onClick={() => setOpen(false)} className={`block ${linkCls("/")}`}>Upload</Link>
          <Link to="/documents" onClick={() => setOpen(false)} className={`block ${linkCls("/documents")}`}>My Documents</Link>
          <div className="pt-2 border-t border-border flex items-center justify-between">
            <span className="text-accent text-sm">{profile?.username ?? ""}</span>
            <button
              onClick={async () => { await signOut(); nav("/auth"); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-primary/40 rounded-md text-primary"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
