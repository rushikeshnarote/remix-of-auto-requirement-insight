import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { LogOut } from "lucide-react";

export function Navbar() {
  const { profile, signOut } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const linkCls = (path: string) =>
    `px-3 py-1.5 text-sm rounded ${loc.pathname === path ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <header className="border-b border-border bg-card">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="font-semibold text-primary tracking-tight">AutoReq</Link>
          <nav className="flex items-center gap-1">
            <Link to="/" className={linkCls("/")}>Upload</Link>
            <Link to="/documents" className={linkCls("/documents")}>My Documents</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{profile?.username ?? ""}</span>
          <button
            onClick={async () => { await signOut(); nav("/auth"); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm border border-border rounded hover:bg-secondary"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </div>
    </header>
  );
}
