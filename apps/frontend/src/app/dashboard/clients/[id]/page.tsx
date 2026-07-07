"use client";
import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowLeft, Loader2, Plus, Trash2, Send, Save, Mail, Phone, Building, X,
    BarChart3, Users, Settings2, RefreshCw, AlertCircle, UserCheck, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";
import KpiGrid from "@/app/dashboard/analytics/components/KpiGrid";
import InsightsTable from "@/app/dashboard/analytics/components/InsightsTable";
import DateRangePicker, { DateRangeValue } from "@/app/dashboard/analytics/components/DateRangePicker";
import { aggregateRow, DEFAULT_KPIS } from "@/app/dashboard/analytics/lib/kpis";
import { load, save } from "@/app/dashboard/analytics/lib/storage";
import "@/app/dashboard/analytics/gestor.css";

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

type Tab = "dados" | "relatorios" | "contas" | "colaboradores";

interface Collaborator {
    userId: string;
    email: string;
    memberRole: "gestor" | "observador";
    clients: { id: string; name: string }[];
    createdAt: string;
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [tab, setTab] = useState<Tab>("dados");
    const [client, setClient] = useState<ClientDetail | null>(null);
    const [accounts, setAccounts] = useState<AssignedAccount[]>([]);
    const [master, setMaster] = useState<MasterAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingClient, setSavingClient] = useState(false);
    const [dirtyAccounts, setDirtyAccounts] = useState<Set<string>>(new Set());
    const [savingPerm, setSavingPerm] = useState<string | null>(null);
    const [showAssign, setShowAssign] = useState(false);

    // Analytics state
    const [period, setPeriod] = useState<DateRangeValue>(() => load("client-analytics:period", { preset: "last_7d" }));
    const [compare, setCompare] = useState<boolean>(() => load("client-analytics:compare", true));
    const [analyticsData, setAnalyticsData] = useState<any[]>([]);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [analyticsError, setAnalyticsError] = useState<string | null>(null);
    const [kpis] = useState<string[]>(() => load("client-analytics:kpis", DEFAULT_KPIS.account));
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [accountDetail, setAccountDetail] = useState<{ campaigns: any[]; daily: any[] } | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [campaignDetail, setCampaignDetail] = useState<{ ads: any[]; daily: any[] } | null>(null);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
    const [campaignLoading, setCampaignLoading] = useState(false);

    // Colaboradores
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [colabLoading, setColabLoading] = useState(false);
    const [showInviteCollab, setShowInviteCollab] = useState(false);
    const [collabEmail, setCollabEmail] = useState("");
    const [collabRole, setCollabRole] = useState<"gestor" | "observador">("observador");
    const [sendingCollab, setSendingCollab] = useState(false);
    const [isAgency, setIsAgency] = useState(false);

    useEffect(() => { save("client-analytics:period", period); }, [period]);
    useEffect(() => { save("client-analytics:compare", compare); }, [compare]);

    // Verifica se o usuário logado é gestor sênior (agency)
    useEffect(() => {
        const sb = createClient();
        sb.auth.getUser().then(({ data: { user } }) => {
            if (!user) return;
            sb.from("profiles").select("role").eq("id", user.id).maybeSingle()
                .then(({ data }) => setIsAgency(data?.role === "agency"));
        });
    }, []);

    const loadPage = async () => {
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
        try {
            const m = await apiFetch<{ success: boolean; accounts: any[] }>("/accounts");
            if (m.success) setMaster(m.accounts);
        } catch { }
        setLoading(false);
    };
    useEffect(() => { loadPage(); /* eslint-disable-line */ }, [id]);

    const buildPeriodParams = useCallback(() => {
        const p = new URLSearchParams();
        if (period.preset) p.set("period", period.preset);
        if (period.since) p.set("since", period.since);
        if (period.until) p.set("until", period.until);
        p.set("compare", String(compare));
        return p;
    }, [period, compare]);

    const fetchAnalytics = useCallback(async (accountList: AssignedAccount[]) => {
        if (accountList.length === 0) { setAnalyticsData([]); return; }
        setAnalyticsLoading(true); setAnalyticsError(null);
        try {
            const ids = accountList.map(a => a.ad_account_id).join(",");
            const params = buildPeriodParams();
            params.set("ids", ids);
            const res = await fetch(`/api/meugestor/accounts?${params.toString()}`);
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Erro ao buscar dados");
            setAnalyticsData(json.data);
        } catch (e: any) { setAnalyticsError(e.message); }
        finally { setAnalyticsLoading(false); }
    }, [buildPeriodParams]);

    const fetchAccountDetail = useCallback(async (accId: string) => {
        setDetailLoading(true);
        try {
            const params = buildPeriodParams();
            const res = await fetch(`/api/meugestor/accounts/${encodeURIComponent(accId)}?${params.toString()}`);
            const json = await res.json();
            if (json.success) {
                const daily = (json.data.daily || []).map((d: any) => {
                    const parts = (d.date_start || "").split("-");
                    return { ...d, date: `${parts[2]}/${parts[1]}` };
                });
                setAccountDetail({ campaigns: json.data.campaigns, daily });
            }
        } catch { }
        finally { setDetailLoading(false); }
    }, [buildPeriodParams]);

    const fetchCampaignDetail = useCallback(async (campId: string) => {
        setCampaignLoading(true);
        try {
            const params = buildPeriodParams();
            const res = await fetch(`/api/meugestor/campaigns/${encodeURIComponent(campId)}?${params.toString()}`);
            const json = await res.json();
            if (json.success) {
                const daily = (json.data.daily || []).map((d: any) => {
                    const parts = (d.date_start || "").split("-");
                    return { ...d, date: `${parts[2]}/${parts[1]}` };
                });
                setCampaignDetail({ ads: json.data.ads, daily });
            }
        } catch { }
        finally { setCampaignLoading(false); }
    }, [buildPeriodParams]);

    useEffect(() => {
        if (tab === "relatorios" && accounts.length > 0) fetchAnalytics(accounts);
    }, [tab, accounts, fetchAnalytics]);

    useEffect(() => {
        if (selectedAccountId) fetchAccountDetail(selectedAccountId);
    }, [selectedAccountId, fetchAccountDetail]);

    useEffect(() => {
        if (selectedCampaignId) fetchCampaignDetail(selectedCampaignId);
    }, [selectedCampaignId, fetchCampaignDetail]);

    const aggregated = analyticsData.length > 0 ? aggregateRow(analyticsData) : null;

    const loadCollaborators = async () => {
        setColabLoading(true);
        try {
            const data = await apiFetch<{ members: Collaborator[] }>("/members");
            setCollaborators(data.members.filter(m => m.clients.some(c => c.id === id)));
        } catch { }
        finally { setColabLoading(false); }
    };

    useEffect(() => {
        if (tab === "colaboradores") loadCollaborators();
    }, [tab]); // eslint-disable-line

    const inviteCollab = async () => {
        if (!collabEmail) { toast.error("Email obrigatório"); return; }
        setSendingCollab(true);
        try {
            const res = await apiFetch<{ ok: boolean; inviteUrl: string; emailSent: boolean }>("/members/invite", {
                method: "POST",
                body: { email: collabEmail, member_role: collabRole, client_ids: [id] },
            });
            if (res.emailSent) {
                toast.success("Convite enviado para " + collabEmail);
            } else {
                try { await navigator.clipboard.writeText(res.inviteUrl); } catch { }
                toast.success("Link de convite copiado! Cole e envie para " + collabEmail, { duration: 6000 });
            }
            setShowInviteCollab(false);
            setCollabEmail("");
            setCollabRole("observador");
            loadCollaborators();
        } catch (e: any) { toast.error(e.message); }
        finally { setSendingCollab(false); }
    };

    const removeCollab = async (userId: string) => {
        if (!confirm("Remover este colaborador da organização?")) return;
        try {
            await apiFetch(`/members/${userId}`, { method: "DELETE" });
            setCollaborators(prev => prev.filter(c => c.userId !== userId));
            toast.success("Colaborador removido");
        } catch (e: any) { toast.error(e.message); }
    };

    const changeCollabRole = async (userId: string, newRole: "gestor" | "observador") => {
        try {
            await apiFetch(`/members/${userId}`, { method: "PATCH", body: { member_role: newRole } });
            setCollaborators(prev => prev.map(c => c.userId === userId ? { ...c, memberRole: newRole } : c));
            toast.success("Papel alterado");
        } catch (e: any) { toast.error(e.message); }
    };

    const saveClient = async () => {
        if (!client) return;
        setSavingClient(true);
        try {
            await apiFetch(`/clients/${id}`, {
                method: "PATCH",
                body: {
                    name: client.name, contact_email: client.contact_email,
                    contact_phone: client.contact_phone, company: client.company,
                    notes: client.notes, status: client.status,
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
                body: { ad_account_id: adAccountId, ad_account_name: acc.name, currency: acc.currency },
            });
            toast.success("Atribuída");
            setShowAssign(false);
            setAccounts(prev => [...prev, {
                id: `new-${Date.now()}`,
                ad_account_id: adAccountId,
                ad_account_name: acc.name,
                currency: acc.currency,
                permissions: { view_campaigns: true, view_insights: true, view_creatives: true, view_budget: true, view_audiences: true },
            }]);
        } catch (e: any) { toast.error(e.message); }
    };

    const unassign = async (adAccountId: string) => {
        if (!confirm("Remover essa conta do acesso do cliente?")) return;
        try {
            await apiFetch(`/clients/${id}/accounts?ad_account_id=${encodeURIComponent(adAccountId)}`, { method: "DELETE" });
            toast.success("Removida");
            setAccounts(prev => prev.filter(a => a.ad_account_id !== adAccountId));
            setDirtyAccounts(prev => { const s = new Set(prev); s.delete(adAccountId); return s; });
        } catch (e: any) { toast.error(e.message); }
    };

    const togglePerm = (acc: AssignedAccount, key: string) => {
        const next = { ...acc.permissions, [key]: !acc.permissions[key] };
        setAccounts(prev => prev.map(a => a.ad_account_id === acc.ad_account_id ? { ...a, permissions: next } : a));
        setDirtyAccounts(prev => new Set([...prev, acc.ad_account_id]));
    };

    const savePerms = async (acc: AssignedAccount) => {
        setSavingPerm(acc.ad_account_id);
        try {
            await apiFetch(`/clients/${id}/accounts`, {
                method: "PATCH",
                body: { ad_account_id: acc.ad_account_id, permissions: acc.permissions },
            });
            setDirtyAccounts(prev => { const s = new Set(prev); s.delete(acc.ad_account_id); return s; });
            toast.success("Permissões salvas");
        } catch (e: any) { toast.error(e.message); }
        finally { setSavingPerm(null); }
    };


    if (loading || !client) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin muted" /></div>;
    }

    const assignedIds = new Set(accounts.map(a => a.ad_account_id));
    const available = master.filter(m => {
        const norm = m.account_id.startsWith("act_") ? m.account_id : `act_${m.account_id}`;
        return !assignedIds.has(norm);
    });

    const analyticsMetrics = ["spend", "impressions", "ctr", "cpc", "cpm", "leads", "roas"];
    const campaignMetrics  = ["spend", "impressions", "ctr", "cpc", "leads", "roas"];
    const adMetrics        = ["spend", "impressions", "ctr", "cpc", "leads", "hook_rate"];

    return (
        <div className="min-h-screen">
            <header className="flex items-center justify-between px-4 md:px-6 py-4 border-b" style={{ borderColor: "var(--color-glass-border)" }}>
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/clients" className="btn-secondary"><ArrowLeft className="w-4 h-4" /></Link>
                    <div>
                        <h1 className="font-bold">{client.name}</h1>
                        <p className="text-xs muted">{client.company || "Sem empresa"} · {accounts.length} conta{accounts.length !== 1 ? "s" : ""}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={removeClient} className="btn-secondary" style={{ color: "#fca5a5" }}><Trash2 className="w-4 h-4" /></button>
                </div>
            </header>

            {/* Tabs */}
            <div className="border-b px-4 md:px-6 flex gap-1" style={{ borderColor: "var(--color-glass-border)" }}>
                {([
                    { id: "dados" as Tab,           label: "Dados",          icon: Users },
                    { id: "relatorios" as Tab,       label: "Relatórios",     icon: BarChart3 },
                    { id: "contas" as Tab,           label: "Contas",         icon: Settings2 },
                    ...(isAgency ? [{ id: "colaboradores" as Tab, label: "Colaboradores", icon: UserCheck }] : []),
                ]).map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className="flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition-colors"
                        style={{
                            borderBottomColor: tab === t.id ? "#a78bfa" : "transparent",
                            color: tab === t.id ? "white" : "rgba(255,255,255,0.4)",
                        }}
                    >
                        <t.icon className="w-4 h-4" /> {t.label}
                    </button>
                ))}
            </div>

            <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">

                {/* ── TAB: DADOS ── */}
                {tab === "dados" && (
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
                            Portal:{" "}
                            {client.portal_enabled
                                ? <span style={{ color: "#34d399" }}>ativo (cliente aceitou convite)</span>
                                : <span>pendente</span>}
                        </p>
                    </section>
                )}

                {/* ── TAB: RELATÓRIOS ── */}
                {tab === "relatorios" && (
                    <div className="space-y-4">
                        {accounts.length === 0 ? (
                            <div className="glass p-8 text-center">
                                <BarChart3 className="w-8 h-8 mx-auto mb-3 muted" />
                                <p className="muted text-sm">Nenhuma conta Meta atribuída ainda.</p>
                                <button onClick={() => setTab("contas")} className="btn-primary mt-3 text-xs">Atribuir conta →</button>
                            </div>
                        ) : (
                            <>
                                {/* Controles de período */}
                                <div className="flex flex-wrap items-center gap-3">
                                    <DateRangePicker
                                        value={period}
                                        onChange={p => setPeriod(p)}
                                        compare={compare}
                                        onCompareChange={v => setCompare(v)}
                                    />
                                    <button
                                        onClick={() => fetchAnalytics(accounts)}
                                        disabled={analyticsLoading}
                                        className="btn-secondary text-xs"
                                        title="Recarregar"
                                    >
                                        <RefreshCw className={`w-3 h-3 ${analyticsLoading ? "animate-spin" : ""}`} />
                                    </button>
                                </div>

                                {analyticsError && (
                                    <div className="glass p-4 flex items-center gap-2 text-sm" style={{ color: "#fca5a5" }}>
                                        <AlertCircle className="w-4 h-4" /> {analyticsError}
                                    </div>
                                )}

                                {analyticsLoading ? (
                                    <div className="glass p-8 flex items-center justify-center gap-3">
                                        <Loader2 className="w-5 h-5 animate-spin muted" />
                                        <span className="muted text-sm">Carregando dados Meta...</span>
                                    </div>
                                ) : analyticsData.length > 0 ? (
                                    <>
                                        {/* KPIs agregados */}
                                        <div className="glass p-4">
                                            <p className="text-xs muted uppercase tracking-wide mb-3">
                                                Resumo — {accounts.length} conta{accounts.length > 1 ? "s" : ""}
                                            </p>
                                            <KpiGrid
                                                ctx="account"
                                                row={aggregated}
                                                selected={kpis}
                                            />
                                        </div>

                                        {/* Tabela por conta */}
                                        <InsightsTable
                                            rows={analyticsData}
                                            selectedMetrics={analyticsMetrics}
                                            nameKey="name"
                                            nameLabel="Conta"
                                            idKey="id"
                                            onRowClick={(row) => {
                                                if (selectedAccountId === row.id) {
                                                    setSelectedAccountId(null);
                                                    setAccountDetail(null);
                                                    setSelectedCampaignId(null);
                                                    setCampaignDetail(null);
                                                } else {
                                                    setSelectedAccountId(row.id);
                                                    setAccountDetail(null);
                                                    setSelectedCampaignId(null);
                                                    setCampaignDetail(null);
                                                }
                                            }}
                                        />

                                        {/* Detalhe da conta selecionada */}
                                        {selectedAccountId && (
                                            <div className="glass p-4 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-semibold text-sm">
                                                        {analyticsData.find(a => a.id === selectedAccountId)?.name || selectedAccountId}
                                                        {" — campanhas"}
                                                    </p>
                                                    <button
                                                        onClick={() => { setSelectedAccountId(null); setAccountDetail(null); }}
                                                        className="btn-secondary text-xs"
                                                    >
                                                        <X className="w-3 h-3" /> Fechar
                                                    </button>
                                                </div>
                                                {detailLoading ? (
                                                    <div className="flex items-center gap-2 muted text-sm">
                                                        <Loader2 className="w-4 h-4 animate-spin" /> Carregando campanhas...
                                                    </div>
                                                ) : accountDetail ? (
                                                    <>
                                                        <InsightsTable
                                                            rows={accountDetail.campaigns}
                                                            selectedMetrics={campaignMetrics}
                                                            nameKey="campaign_name"
                                                            nameLabel="Campanha"
                                                            idKey="campaign_id"
                                                            onRowClick={(row) => {
                                                                if (selectedCampaignId === row.campaign_id) {
                                                                    setSelectedCampaignId(null);
                                                                    setCampaignDetail(null);
                                                                } else {
                                                                    setSelectedCampaignId(row.campaign_id);
                                                                    setCampaignDetail(null);
                                                                }
                                                            }}
                                                        />
                                                        {selectedCampaignId && (
                                                            campaignLoading ? (
                                                                <div className="flex items-center gap-2 muted text-sm">
                                                                    <Loader2 className="w-4 h-4 animate-spin" /> Carregando anúncios...
                                                                </div>
                                                            ) : campaignDetail ? (
                                                                <InsightsTable
                                                                    rows={campaignDetail.ads}
                                                                    selectedMetrics={adMetrics}
                                                                    nameKey="ad_name"
                                                                    nameLabel="Anúncio"
                                                                    idKey="ad_id"
                                                                />
                                                            ) : null
                                                        )}
                                                    </>
                                                ) : null}
                                            </div>
                                        )}
                                    </>
                                ) : !analyticsLoading && !analyticsError ? (
                                    <div className="glass p-8 text-center muted text-sm">
                                        Sem dados para o período selecionado.
                                    </div>
                                ) : null}
                            </>
                        )}
                    </div>
                )}

                {/* ── TAB: CONTAS META ── */}
                {tab === "contas" && (
                    <section className="glass">
                        <div className="p-4 md:p-5 border-b flex items-center justify-between" style={{ borderColor: "var(--color-glass-border)" }}>
                            <div>
                                <h2 className="font-bold">Contas Meta atribuídas</h2>
                                <p className="text-xs muted mt-1">O cliente vê apenas estas no portal</p>
                            </div>
                            <button onClick={() => setShowAssign(true)} className="btn-primary text-xs">
                                <Plus className="w-3 h-3" /> Atribuir
                            </button>
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
                                            <button
                                                onClick={() => unassign(a.ad_account_id)}
                                                className="btn-secondary text-xs"
                                                style={{ color: "#fca5a5" }}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 items-center">
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
                                            {dirtyAccounts.has(a.ad_account_id) && (
                                                <button
                                                    onClick={() => savePerms(a)}
                                                    disabled={savingPerm === a.ad_account_id}
                                                    className="btn-primary text-xs ml-auto"
                                                    style={{ padding: "0.25rem 0.75rem" }}
                                                >
                                                    {savingPerm === a.ad_account_id
                                                        ? <><Loader2 className="w-3 h-3 animate-spin" /> Salvando...</>
                                                        : <><Save className="w-3 h-3" /> Salvar</>
                                                    }
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                )}
                {/* ── TAB: COLABORADORES ── */}
                {tab === "colaboradores" && (
                    <section className="glass">
                        <div className="p-4 md:p-5 border-b flex items-center justify-between" style={{ borderColor: "var(--color-glass-border)" }}>
                            <div>
                                <h2 className="font-bold">Colaboradores</h2>
                                <p className="text-xs muted mt-1">Gestores e observadores com acesso a este cliente</p>
                            </div>
                            <button onClick={() => { setShowInviteCollab(true); setCollabEmail(""); setCollabRole("observador"); }} className="btn-primary text-xs">
                                <Plus className="w-3 h-3" /> Convidar
                            </button>
                        </div>

                        {colabLoading ? (
                            <div className="p-8 flex items-center justify-center gap-2 muted text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                            </div>
                        ) : collaborators.length === 0 ? (
                            <div className="p-8 text-center muted text-sm">
                                <UserCheck className="w-8 h-8 mx-auto mb-3 opacity-30" />
                                <p>Nenhum colaborador adicionado ainda.</p>
                                <p className="text-xs mt-1">Convide um gestor ou observador para este cliente.</p>
                            </div>
                        ) : (
                            <ul className="divide-y" style={{ borderColor: "var(--color-glass-border)" }}>
                                {collaborators.map(c => (
                                    <li key={c.userId} className="p-4 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ background: "rgba(124,58,237,0.2)", color: "#a78bfa" }}>
                                            {c.email.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{c.email}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs px-2 py-0.5 rounded-full" style={{
                                                    background: c.memberRole === "gestor" ? "rgba(124,58,237,0.15)" : "rgba(52,211,153,0.1)",
                                                    color: c.memberRole === "gestor" ? "#a78bfa" : "#34d399",
                                                    border: `1px solid ${c.memberRole === "gestor" ? "rgba(124,58,237,0.3)" : "rgba(52,211,153,0.25)"}`,
                                                }}>
                                                    {c.memberRole === "gestor" ? "Gestor" : "Observador"}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <div className="relative">
                                                <select
                                                    value={c.memberRole}
                                                    onChange={e => changeCollabRole(c.userId, e.target.value as "gestor" | "observador")}
                                                    className="input text-xs"
                                                    style={{ padding: "0.25rem 1.5rem 0.25rem 0.5rem", appearance: "none" }}
                                                >
                                                    <option value="gestor">Gestor</option>
                                                    <option value="observador">Observador</option>
                                                </select>
                                                <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none muted" />
                                            </div>
                                            <button
                                                onClick={() => removeCollab(c.userId)}
                                                className="btn-secondary p-2"
                                                style={{ color: "#fca5a5" }}
                                                title="Remover colaborador"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                )}
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

            {/* Modal: convidar colaborador */}
            {showInviteCollab && (
                <Modal onClose={() => setShowInviteCollab(false)} title="Convidar colaborador">
                    <p className="muted text-sm mb-4">
                        O colaborador receberá acesso apenas a este cliente com o papel selecionado.
                    </p>
                    <div className="space-y-3">
                        <div>
                            <label className="label">Email do colaborador</label>
                            <input
                                className="input"
                                type="email"
                                value={collabEmail}
                                onChange={e => setCollabEmail(e.target.value)}
                                placeholder="colaborador@empresa.com"
                                autoFocus
                                onKeyDown={e => e.key === "Enter" && inviteCollab()}
                            />
                        </div>
                        <div>
                            <label className="label">Papel</label>
                            <div className="flex gap-2">
                                {(["gestor", "observador"] as const).map(r => (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => setCollabRole(r)}
                                        className="flex-1 py-2 text-sm rounded-lg font-medium transition-all"
                                        style={{
                                            background: collabRole === r
                                                ? r === "gestor" ? "rgba(124,58,237,0.25)" : "rgba(52,211,153,0.15)"
                                                : "rgba(255,255,255,0.04)",
                                            color: collabRole === r
                                                ? r === "gestor" ? "#a78bfa" : "#34d399"
                                                : "rgba(255,255,255,0.4)",
                                            border: `1px solid ${collabRole === r
                                                ? r === "gestor" ? "rgba(124,58,237,0.4)" : "rgba(52,211,153,0.3)"
                                                : "rgba(255,255,255,0.08)"}`,
                                        }}
                                    >
                                        {r === "gestor" ? "Gestor" : "Observador"}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs muted mt-2">
                                {collabRole === "gestor"
                                    ? "Gestor pode gerenciar clientes e ver todos os dados."
                                    : "Observador pode apenas visualizar dados, sem editar."}
                            </p>
                        </div>
                        <button
                            onClick={inviteCollab}
                            disabled={sendingCollab}
                            className="btn-primary w-full justify-center mt-1"
                            style={{ padding: "0.65rem" }}
                        >
                            {sendingCollab
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                                : <><Send className="w-4 h-4" /> Enviar convite</>
                            }
                        </button>
                    </div>
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
