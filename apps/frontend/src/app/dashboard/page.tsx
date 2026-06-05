"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api-client";
import {
    BarChart3, Loader2, AlertCircle, RefreshCw, LogOut, Link2, Users,
    CircleCheck, ExternalLink, Unlink, Settings, ChevronRight, Building2,
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

interface OrgResp {
    org?: { id: string; name: string; plan: string; max_clients: number; max_ad_accounts: number };
    role?: "owner" | "manager";
}

interface ClientRow {
    id: string; name: string; company: string | null; status: string;
    portal_enabled: boolean; ad_accounts_count: number;
}

export default function Dashboard() {
    const router = useRouter();
    const supabase = createClient();
    const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);
    const [org, setOrg] = useState<OrgResp["org"]>();
    const [status, setStatus] = useState<StatusResp | null>(null);
    const [clients, setClients] = useState<ClientRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    const load = async () => {
        setLoading(true); setErr("");
        try {
            const { data: { user } } = await supabase.auth.getUser();
            setUser({ email: user?.email, name: (user?.user_metadata as any)?.full_name });

            const [oRes, sRes, cRes] = await Promise.all([
                apiFetch<OrgResp>("/org"),
                apiFetch<StatusResp>("/meta/status"),
                apiFetch<{ clients: ClientRow[] }>("/clients"),
            ]);
            setOrg(oRes.org);
            setStatus(sRes);
            setClients(cRes.clients || []);
        } catch (e: any) { setErr(e.message); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); /* eslint-disable-line */ }, []);

    const logout = async () => { await supabase.auth.signOut(); router.push("/login"); };

    const disconnect = async () => {
        if (!confirm("Desconectar conta Meta? Você precisará autorizar de novo.")) return;
        await apiFetch("/meta/disconnect", { method: "POST" });
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
                        <h1 className="font-bold">{org?.name || "Newgestor"}</h1>
                        <p className="text-xs muted">{user?.email} · plano <strong>{org?.plan || "—"}</strong></p>
                    </div>
                </div>
                <nav className="flex gap-2">
                    <Link href="/dashboard/clients" className="btn-secondary"><Users className="w-4 h-4" /> Clientes</Link>
                    <Link href="/dashboard/settings" className="btn-secondary"><Settings className="w-4 h-4" /> Config</Link>
                    <button onClick={load} className="btn-secondary" disabled={loading}>
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                    <button onClick={logout} className="btn-secondary"><LogOut className="w-4 h-4" /></button>
                </nav>
            </header>

            <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
                <ConnectionStatus status={status} loading={loading} onDisconnect={disconnect} />

                {/* Grid: clientes + stats */}
                {status?.stage === "connected" && (
                    <>
                        <div className="grid md:grid-cols-3 gap-4">
                            <StatCard label="Clientes" value={clients.length} cap={org?.max_clients} icon={Users} />
                            <StatCard label="Contas atribuídas" value={clients.reduce((a, c) => a + c.ad_accounts_count, 0)} cap={org?.max_ad_accounts} icon={Building2} />
                            <StatCard label="Plano" value={org?.plan || "—"} icon={Settings} />
                        </div>

                        <section className="glass">
                            <div className="p-4 md:p-5 border-b flex items-center justify-between" style={{ borderColor: "var(--color-glass-border)" }}>
                                <div>
                                    <h2 className="font-bold flex items-center gap-2"><Users className="w-4 h-4" /> Meus clientes</h2>
                                    <p className="text-xs muted mt-1">{clients.length} cadastrados</p>
                                </div>
                                <Link href="/dashboard/clients" className="btn-primary text-xs">Gerenciar →</Link>
                            </div>
                            {clients.length === 0 ? (
                                <div className="p-8 text-center">
                                    <p className="muted text-sm mb-3">Nenhum cliente ainda. Adicione o primeiro pra começar.</p>
                                    <Link href="/dashboard/clients" className="btn-primary inline-flex">Adicionar cliente</Link>
                                </div>
                            ) : (
                                <ul className="divide-y" style={{ borderColor: "var(--color-glass-border)" }}>
                                    {clients.slice(0, 5).map(c => (
                                        <li key={c.id}>
                                            <Link href={`/dashboard/clients/${c.id}`} className="flex items-center justify-between p-4 hover:bg-white/5">
                                                <div>
                                                    <p className="font-semibold text-sm">{c.name}</p>
                                                    <p className="text-xs muted">{c.company || "Sem empresa"} · {c.ad_accounts_count} contas atribuídas · {c.portal_enabled ? "portal ativo" : "sem portal"}</p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 muted" />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </>
                )}

                {err && (
                    <div className="glass p-4 flex items-center gap-2 text-sm" style={{ color: "#fca5a5" }}>
                        <AlertCircle className="w-4 h-4" /> {err}
                    </div>
                )}
            </main>
        </div>
    );
}

function StatCard({ label, value, cap, icon: Icon }: { label: string; value: number | string; cap?: number; icon: any }) {
    return (
        <div className="glass p-4">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs muted uppercase tracking-wide">{label}</p>
                    <p className="text-2xl font-bold mt-1">{value}{typeof cap === "number" && <span className="text-sm muted font-normal"> / {cap}</span>}</p>
                </div>
                <Icon className="w-5 h-5" style={{ color: "#a78bfa" }} />
            </div>
        </div>
    );
}

function ConnectionStatus({ status, loading, onDisconnect }: { status: StatusResp | null; loading: boolean; onDisconnect: () => void }) {
    if (loading && !status) {
        return <div className="glass p-5 flex items-center gap-3"><Loader2 className="w-4 h-4 animate-spin muted" /> <span className="muted text-sm">Carregando...</span></div>;
    }
    if (!status) return null;

    if (status.stage === "no_credentials") {
        return (
            <div className="glass p-6 text-center">
                <Link2 className="w-8 h-8 mx-auto mb-3" style={{ color: "#a78bfa" }} />
                <h2 className="font-bold mb-1">Configure seu Meta App pra começar</h2>
                <p className="muted text-sm mb-4">Cadastre App ID e App Secret do seu próprio app Meta. Setup guiado.</p>
                <a href="/onboarding" className="btn-primary inline-flex">Configurar Meta App <ExternalLink className="w-3 h-3" /></a>
            </div>
        );
    }
    if (status.stage === "no_token") {
        return (
            <div className="glass p-6">
                <h2 className="font-bold mb-1">Credenciais salvas — falta autorizar</h2>
                <p className="muted text-sm mb-4">App ID: <strong>{status.appId}</strong>. Conclua a conexão com Facebook.</p>
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
                        <h2 className="font-bold">Meta conectado</h2>
                        <p className="text-sm muted-strong">{status.fbUserName} · App: {status.appName || status.appId}</p>
                        {expires && (
                            <p className="text-xs mt-1" style={{ color: tone === "ok" ? "rgba(255,255,255,0.5)" : tone === "warn" ? "#fbbf24" : "#fca5a5" }}>
                                Token válido por {days} dias (até {expires.toLocaleDateString("pt-BR")})
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    <a href="/api/meta/connect" className="btn-secondary text-xs">Renovar token</a>
                    <button onClick={onDisconnect} className="btn-secondary text-xs"><Unlink className="w-3 h-3" /> Desconectar</button>
                </div>
            </div>
        </div>
    );
}
