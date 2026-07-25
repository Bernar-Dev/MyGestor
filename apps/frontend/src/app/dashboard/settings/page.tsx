"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft, Save, Loader2, Settings as Cog, Link2, Unlink,
    CircleCheck, AlertCircle, Building2, Check, Plus, Trash2, RefreshCw,
    HelpCircle, X, KeyRound, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";

interface Org {
    id: string; name: string; slug: string; plan: string;
    logo_url: string | null; primary_color: string;
    max_clients: number; max_ad_accounts: number;
}

interface MetaAccount {
    id: string; account_id: string; name: string; currency: string;
    account_status?: number; amount_spent?: string;
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


export default function SettingsPage() {
    const [org, setOrg] = useState<Org | null>(null);
    const [status, setStatus] = useState<StatusResp | null>(null);
    const [busy, setBusy] = useState(false);
    const [refreshingToken, setRefreshingToken] = useState(false);
    const [manualToken, setManualToken] = useState("");
    const [savingToken, setSavingToken] = useState(false);
    const [showTokenInput, setShowTokenInput] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);

    // Contas Meta
    const [allMetaAccounts, setAllMetaAccounts] = useState<MetaAccount[]>([]);
    const [managedIds, setManagedIds] = useState<Set<string>>(new Set());
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    const load = async () => {
        const [o, s] = await Promise.all([
            apiFetch<{ org: Org }>("/org"),
            apiFetch<StatusResp>("/meta/status"),
        ]);
        setOrg(o.org);
        setStatus(s);
    };

    const loadAccounts = async () => {
        setLoadingAccounts(true);
        try {
            const [all, managed] = await Promise.all([
                apiFetch<{ success: boolean; accounts: MetaAccount[] }>("/accounts"),
                apiFetch<{ success: boolean; accounts: Array<{ account_id: string }> }>("/accounts/managed"),
            ]);
            setAllMetaAccounts(all.accounts || []);
            setManagedIds(new Set((managed.accounts || []).map(a => a.account_id)));
        } catch { }
        finally { setLoadingAccounts(false); }
    };

    const toggleAccount = async (acc: MetaAccount) => {
        const normId = acc.account_id.startsWith("act_") ? acc.account_id : `act_${acc.account_id}`;
        const isManaged = managedIds.has(normId);
        setTogglingId(normId);
        try {
            if (isManaged) {
                await apiFetch(`/accounts/managed/${encodeURIComponent(normId)}`, { method: "DELETE" });
                setManagedIds(prev => { const n = new Set(prev); n.delete(normId); return n; });
                toast.success("Conta removida do dashboard");
            } else {
                await apiFetch("/accounts/managed", {
                    method: "POST",
                    body: { account_id: normId, account_name: acc.name, currency: acc.currency },
                });
                setManagedIds(prev => new Set([...prev, normId]));
                toast.success("Conta adicionada ao dashboard");
            }
        } catch (e: any) { toast.error(e.message); }
        finally { setTogglingId(null); }
    };

    const saveToken = async () => {
        if (!manualToken.trim()) { toast.error("Cole o token antes de salvar"); return; }
        setSavingToken(true);
        try {
            const r = await apiFetch<{ ok: boolean; fbUserName?: string }>("/meta/token", {
                method: "POST",
                body: { accessToken: manualToken.trim() },
            });
            toast.success(r.fbUserName ? `Conectado como ${r.fbUserName}!` : "Token salvo com sucesso!");
            setManualToken("");
            setShowTokenInput(false);
            load();
            loadAccounts();
        } catch (e: any) {
            toast.error(e.message || "Token inválido. Verifique e tente novamente.");
        } finally {
            setSavingToken(false);
        }
    };

