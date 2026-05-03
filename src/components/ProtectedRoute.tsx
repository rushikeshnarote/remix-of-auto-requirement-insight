import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Navbar } from "./Navbar";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return (
    <div className="min-h-screen bg-background relative">
      <Navbar />
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-fade-in">{children}</main>
    </div>
  );
}
