"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft, Save, Loader2, Settings as Cog, Link2, Unlink,
    ExternalLink, CircleCheck, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";

interface Org {
    id: string; name: string; slug: string; plan: string;
    logo_url: string | null; primary_color: string;
    max_clients: number; max_ad_accounts: number;
}

interface StatusResp {
    stage: "no_credentials" | "no_token" | "token_invalid" | "connected";
    hasCredentials: boolean;
    appId?: string | null;
    appName?: string | null;
    fbUserName?: string | null;
    expiresAt?: string | null;
    error?: string | null;
}

// Ícone do Facebook (lucide não tem brand icons)
function IconFacebook({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className ?? "w-4 h-4"} fill="currentColor" aria-hidden="true">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
    );
}

export default function SettingsPage() {
    const [org, setOrg] = useState<Org | null>(null);
    const [status, setStatus] = useState<StatusResp | null>(null);
    const [busy, setBusy] = useState(false);

    const load = async () => {
        const [o, s] = await Promise.all([
            apiFetch<{ org: Org }>("/org"),
            apiFetch<StatusResp>("/meta/status"),
        ]);
        setOrg(o.org);
        setStatus(s);
    };

    useEffect(() => {
        load();

        // Mostra feedback do callback OAuth
        const params = new URLSearchParams(window.location.search);
        const ok = params.get("meta");
        const err = params.get("meta_error");
        if (ok === "connected") {
            toast.success("Facebook conectado com sucesso!");
            window.history.replaceState({}, "", "/dashboard/settings");
        } else if (err) {
            toast.error(`Erro ao conectar Facebook: ${decodeURIComponent(err)}`);
            window.history.replaceState({}, "", "/dashboard/settings");
        }
    }, []);

    const save = async () => {
        if (!org) return;
        setBusy(true);
        try {
            await apiFetch("/org", {
                method: "PATCH",
                body: { name: org.name, logo_url: org.logo_url || null, primary_color: org.primary_color },
            });
            toast.success("Salvo");
        } catch (e: any) { toast.error(e.message); }
        finally { setBusy(false); }
    };

    const disconnect = async () => {
        if (!confirm("Desconectar Meta? Você (e todos os seus clientes no portal) perderão acesso aos dados até reconectar.")) return;
        await apiFetch("/meta/disconnect", { method: "POST" });
        toast.success("Desconectado");
        load();
    };

    if (!org) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin muted" />
        </div>
    );

    return (
        <div className="min-h-screen">
            <header className="flex items-center justify-between px-4 md:px-6 py-4 border-b" style={{ borderColor: "var(--color-glass-border)" }}>
                <div className="flex items-center gap-3">
                    <Link href="/dashboard" className="btn-secondary"><ArrowLeft className="w-4 h-4" /></Link>
                    <div>
                        <h1 className="font-bold flex items-center gap-2"><Cog className="w-4 h-4" /> Configurações</h1>
                        <p className="text-xs muted">Organização e conexão Meta</p>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">

                {/* Organização */}
                <section className="glass p-5">
                    <h2 className="font-bold mb-4">Sua agência</h2>
                    <div className="space-y-3">
                        <div>
                            <label className="label">Nome</label>
                            <input className="input" value={org.name} onChange={e => setOrg({ ...org, name: e.target.value })} />
                        </div>
                        <div>
                            <label className="label">URL do logo (opcional, aparece no portal dos clientes)</label>
                            <input className="input" value={org.logo_url || ""} onChange={e => setOrg({ ...org, logo_url: e.target.value })} placeholder="https://..." />
                        </div>
                        <div>
                            <label className="label">Cor primária (hex, ex: #7c3aed)</label>
                            <div className="flex gap-2 items-center">
                                <input className="input" value={org.primary_color} onChange={e => setOrg({ ...org, primary_color: e.target.value })} />
                                <div className="w-10 h-10 rounded-lg border" style={{ background: org.primary_color, borderColor: "rgba(255,255,255,0.1)" }} />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 pt-2">
                            <Mini label="Plano" value={org.plan} />
                            <Mini label="Limite clientes" value={String(org.max_clients)} />
                            <Mini label="Limite contas" value={String(org.max_ad_accounts)} />
                        </div>
                        <button onClick={save} disabled={busy} className="btn-primary w-full justify-center mt-2" style={{ padding: "0.65rem" }}>
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
                        </button>
                    </div>
                </section>

                {/* Conexão Meta */}
                <section className="glass p-5">
                    <h2 className="font-bold mb-1 flex items-center gap-2"><Link2 className="w-4 h-4" /> Conexão Meta (Facebook Ads)</h2>
                    <p className="text-xs muted mb-4">Conecte sua conta de negócios do Facebook para acessar dados de campanhas.</p>

                    {!status ? <Loader2 className="w-4 h-4 animate-spin muted" /> : (

                        status.stage === "connected" ? (
                            /* ── Estado: Conectado ── */
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <CircleCheck className="w-5 h-5 flex-shrink-0" style={{ color: "#34d399" }} />
                                    <p className="font-semibold text-sm">Conectado como {status.fbUserName}</p>
                                </div>
                                {status.appId && <p className="text-xs muted ml-7">App: {status.appName || status.appId}</p>}
                                {status.expiresAt && (
                                    <p className="text-xs muted ml-7">
                                        Token expira: {new Date(status.expiresAt).toLocaleDateString("pt-BR")}
                                    </p>
                                )}
                                <div className="flex flex-wrap gap-2 mt-4">
                                    <a href="/api/meta/connect?platform=1" className="btn-secondary text-xs flex items-center gap-1.5">
                                        <IconFacebook className="w-3 h-3" /> Reconectar via Facebook
                                    </a>
                                    {status.hasCredentials && (
                                        <a href="/api/meta/connect" className="btn-secondary text-xs">Reconectar via App</a>
                                    )}
                                    <button onClick={disconnect} className="btn-secondary text-xs flex items-center gap-1.5" style={{ color: "#fca5a5" }}>
                                        <Unlink className="w-3 h-3" /> Desconectar
                                    </button>
                                </div>
                            </div>

                        ) : (
                            /* ── Estado: Não conectado (no_credentials / no_token / token_invalid) ── */
                            <div className="space-y-4">

                                {/* Alerta de token inválido */}
                                {status.stage === "token_invalid" && (
                                    <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: "rgba(252,165,165,0.1)", border: "1px solid rgba(252,165,165,0.3)" }}>
                                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#fca5a5" }} />
                                        <p className="text-sm" style={{ color: "#fca5a5" }}>
                                            Token inválido ou expirado. Reconecte sua conta.
                                        </p>
                                    </div>
                                )}

                                {/* Opção 1 — Login com Facebook (plataforma) */}
                                <div className="p-4 rounded-lg" style={{ background: "rgba(24,119,242,0.08)", border: "1px solid rgba(24,119,242,0.25)" }}>
                                    <p className="font-semibold text-sm mb-0.5" style={{ color: "#60a5fa" }}>
                                        Login direto com Facebook
                                    </p>
                                    <p className="text-xs muted mb-3">
                                        Conecte sua conta Facebook/Business Manager. Rápido, sem precisar criar um App Meta próprio.
                                    </p>
                                    <a
                                        href="/api/meta/connect?platform=1"
                                        className="inline-flex items-center gap-2 btn-primary text-sm"
                                        style={{ background: "#1877f2", borderColor: "#1877f2" }}
                                    >
                                        <IconFacebook />
                                        {status.stage === "token_invalid" ? "Reconectar com Facebook" : "Conectar com Facebook"}
                                    </a>
                                </div>

                                {/* Divisor */}
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
                                    <span className="text-xs muted">ou</span>
                                    <div className="flex-1 border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
                                </div>

                                {/* Opção 2 — App Meta próprio */}
                                <div>
                                    <p className="text-xs muted mb-2 font-medium">Usar meu próprio Meta App</p>
                                    {status.stage === "no_credentials" ? (
                                        <p className="text-xs muted mb-2">
                                            Para agências com App Meta Developer próprio.{" "}
                                            <Link href="/onboarding" className="underline" style={{ color: "#a78bfa" }}>
                                                Configurar App <ExternalLink className="w-3 h-3 inline" />
                                            </Link>
                                        </p>
                                    ) : (
                                        /* Tem credentials, mas sem token (no_token) ou token inválido */
                                        <div className="space-y-2">
                                            <p className="text-xs muted">
                                                App configurado: <span className="font-mono">{status.appName || status.appId}</span>
                                            </p>
                                            <div className="flex gap-2">
                                                <a href="/api/meta/connect" className="btn-secondary text-xs">
                                                    {status.stage === "token_invalid" ? "Reconectar via App" : "Conectar via App"}
                                                </a>
                                                <Link href="/onboarding" className="btn-secondary text-xs flex items-center gap-1">
                                                    Trocar App <ExternalLink className="w-3 h-3" />
                                                </Link>
                                            </div>
                                        </div>
                                    )}
                                </div>

                            </div>
                        )
                    )}
                </section>
            </main>
        </div>
    );
}

function Mini({ label, value }: { label: string; value: string }) {
    return (
        <div className="glass p-3 text-center">
            <p className="text-xs muted">{label}</p>
            <p className="font-bold mt-0.5">{value}</p>
        </div>
    );
}