    useEffect(() => {
        load();
        loadAccounts();
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

    const refreshToken = async () => {
        setRefreshingToken(true);
        try {
            await apiFetch("/meta/refresh", { method: "POST" });
            toast.success("Token renovado por mais 60 dias!");
            load();
        } catch (e: any) {
            toast.error("Não foi possível renovar: " + (e.message || "Tente reconectar manualmente"));
        } finally {
            setRefreshingToken(false);
        }
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

                {/* Modal tutorial */}
                {showTutorial && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
                        <div className="glass max-w-md w-full p-6 relative" style={{ maxHeight: "90vh", overflowY: "auto" }}>
                            <button onClick={() => setShowTutorial(false)} className="absolute top-4 right-4 btn-secondary p-1">
                                <X className="w-4 h-4" />
                            </button>
                            <h3 className="font-bold mb-1 flex items-center gap-2">
                                <HelpCircle className="w-4 h-4" style={{ color: "#a78bfa" }} />
                                Como obter seu token Meta
                            </h3>
                            <p className="text-xs muted mb-4">Siga os passos abaixo no Meta for Developers para gerar seu token de acesso.</p>

                            <ol className="space-y-4">
                                {[
                                    {
                                        n: 1,
                                        title: "Acesse o Graph API Explorer",
                                        desc: "Abra o link abaixo em uma nova aba:",
                                        extra: (
                                            <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-xs mt-1"
                                                style={{ color: "#a78bfa" }}>
                                                developers.facebook.com/tools/explorer <ExternalLink className="w-3 h-3" />
                                            </a>
                                        ),
                                    },
                                    {
                                        n: 2,
                                        title: "Selecione o App",
                                        desc: 'No canto superior direito, em "Meta App", escolha o aplicativo que gerencia sua conta de anúncios.',
                                    },
                                    {
                                        n: 3,
                                        title: "Adicione as permissões",
                                        desc: 'Clique em "Add a permission" e adicione:',
                                        extra: (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {["ads_read", "ads_management", "business_management"].map(p => (
                                                    <span key={p} className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}>{p}</span>
                                                ))}
                                            </div>
                                        ),
                                    },
                                    {
                                        n: 4,
                                        title: "Gere o token",
                                        desc: 'Clique em "Generate Access Token" e autorize no popup do Facebook.',
                                    },
                                    {
                                        n: 5,
                                        title: "Copie e cole aqui",
                                        desc: 'Copie o token gerado e cole no campo "Token de acesso" nas configurações.',
                                    },
                                    {
                                        n: 6,
                                        title: "Renove quando necessário",
                                        desc: 'O token dura ~60 dias. Use o botão "Renovar token" antes de expirar para estender por mais 60 dias sem precisar repetir este processo.',
                                    },
                                ].map(step => (
                                    <li key={step.n} className="flex gap-3">
                                        <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                                            style={{ background: "rgba(167,139,250,0.2)", color: "#a78bfa", marginTop: 1 }}>
                                            {step.n}
                                        </span>
                                        <div>
                                            <p className="text-sm font-semibold">{step.title}</p>
                                            <p className="text-xs muted">{step.desc}</p>
                                            {step.extra}
                                        </div>
                                    </li>
                                ))}
                            </ol>

                            <button onClick={() => setShowTutorial(false)} className="btn-primary w-full justify-center mt-5 text-sm">
                                Entendi
                            </button>
                        </div>
                    </div>
                )}

                {/* Conexão Meta */}
                <section className="glass p-5">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="font-bold flex items-center gap-2"><Link2 className="w-4 h-4" /> Conexão Meta (Facebook Ads)</h2>
                        <button onClick={() => setShowTutorial(true)} title="Como obter o token?" className="btn-secondary p-1.5 rounded-full">
                            <HelpCircle className="w-4 h-4" style={{ color: "#a78bfa" }} />
                        </button>
                    </div>
                    <p className="text-xs muted mb-4">Cole seu token de acesso Meta para conectar suas campanhas ao painel.</p>

                    {!status ? <Loader2 className="w-4 h-4 animate-spin muted" /> : (

                        status.stage === "connected" ? (
                            /* ── Estado: Conectado ── */
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <CircleCheck className="w-5 h-5 flex-shrink-0" style={{ color: "#34d399" }} />
                                    <p className="font-semibold text-sm">Conectado{status.fbUserName ? ` como ${status.fbUserName}` : ""}</p>
                                </div>
                                {status.expiresAt && (
                                    <p className="text-xs muted ml-7">
                                        Token expira em: {new Date(status.expiresAt).toLocaleDateString("pt-BR")}
                                    </p>
                                )}

                                {/* Formulário de troca de token (colapsável) */}
                                {showTokenInput ? (
                                    <div className="mt-4 space-y-2">
                                        <label className="label flex items-center gap-1">
                                            Novo token de acesso
                                        </label>
                                        <textarea
                                            className="input font-mono text-xs"
                                            rows={3}
                                            value={manualToken}
                                            onChange={e => setManualToken(e.target.value)}
                                            placeholder="Cole o token aqui..."
                                            autoFocus
                                        />
                                        <div className="flex gap-2">
                                            <button onClick={saveToken} disabled={savingToken || !manualToken.trim()} className="btn-primary text-xs flex items-center gap-1.5">
                                                {savingToken ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />}
                                                {savingToken ? "Salvando..." : "Salvar token"}
                                            </button>
                                            <button onClick={() => { setShowTokenInput(false); setManualToken(""); }} className="btn-secondary text-xs">
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2 mt-4">
                                        <button onClick={refreshToken} disabled={refreshingToken} className="btn-primary text-xs flex items-center gap-1.5">
                                            {refreshingToken ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                            {refreshingToken ? "Renovando..." : "Renovar token (+60 dias)"}
                                        </button>
                                        <button onClick={() => setShowTokenInput(true)} className="btn-secondary text-xs flex items-center gap-1.5">
                                            <KeyRound className="w-3 h-3" /> Alterar token
                                        </button>
                                        <button onClick={disconnect} className="btn-secondary text-xs flex items-center gap-1.5" style={{ color: "#fca5a5" }}>
                                            <Unlink className="w-3 h-3" /> Desconectar
                                        </button>
                                    </div>
                                )}
                            </div>

                        ) : (
                            /* ── Estado: Não conectado (no_credentials / no_token / token_invalid) ── */
                            <div className="space-y-3">

                                {/* Alerta de token inválido */}
                                {status.stage === "token_invalid" && (
                                    <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: "rgba(252,165,165,0.1)", border: "1px solid rgba(252,165,165,0.3)" }}>
                                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#fca5a5" }} />
                                        <p className="text-sm" style={{ color: "#fca5a5" }}>
                                            Token inválido ou expirado. Insira um novo token para reconectar.
                                        </p>
                                    </div>
                                )}

                                {/* Input manual */}
                                <div>
                                    <label className="label">Token de acesso</label>
                                    <textarea
                                        className="input font-mono text-xs"
                                        rows={3}
                                        value={manualToken}
                                        onChange={e => setManualToken(e.target.value)}
                                        placeholder="Cole seu token de acesso Meta aqui..."
                                    />
                                    <p className="text-xs muted mt-1">
                                        Não sabe como gerar o token?{" "}
                                        <button onClick={() => setShowTutorial(true)} className="underline" style={{ color: "#a78bfa" }}>
                                            Ver tutorial
                                        </button>
                                    </p>
                                </div>

                                <button
                                    onClick={saveToken}
                                    disabled={savingToken || !manualToken.trim()}
                                    className="btn-primary text-sm flex items-center gap-2"
                                    style={{ padding: "0.6rem 1rem" }}
                                >
                                    {savingToken ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                                    {savingToken ? "Verificando token..." : "Conectar"}
                                </button>
                            </div>
                        )
                    )}
                </section>
                {/* Contas Meta gerenciadas */}
                <section className="glass">
                    <div className="p-4 md:p-5 border-b flex items-center justify-between" style={{ borderColor: "var(--color-glass-border)" }}>
                        <div>
                            <h2 className="font-bold flex items-center gap-2"><Building2 className="w-4 h-4" /> Contas Meta no dashboard</h2>
                            <p className="text-xs muted mt-1">
                                Selecione quais contas de anúncio aparecem no seu Painel Geral.
                                Contas não selecionadas ficam ocultas — mas você ainda pode atribuí-las a clientes.
                            </p>
                        </div>
                        <button
                            onClick={loadAccounts}
                            disabled={loadingAccounts}
                            className="btn-secondary text-xs"
                            title="Recarregar lista"
                        >
                            <RefreshCw className={`w-3 h-3 ${loadingAccounts ? "animate-spin" : ""}`} />
                        </button>
                    </div>

                    {loadingAccounts ? (
                        <div className="p-8 flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin muted" />
                            <span className="muted text-sm">Carregando contas...</span>
                        </div>
                    ) : status?.stage !== "connected" ? (
                        <div className="p-6 text-center">
                            <p className="muted text-sm">Conecte sua conta Meta primeiro para ver as contas disponíveis.</p>
                        </div>
                    ) : allMetaAccounts.length === 0 ? (
                        <div className="p-6 text-center">
                            <p className="muted text-sm">Nenhuma conta encontrada no token Meta.</p>
                        </div>
                    ) : (
                        <>
                            <div className="p-3 border-b" style={{ borderColor: "var(--color-glass-border)", background: "rgba(167,139,250,0.05)" }}>
                                <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                                    <span style={{ color: "#a78bfa" }}>{managedIds.size}</span> de {allMetaAccounts.length} contas selecionadas para o dashboard
                                </p>
                            </div>
                            <ul className="divide-y" style={{ borderColor: "var(--color-glass-border)" }}>
                                {allMetaAccounts.map(acc => {
                                    const normId = acc.account_id.startsWith("act_") ? acc.account_id : `act_${acc.account_id}`;
                                    const managed = managedIds.has(normId);
                                    const toggling = togglingId === normId;
                                    return (
                                        <li key={acc.id} className="flex items-center justify-between p-3 gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-3 h-3 rounded-sm flex-shrink-0 flex items-center justify-center transition-colors`}
                                                    style={{
                                                        background: managed ? "#a78bfa" : "rgba(255,255,255,0.08)",
                                                        border: `1px solid ${managed ? "#a78bfa" : "rgba(255,255,255,0.15)"}`,
                                                    }}>
                                                    {managed && <Check className="w-2 h-2 text-white" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium truncate">{acc.name}</p>
                                                    <p className="text-xs muted">{normId} · {acc.currency}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => toggleAccount(acc)}
                                                disabled={toggling}
                                                className={managed ? "btn-secondary text-xs" : "btn-primary text-xs"}
                                                style={managed ? { color: "#fca5a5" } : {}}
                                            >
                                                {toggling ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : managed ? (
                                                    <><Trash2 className="w-3 h-3" /> Remover</>
                                                ) : (
                                                    <><Plus className="w-3 h-3" /> Adicionar</>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </>
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
