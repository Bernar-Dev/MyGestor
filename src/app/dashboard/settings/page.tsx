"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Settings as Cog, Link2, Unlink, ExternalLink, CircleCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Org {
    id: string; name: string; slug: string; plan: string;
    logo_url: string | null; primary_color: string;
    max_clients: number; max_ad_accounts: number;
}
interface StatusResp {
    stage: "no_credentials" | "no_token" | "token_invalid" | "connected";
    appId?: string; appName?: string; fbUserName?: string; expiresAt?: string;
}

export default function SettingsPage() {
    const [org, setOrg] = useState<Org | null>(null);
    const [status, setStatus] = useState<StatusResp | null>(null);
    const [busy, setBusy] = useState(false);

    const load = async () => {
        const [o, s] = await Promise.all([
            fetch("/api/org").then(r => r.json()),
            fetch("/api/meta/status").then(r => r.json()),
        ]);
        setOrg(o.org);
        setStatus(s);
    };
    useEffect(() => { load(); }, []);

    const save = async () => {
        if (!org) return;
        setBusy(true);
        try {
            const r = await fetch("/api/org", {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: org.name, logo_url: org.logo_url || null, primary_color: org.primary_color }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error);
            toast.success("Salvo");
        } catch (e: any) { toast.error(e.message); }
        finally { setBusy(false); }
    };

    const disconnect = async () => {
        if (!confirm("Desconectar Meta? Você (e todos os seus clientes no portal) perderão acesso aos dados até reconectar.")) return;
        await fetch("/api/meta/disconnect", { method: "POST" });
        toast.success("Desconectado");
        load();
    };

    if (!org) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin muted" /></div>;

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
                    <h2 className="font-bold mb-3 flex items-center gap-2"><Link2 className="w-4 h-4" /> Meta App</h2>
                    <p className="muted text-sm mb-4">
                        Seu Meta App é configurado <strong>dentro da plataforma</strong>, não em variáveis de ambiente.
                        Cada agência tem seu próprio App ID/Secret cifrado AES-256.
                    </p>
                    {!status ? <Loader2 className="w-4 h-4 animate-spin muted" /> :
                        status.stage === "no_credentials" ? (
                            <div>
                                <p className="muted text-sm mb-3">Nenhum app configurado.</p>
                                <Link href="/onboarding" className="btn-primary inline-flex">Configurar Meta App <ExternalLink className="w-3 h-3" /></Link>
                            </div>
                        ) : status.stage === "no_token" ? (
                            <div>
                                <p className="muted text-sm mb-2">App configurado ({status.appId}), mas Facebook não autorizou ainda.</p>
                                <a href="/api/meta/connect" className="btn-primary inline-flex">Conectar com Facebook</a>
                            </div>
                        ) : status.stage === "token_invalid" ? (
                            <div>
                                <AlertCircle className="w-5 h-5 mb-1" style={{ color: "#fca5a5" }} />
                                <p className="muted text-sm mb-2">Token inválido. Reconecte.</p>
                                <a href="/api/meta/connect" className="btn-primary inline-flex">Reconectar</a>
                            </div>
                        ) : (
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <CircleCheck className="w-5 h-5" style={{ color: "#34d399" }} />
                                    <p className="font-semibold text-sm">Conectado como {status.fbUserName}</p>
                                </div>
                                <p className="text-xs muted">App: {status.appName || status.appId}</p>
                                {status.expiresAt && <p className="text-xs muted">Token expira: {new Date(status.expiresAt).toLocaleDateString("pt-BR")}</p>}
                                <div className="flex gap-2 mt-3">
                                    <a href="/api/meta/connect" className="btn-secondary text-xs">Renovar token</a>
                                    <button onClick={disconnect} className="btn-secondary text-xs" style={{ color: "#fca5a5" }}>
                                        <Unlink className="w-3 h-3" /> Desconectar
                                    </button>
                                    <Link href="/onboarding" className="btn-secondary text-xs">Trocar App</Link>
                                </div>
                            </div>
                        )
                    }
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
