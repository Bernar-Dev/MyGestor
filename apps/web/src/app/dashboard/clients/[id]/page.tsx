"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowLeft, Loader2, Plus, Trash2, Send, Copy, Check, Save, Mail, Phone, Building, X,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api-client";

interface ClientDetail {
    id: string; name: string; contact_email: string | null; contact_phone: string | null;
    company: string | null; notes: string | null; status: string;
    portal_enabled: boolean; auth_user_id: string | null; created_at: string;
}
interface AssignedAccount {
    id: string; ad_account_id: string; ad_account_name: string | null;
    currency: string | null; permissions: Record<string, boolean>;
}
interface MasterAccount {
    id: string; account_id: string; name: string; currency: string;
}

const PERM_LABELS: { key: string; label: string }[] = [
    { key: "view_campaigns", label: "Ver campanhas" },
    { key: "view_insights",  label: "Ver KPIs / insights" },
    { key: "view_creatives", label: "Ver criativos" },
    { key: "view_budget",    label: "Ver orçamentos" },
    { key: "view_audiences", label: "Ver públicos" },
];

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [client, setClient] = useState<ClientDetail | null>(null);
    const [accounts, setAccounts] = useState<AssignedAccount[]>([]);
    const [master, setMaster] = useState<MasterAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingClient, setSavingClient] = useState(false);
    const [showAssign, setShowAssign] = useState(false);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteUrl, setInviteUrl] = useState("");
    const [copiedInvite, setCopiedInvite] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const r = await apiFetch<{ client: ClientDetail; accounts: AssignedAccount[] }>(`/clients/${id}`);
            setClient(r.client);
            setAccounts(r.accounts || []);
        } catch (e: any) {
            toast.error(e instanceof ApiError ? e.message : String(e));
            router.push("/dashboard/clients");
            return;
        }
        // Lista mestra de ad accounts da agência (pra atribuir)
        try {
            const m = await apiFetch<{ success: boolean; accounts: any[] }>("/accounts");
            if (m.success) setMaster(m.accounts);
        } catch { }
        setLoading(false);
    };
    useEffect(() => { load(); /* eslint-disable-line */ }, [id]);

    const saveClient = async () => {
        if (!client) return;
        setSavingClient(true);
        try {
            await apiFetch(`/clients/${id}`, {
                method: "PATCH",
                body: {
                    name: client.name,
                    contact_email: client.contact_email,
                    contact_phone: client.contact_phone,
                    company: client.company,
                    notes: client.notes,
                    status: client.status,
                },
            });
            toast.success("Salvo");
        } catch (e: any) { toast.error(e.message); }
        finally { setSavingClient(false); }
    };

    const removeClient = async () => {
        if (!confirm("Apagar cliente e todas as atribuições? Esta ação é irreversível.")) return;
        try {
            await apiFetch(`/clients/${id}`, { method: "DELETE" });
            toast.success("Cliente removido");
            router.push("/dashboard/clients");
        } catch (e: any) { toast.error(e.message); }
    };

    const assign = async (acc: MasterAccount) => {
        const adAccountId = acc.account_id.startsWith("act_") ? acc.account_id : `act_${acc.account_id}`;
        try {
            await apiFetch(`/clients/${id}/accounts`, {
                method: "POST",
                body: {
                    ad_account_id: adAccountId,
                    ad_account_name: acc.name,
                    currency: acc.currency,
                },
            });
            toast.success("Atribuída");
            setShowAssign(false);
            load();
        } catch (e: any) { toast.error(e.message); }
    };

    const unassign = async (adAccountId: string) => {
        if (!confirm("Remover essa conta do acesso do cliente?")) return;
        try {
            await apiFetch(`/clients/${id}/accounts?ad_account_id=${encodeURIComponent(adAccountId)}`, { method: "DELETE" });
            toast.success("Removida");
            load();
        } catch (e: any) { toast.error(e.message); }
    };

    const togglePerm = async (acc: AssignedAccount, key: string) => {
        const next = { ...acc.permissions, [key]: !acc.permissions[key] };
        try {
            await apiFetch(`/clients/${id}/accounts`, {
                method: "PATCH",
                body: { ad_account_id: acc.ad_account_id, permissions: next },
            });
            load();
        } catch (e: any) { toast.error(e.message); }
    };

    const sendInvite = async () => {
        if (!inviteEmail) { toast.error("Email obrigatório"); return; }
        try {
            const j = await apiFetch<{ inviteUrl: string }>(`/clients/${id}/invite`, {
                method: "POST",
                body: { email: inviteEmail },
            });
            setInviteUrl(j.inviteUrl);
            toast.success("Link gerado");
        } catch (e: any) { toast.error(e.message); }
    };

    const copyInvite = async () => {
        await navigator.clipboard.writeText(inviteUrl);
        setCopiedInvite(true);
        setTimeout(() => setCopiedInvite(false), 2000);
    };

    if (loading || !client) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin muted" /></div>;
    }

    const assignedIds = new Set(accounts.map(a => a.ad_account_id));
    const available = master.filter(m => !assignedIds.has(m.account_id.startsWith("act_") ? m.account_id : `act_${m.account_id}`));

    return (
        <div className="min-h-screen">
            <header className="flex items-center justify-between px-4 md:px-6 py-4 border-b" style={{ borderColor: "var(--color-glass-border)" }}>
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/clients" className="btn-secondary"><ArrowLeft className="w-4 h-4" /></Link>
                    <div>
                        <h1 className="font-bold">{client.name}</h1>
                        <p className="text-xs muted">{client.company || "Sem empresa"} · {accounts.length} contas</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowInvite(true)} className="btn-secondary"><Send className="w-4 h-4" /> Convidar pro portal</button>
                    <button onClick={removeClient} className="btn-secondary" style={{ color: "#fca5a5" }}><Trash2 className="w-4 h-4" /></button>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
                {/* Bloco: dados do cliente */}
                <section className="glass p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold">Dados do cliente</h2>
                        <button onClick={saveClient} disabled={savingClient} className="btn-primary text-xs">
                            {savingClient ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar
                        </button>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                        <Field label="Nome do contato" icon={Mail}>
                            <input className="input" value={client.name} onChange={e => setClient(c => c ? { ...c, name: e.target.value } : null)} />
                        </Field>
                        <Field label="Empresa" icon={Building}>
                            <input className="input" value={client.company || ""} onChange={e => setClient(c => c ? { ...c, company: e.target.value } : null)} />
                        </Field>
                        <Field label="Email" icon={Mail}>
                            <input className="input" type="email" value={client.contact_email || ""} onChange={e => setClient(c => c ? { ...c, contact_email: e.target.value } : null)} />
                        </Field>
                        <Field label="Telefone" icon={Phone}>
                            <input className="input" value={client.contact_phone || ""} onChange={e => setClient(c => c ? { ...c, contact_phone: e.target.value } : null)} />
                        </Field>
                        <Field label="Status">
                            <select className="input" value={client.status} onChange={e => setClient(c => c ? { ...c, status: e.target.value } : null)}>
                                <option value="active">Ativo</option>
                                <option value="paused">Pausado</option>
                                <option value="archived">Arquivado</option>
                            </select>
                        </Field>
                        <Field label="Notas">
                            <textarea className="input" rows={2} value={client.notes || ""} onChange={e => setClient(c => c ? { ...c, notes: e.target.value } : null)} />
                        </Field>
                    </div>
                    <p className="text-xs muted mt-3">
                        Portal: {client.portal_enabled ? <span style={{ color: "#34d399" }}>ativo (cliente já aceitou convite)</span> : <span>pendente — gere convite no botão acima</span>}
                    </p>
                </section>

                {/* Bloco: contas atribuídas */}
                <section className="glass">
                    <div className="p-4 md:p-5 border-b flex items-center justify-between" style={{ borderColor: "var(--color-glass-border)" }}>
                        <div>
                            <h2 className="font-bold">Contas Meta atribuídas</h2>
                            <p className="text-xs muted mt-1">O cliente verá apenas estas no portal</p>
                        </div>
                        <button onClick={() => setShowAssign(true)} className="btn-primary text-xs"><Plus className="w-3 h-3" /> Atribuir conta</button>
                    </div>
                    {accounts.length === 0 ? (
                        <div className="p-8 text-center muted text-sm">Nenhuma conta atribuída ainda</div>
                    ) : (
                        <ul className="divide-y" style={{ borderColor: "var(--color-glass-border)" }}>
                            {accounts.map(a => (
                                <li key={a.id} className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <p className="font-semibold text-sm">{a.ad_account_name || a.ad_account_id}</p>
                                            <p className="text-xs muted">{a.ad_account_id} · {a.currency || "—"}</p>
                                        </div>
                                        <button onClick={() => unassign(a.ad_account_id)} className="btn-secondary text-xs" style={{ color: "#fca5a5" }}><Trash2 className="w-3 h-3" /></button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {PERM_LABELS.map(p => (
                                            <label key={p.key} className="text-xs flex items-center gap-1.5 px-2 py-1 rounded-md" style={{
                                                background: a.permissions?.[p.key] ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.03)",
                                                border: `1px solid ${a.permissions?.[p.key] ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.08)"}`,
                                                cursor: "pointer",
                                            }}>
                                                <input type="checkbox" checked={!!a.permissions?.[p.key]} onChange={() => togglePerm(a, p.key)} />
                                                {p.label}
                                            </label>
                                        ))}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </main>

            {/* Modal: atribuir conta */}
            {showAssign && (
                <Modal onClose={() => setShowAssign(false)} title="Atribuir conta Meta">
                    {available.length === 0 ? (
                        <p className="muted text-sm">Todas as suas contas Meta já estão atribuídas a este cliente, ou você não tem nenhuma conexão Meta ativa.</p>
                    ) : (
                        <ul className="divide-y max-h-96 overflow-y-auto -m-4" style={{ borderColor: "var(--color-glass-border)" }}>
                            {available.map(m => (
                                <li key={m.id}>
                                    <button onClick={() => assign(m)} className="w-full text-left p-3 hover:bg-white/5">
                                        <p className="font-semibold text-sm">{m.name}</p>
                                        <p className="text-xs muted">act_{m.account_id} · {m.currency}</p>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </Modal>
            )}

            {/* Modal: convidar cliente */}
            {showInvite && (
                <Modal onClose={() => setShowInvite(false)} title="Convidar cliente pro portal">
                    <p className="muted text-sm mb-3">
                        Gere um link de convite e envie pro cliente (WhatsApp/email). Ele cria conta e passa a acessar somente as contas que você atribuiu.
                    </p>
                    <div>
                        <label className="label">Email do cliente</label>
                        <input className="input" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="cliente@empresa.com" />
                    </div>
                    <button onClick={sendInvite} className="btn-primary w-full justify-center mt-3" style={{ padding: "0.65rem" }}>
                        Gerar link de convite
                    </button>
                    {inviteUrl && (
                        <div className="mt-4 glass p-3" style={{ background: "rgba(52,211,153,0.05)", borderColor: "rgba(52,211,153,0.2)" }}>
                            <p className="text-xs muted-strong mb-2">Link válido por 7 dias. Envie pro cliente:</p>
                            <div className="flex gap-2">
                                <input className="input text-xs" value={inviteUrl} readOnly />
                                <button onClick={copyInvite} className="btn-secondary" style={{ padding: "0.55rem 0.75rem" }}>
                                    {copiedInvite ? <Check className="w-4 h-4" style={{ color: "#34d399" }} /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    )}
                </Modal>
            )}
        </div>
    );
}

function Field({ label, icon: Icon, children }: { label: string; icon?: any; children: React.ReactNode }) {
    return (
        <div>
            <label className="label flex items-center gap-1.5">{Icon && <Icon className="w-3 h-3" />} {label}</label>
            {children}
        </div>
    );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
            <div className="glass max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold">{title}</h2>
                    <button onClick={onClose} className="btn-secondary p-2"><X className="w-4 h-4" /></button>
                </div>
                {children}
            </div>
        </div>
    );
}
