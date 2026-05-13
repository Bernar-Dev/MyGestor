"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
    BarChart3, Loader2, AlertCircle, RefreshCw, LogOut, Link2, Building2,
    CircleCheck, ExternalLink, Unlink,
} from "lucide-react";
import { toast } from "sonner";

interface StatusResp {
    stage: "no_credentials" | "no_token" | "token_invalid" | "connected";
    appId?: string;
    appName?: string;
    fbUserName?: string;
    expiresAt?: string;
    error?: string | null;
}
interface MetaAccount {
    id: string;
    name: string;
    account_id: string;
    currency: string;
    account_status: number;
    amount_spent: string;
    business_name?: string;
}

export default function Dashboard() {
    const router = useRouter();
    const supabase = createClient();
    const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);
    const [status, setStatus] = useState<StatusResp | null>(null);
    const [accounts, setAccounts] = useState<MetaAccount[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    const load = async () => {
        setLoading(true); setErr("");
        try {
            const { data: { user } } = await supabase.auth.getUser();
            setUser({ email: user?.email, name: (user?.user_metadata as any)?.full_name || (user?.user_metadata as any)?.name });

            const sRes = await fetch("/api/meta/status");
            const s: StatusResp = await sRes.json();
            setStatus(s);

            if (s.stage === "connected") {
                const aRes = await fetch("/api/accounts");
                const j = await aRes.json();
                if (j.success) setAccounts(j.accounts);
                else setErr(j.error || "Falha ao carregar contas");
            }
        } catch (e: any) {
            setErr(e.message);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); /* eslint-disable-line */ }, []);

    const logout = async () => { await supabase.auth.signOut(); router.push("/login"); };

    const disconnect = async () => {
        if (!confirm("Desconectar sua conta Meta? Você precisará autorizar de novo.")) return;
        await fetch("/api/meta/disconnect", { method: "POST" });
        toast.success("Desconectado");
        load();
    };

    return (
        <div className="min-h-screen">
            <header className="flex items-center justify-between px-4 md:px-6 py-4 border-b" style={{ borderColor: "var(--color-glass-border)" }}>
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4c6ef5 0%, #7c3aed 50%, #f472b6 100%)" }}>
                        <BarChart3 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold">Newgestor</h1>
                        <p className="text-xs muted">{user?.email}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={load} className="btn-secondary" disabled={loading}>
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                    <button onClick={logout} className="btn-secondary">
                        <LogOut className="w-4 h-4" /> Sair
                    </button>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
                {/* Status da conexão Meta */}
                <ConnectionStatus status={status} loading={loading} onDisconnect={disconnect} />

                {/* Contas */}
                {status?.stage === "connected" && (
                    <section className="glass">
                        <div className="p-4 md:p-5 border-b flex items-center justify-between" style={{ borderColor: "var(--color-glass-border)" }}>
                            <div>
                                <h2 className="font-bold flex items-center gap-2">
                                    <Building2 className="w-4 h-4" /> Contas de anúncio
                                </h2>
                                <p className="text-xs muted mt-1">
                                    {accounts ? `${accounts.length} contas acessíveis` : "Carregando..."}
                                </p>
                            </div>
                        </div>

                        {loading && !accounts && (
                            <div className="flex justify-center py-10">
                                <Loader2 className="w-6 h-6 animate-spin muted" />
                            </div>
                        )}

                        {err && (
                            <div className="p-4 flex items-center gap-2 text-sm" style={{ color: "#fca5a5" }}>
                                <AlertCircle className="w-4 h-4" /> {err}
                            </div>
                        )}

                        {accounts && accounts.length === 0 && (
                            <div className="p-8 text-center muted text-sm">
                                Nenhuma conta de anúncio encontrada pra esse token.
                            </div>
                        )}

                        {accounts && accounts.length > 0 && (
                            <ul className="divide-y" style={{ borderColor: "var(--color-glass-border)" }}>
                                {accounts.map(a => (
                                    <li key={a.id} className="p-4 flex items-center justify-between hover:bg-white/5">
                                        <div>
                                            <p className="font-semibold text-sm">{a.name}</p>
                                            <p className="text-xs muted">
                                                {a.account_id} · {a.currency} · gasto vida: {(Number(a.amount_spent) / 100).toLocaleString("pt-BR", { style: "currency", currency: a.currency || "BRL" })}
                                            </p>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded-full`}
                                            style={{ background: a.account_status === 1 ? "rgba(52,211,153,0.15)" : "rgba(251,191,36,0.15)", color: a.account_status === 1 ? "#34d399" : "#fbbf24" }}>
                                            {a.account_status === 1 ? "Ativa" : `Status ${a.account_status}`}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                )}

                <p className="text-center text-xs muted mt-10">
                    Dashboard completo (KPIs, breakdowns, export, anúncios ativos) em construção. Por enquanto, lista de contas.
                </p>
            </main>
        </div>
    );
}

function ConnectionStatus({ status, loading, onDisconnect }: { status: StatusResp | null; loading: boolean; onDisconnect: () => void }) {
    if (loading && !status) {
        return <div className="glass p-5 flex items-center gap-3"><Loader2 className="w-4 h-4 animate-spin muted" /> <span className="muted text-sm">Carregando status...</span></div>;
    }
    if (!status) return null;

    if (status.stage === "no_credentials") {
        return (
            <div className="glass p-6 text-center">
                <Link2 className="w-8 h-8 mx-auto mb-3" style={{ color: "#a78bfa" }} />
                <h2 className="font-bold mb-1">Você ainda não conectou sua conta Meta</h2>
                <p className="muted text-sm mb-4">Setup guiado em 4 passos, leva ~3 minutos.</p>
                <a href="/onboarding" className="btn-primary inline-flex">Começar onboarding <ExternalLink className="w-3 h-3" /></a>
            </div>
        );
    }
    if (status.stage === "no_token") {
        return (
            <div className="glass p-6">
                <h2 className="font-bold mb-1">Credenciais salvas — falta autorizar</h2>
                <p className="muted text-sm mb-4">App ID configurado: <strong>{status.appId}</strong>. Clique pra terminar a conexão com Facebook.</p>
                <a href="/api/meta/connect" className="btn-primary inline-flex">Conectar com Facebook</a>
            </div>
        );
    }
    if (status.stage === "token_invalid") {
        return (
            <div className="glass p-6">
                <AlertCircle className="w-6 h-6 mb-2" style={{ color: "#fca5a5" }} />
                <h2 className="font-bold mb-1">Token Meta inválido ou expirado</h2>
                <p className="muted text-sm mb-4">{status.error}</p>
                <a href="/api/meta/connect" className="btn-primary inline-flex">Reconectar</a>
            </div>
        );
    }

    const expires = status.expiresAt ? new Date(status.expiresAt) : null;
    const days = expires ? Math.round((expires.getTime() - Date.now()) / 86400000) : null;
    const tone = days === null ? "ok" : days > 14 ? "ok" : days > 3 ? "warn" : "danger";

    return (
        <div className="glass p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3">
                    <CircleCheck className="w-6 h-6" style={{ color: "#34d399" }} />
                    <div>
                        <h2 className="font-bold">Conectado com Meta</h2>
                        <p className="text-sm muted-strong">{status.fbUserName} · App: {status.appName || status.appId}</p>
                        {expires && (
                            <p className="text-xs mt-1" style={{ color: tone === "ok" ? "rgba(255,255,255,0.5)" : tone === "warn" ? "#fbbf24" : "#fca5a5" }}>
                                Token válido por mais {days} dias (até {expires.toLocaleDateString("pt-BR")})
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    <a href="/api/meta/connect" className="btn-secondary text-xs">Renovar token</a>
                    <button onClick={onDisconnect} className="btn-secondary text-xs">
                        <Unlink className="w-3 h-3" /> Desconectar
                    </button>
                </div>
            </div>
        </div>
    );
}
