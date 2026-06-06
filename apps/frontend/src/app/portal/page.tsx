"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api-client";
import { BarChart3, Loader2, LogOut, Building2, ExternalLink, AlertCircle } from "lucide-react";

interface PortalMe {
    client: { id: string; name: string; company: string | null; contact_email: string | null };
    agency: { name: string; logo_url: string | null; primary_color: string };
    accounts: { ad_account_id: string; ad_account_name: string | null; currency: string | null; permissions: Record<string, boolean> }[];
}

export default function PortalHome() {
    const router = useRouter();
    const supabase = createClient();
    const [me, setMe] = useState<PortalMe | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    useEffect(() => {
        apiFetch<PortalMe>("/portal/me")
            .then(j => { setMe(j); setLoading(false); })
            .catch((e: any) => { setErr(e.message || "Erro"); setLoading(false); });
    }, []);

    const logout = async () => { await supabase.auth.signOut(); router.push("/login"); };

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin muted" /></div>;
    if (err) return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="glass p-6 max-w-md text-center">
                <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: "#fca5a5" }} />
                <p className="muted">{err}</p>
                <button onClick={logout} className="btn-secondary mt-4">Sair</button>
            </div>
        </div>
    );
    if (!me) return null;

    const color = me.agency.primary_color || "#7c3aed";

    return (
        <div className="min-h-screen">
            <header className="flex items-center justify-between px-4 md:px-6 py-4 border-b" style={{ borderColor: "var(--color-glass-border)" }}>
                <div className="flex items-center gap-3">
                    {me.agency.logo_url
                        ? <img src={me.agency.logo_url} alt="" className="w-9 h-9 rounded-lg object-cover" />
                        : <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: color }}><BarChart3 className="w-5 h-5 text-white" /></div>}
                    <div>
                        <h1 className="font-bold">{me.agency.name}</h1>
                        <p className="text-xs muted">Portal · {me.client.name}</p>
                    </div>
                </div>
                <button onClick={logout} className="btn-secondary"><LogOut className="w-4 h-4" /> Sair</button>
            </header>

            <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
                <section className="glass p-5">
                    <h2 className="font-bold mb-1">Bem-vindo, {me.client.name.split(" ")[0]}</h2>
                    <p className="muted text-sm">Aqui você acompanha suas campanhas Meta em tempo real. Os dados são puxados direto da Meta — sem planilhas, sem demora.</p>
                </section>

                <section className="glass">
                    <div className="p-4 md:p-5 border-b flex items-center justify-between" style={{ borderColor: "var(--color-glass-border)" }}>
                        <div>
                            <h2 className="font-bold flex items-center gap-2"><Building2 className="w-4 h-4" /> Suas contas de anúncio</h2>
                            <p className="text-xs muted mt-1">{me.accounts.length} {me.accounts.length === 1 ? "conta liberada" : "contas liberadas"}</p>
                        </div>
                    </div>
                    {me.accounts.length === 0 ? (
                        <div className="p-8 text-center muted text-sm">
                            Sua agência ainda não liberou nenhuma conta. Entre em contato.
                        </div>
                    ) : (
                        <ul className="divide-y" style={{ borderColor: "var(--color-glass-border)" }}>
                            {me.accounts.map(a => (
                                <li key={a.ad_account_id}>
                                    <Link href={`/portal/accounts/${encodeURIComponent(a.ad_account_id)}`} className="flex items-center justify-between p-4 hover:bg-white/5">
                                        <div>
                                            <p className="font-semibold text-sm">{a.ad_account_name || a.ad_account_id}</p>
                                            <p className="text-xs muted">{a.ad_account_id} · {a.currency || "—"}</p>
                                        </div>
                                        <ExternalLink className="w-4 h-4 muted" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </main>
        </div>
    );
}
