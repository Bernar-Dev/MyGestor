"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";
import {
    BarChart3, LayoutDashboard, Lightbulb,
    ChevronLeft, RefreshCw, Loader2, AlertCircle,
    Building2, Layers, Hash, Brain, X, LogOut, Menu,
} from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    LineChart, Line, CartesianGrid,
} from "recharts";

import { load, save, KEYS } from "@/app/dashboard/analytics/lib/storage";
import { PRESETS } from "@/app/dashboard/analytics/lib/metrics";
import { formatCurrency } from "@/app/dashboard/analytics/lib/format";
import { DEFAULT_KPIS, KpiCtx, aggregateRow } from "@/app/dashboard/analytics/lib/kpis";

import KpiGrid from "@/app/dashboard/analytics/components/KpiGrid";
import KpiPicker from "@/app/dashboard/analytics/components/KpiPicker";
import MetricsPicker from "@/app/dashboard/analytics/components/MetricsPicker";
import DateRangePicker, { DateRangeValue } from "@/app/dashboard/analytics/components/DateRangePicker";
import BudgetPacing from "@/app/dashboard/analytics/components/BudgetPacing";
import BreakdownsPanel from "@/app/dashboard/analytics/components/BreakdownsPanel";
import CreativePreview from "@/app/dashboard/analytics/components/CreativePreview";
import ActiveAdsList from "@/app/dashboard/analytics/components/ActiveAdsList";
import SmartInsights from "@/app/dashboard/analytics/components/SmartInsights";
import InsightsTable from "@/app/dashboard/analytics/components/InsightsTable";
import { SkeletonDashboard, SkeletonAccountDetail, SkeletonCampaignDetail, SkeletonTable } from "@/app/dashboard/analytics/components/Skeleton";
import CmdK, { CmdItem } from "@/app/dashboard/analytics/components/CmdK";

const DEFAULT_ACCOUNT_METRICS = PRESETS["Diagnóstico"];
const DEFAULT_CAMPAIGN_METRICS = ["spend", "impressions", "ctr", "inline_link_clicks", "cpc", "cpm", "leads", "cpl", "messaging_started", "frequency"];
const DEFAULT_ADSET_METRICS = ["spend", "impressions", "ctr", "inline_link_clicks", "cpc", "cpm", "leads", "cpl", "messaging_started", "frequency"];
const DEFAULT_AD_METRICS = ["spend", "impressions", "ctr", "cpc", "leads", "cpl", "messaging_started", "hook_rate", "hold_rate", "frequency"];

const PAGES = [
    { id: "dashboard", label: "Painel Geral", icon: LayoutDashboard },
    { id: "insights",  label: "Insights",    icon: Lightbulb },
];

interface PortalMe {
    client: { id: string; name: string; company: string | null };
    agency: { name: string; logo_url: string | null; primary_color: string };
    accounts: { ad_account_id: string; ad_account_name: string | null; currency: string | null; permissions: Record<string, boolean> }[];
}

export default function PortalDashboard() {
    const router = useRouter();
    const [me, setMe] = useState<PortalMe | null>(null);
    const [meError, setMeError] = useState("");

    // Navegação
    const [currentPage, setCurrentPage] = useState("dashboard");
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
    const [selectedAdsetId, setSelectedAdsetId] = useState<string | null>(null);
    const [selectedAdId, setSelectedAdId] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Filtros
    const [period, setPeriod] = useState<DateRangeValue>({ preset: "last_7d" });
    const [compare, setCompare] = useState(true);

    // Dados
    const [accounts, setAccounts] = useState<any[]>([]);
    const [periodMeta, setPeriodMeta] = useState<any>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [accountDetail, setAccountDetail] = useState<{ campaigns: any[]; daily: any[]; adsets: any[] } | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [campaignDetail, setCampaignDetail] = useState<{ ads: any[]; daily: any[] } | null>(null);
    const [loadingCampaign, setLoadingCampaign] = useState(false);

    // Métricas / KPIs
    const [accountMetrics, setAccountMetrics] = useState<string[]>(DEFAULT_ACCOUNT_METRICS);
    const [campaignMetrics, setCampaignMetrics] = useState<string[]>(DEFAULT_CAMPAIGN_METRICS);
    const [adsetMetrics, setAdsetMetrics] = useState<string[]>(DEFAULT_ADSET_METRICS);
    const [adMetrics, setAdMetrics] = useState<string[]>(DEFAULT_AD_METRICS);
    const [dashboardKpis, setDashboardKpis] = useState<string[]>(DEFAULT_KPIS.dashboard);
    const [accountKpis, setAccountKpis] = useState<string[]>(DEFAULT_KPIS.account);
    const [campaignKpis, setCampaignKpis] = useState<string[]>(DEFAULT_KPIS.campaign);
    const [adsetKpis, setAdsetKpis] = useState<string[]>(DEFAULT_KPIS.adset);
    const [adKpis, setAdKpis] = useState<string[]>(DEFAULT_KPIS.ad);

    // Modais
    const [pickerOpen, setPickerOpen] = useState<null | "account" | "campaign" | "adset" | "ad">(null);
    const [kpiPickerOpen, setKpiPickerOpen] = useState<null | KpiCtx>(null);
    const [cmdkOpen, setCmdkOpen] = useState(false);

    // Hidrata localStorage
    useEffect(() => {
        setAccountMetrics(load(KEYS.metricsByLevel + ":account", DEFAULT_ACCOUNT_METRICS));
        setCampaignMetrics(load(KEYS.metricsByLevel + ":campaign", DEFAULT_CAMPAIGN_METRICS));
        setAdsetMetrics(load(KEYS.metricsByLevel + ":adset", DEFAULT_ADSET_METRICS));
        setAdMetrics(load(KEYS.metricsByLevel + ":ad", DEFAULT_AD_METRICS));
        setDashboardKpis(load("kpis:dashboard", DEFAULT_KPIS.dashboard));
        setAccountKpis(load("kpis:account", DEFAULT_KPIS.account));
        setCampaignKpis(load("kpis:campaign", DEFAULT_KPIS.campaign));
        setAdsetKpis(load("kpis:adset", DEFAULT_KPIS.adset));
        setAdKpis(load("kpis:ad", DEFAULT_KPIS.ad));
        setPeriod(load(KEYS.period, { preset: "last_7d" }));
        setCompare(load(KEYS.compare, true));
        const isMobile = typeof window !== "undefined" && window.innerWidth < 769;
        setSidebarOpen(!isMobile);
    }, []);

    useEffect(() => save(KEYS.period, period), [period]);
    useEffect(() => save(KEYS.compare, compare), [compare]);

    // Cmd+K
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault(); setCmdkOpen(true);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const logout = async () => {
        await createClient().auth.signOut();
        router.push("/login?mode=convidado");
    };

    // Carrega dados do portal (agência + contas)
    useEffect(() => {
        apiFetch<PortalMe>("/portal/me")
            .then(j => setMe(j))
            .catch((e: any) => setMeError(e.message || "Erro ao carregar portal"));
    }, []);

    const accountIds = useMemo(
        () => me?.accounts.map(a => a.ad_account_id).join(",") ?? "",
        [me],
    );

    const buildPeriodParams = useCallback(() => {
        const p = new URLSearchParams();
        if (period.preset) p.set("period", period.preset);
        if (period.since) p.set("since", period.since);
        if (period.until) p.set("until", period.until);
        p.set("compare", String(compare));
        return p;
    }, [period, compare]);

    const accountsAbortRef = useRef<AbortController | null>(null);
    const fetchAccounts = useCallback(async () => {
        if (!accountIds) return;
        accountsAbortRef.current?.abort();
        const ctrl = new AbortController();
        accountsAbortRef.current = ctrl;
        setLoading(true); setError(null);
        try {
            const params = buildPeriodParams();
            params.set("ids", accountIds);
            const res = await fetch(`/api/meugestor/accounts?${params}`, { signal: ctrl.signal });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Erro ao buscar dados");
            setAccounts(json.data);
            setPeriodMeta(json.period);
        } catch (e: any) {
            if (e.name !== "AbortError") setError(e.message);
        } finally {
            if (accountsAbortRef.current === ctrl) setLoading(false);
        }
    }, [buildPeriodParams, accountIds]);

    useEffect(() => { if (accountIds) fetchAccounts(); }, [fetchAccounts, accountIds]);

    const detailAbortRef = useRef<AbortController | null>(null);
    const fetchAccountDetail = useCallback(async (id: string) => {
        detailAbortRef.current?.abort();
        const ctrl = new AbortController();
        detailAbortRef.current = ctrl;
        setLoadingDetail(true);
        try {
            const res = await fetch(`/api/meugestor/accounts/${id}?${buildPeriodParams()}`, { signal: ctrl.signal });
            const json = await res.json();
            if (json.success) {
                const daily = (json.data.daily || []).map((d: any) => {
                    const [, m, day] = (d.date_start || "").split("-");
                    return { ...d, date: `${day}/${m}` };
                });
                setAccountDetail({ campaigns: json.data.campaigns, daily, adsets: json.data.adsets });
            }
        } catch (e: any) { if (e.name !== "AbortError") console.error(e); }
        finally { if (detailAbortRef.current === ctrl) setLoadingDetail(false); }
    }, [buildPeriodParams]);

    const campaignAbortRef = useRef<AbortController | null>(null);
    const fetchCampaignDetail = useCallback(async (id: string) => {
        campaignAbortRef.current?.abort();
        const ctrl = new AbortController();
        campaignAbortRef.current = ctrl;
        setLoadingCampaign(true);
        try {
            const res = await fetch(`/api/meugestor/campaigns/${id}?${buildPeriodParams()}`, { signal: ctrl.signal });
            const json = await res.json();
            if (json.success) {
                const daily = (json.data.daily || []).map((d: any) => {
                    const [, m, day] = (d.date_start || "").split("-");
                    return { ...d, date: `${day}/${m}` };
                });
                setCampaignDetail({ ads: json.data.ads, daily });
            }
        } catch (e: any) { if (e.name !== "AbortError") console.error(e); }
        finally { if (campaignAbortRef.current === ctrl) setLoadingCampaign(false); }
    }, [buildPeriodParams]);

    useEffect(() => { if (selectedAccountId) fetchAccountDetail(selectedAccountId); }, [selectedAccountId, fetchAccountDetail]);
    useEffect(() => { if (selectedCampaignId) fetchCampaignDetail(selectedCampaignId); }, [selectedCampaignId, fetchCampaignDetail]);

    const handleSelectAccount = (id: string) => {
        setSelectedAccountId(id); setSelectedCampaignId(null);
        setSelectedAdsetId(null); setSelectedAdId(null); setAccountDetail(null);
    };
    const handleSelectCampaign = (id: string) => {
        setSelectedCampaignId(id); setSelectedAdsetId(null);
        setSelectedAdId(null); setCampaignDetail(null);
    };
    const handleSelectAdset = (id: string) => { setSelectedAdsetId(id); setSelectedAdId(null); };
    const handleBack = () => {
        if (selectedAdId) { setSelectedAdId(null); return; }
        if (selectedAdsetId) { setSelectedAdsetId(null); return; }
        if (selectedCampaignId) { setSelectedCampaignId(null); setSelectedAdsetId(null); setCampaignDetail(null); return; }
        setSelectedAccountId(null); setAccountDetail(null);
    };

    const selectedAccount = useMemo(() => accounts.find(a => a.id === selectedAccountId), [accounts, selectedAccountId]);
    const dashboardAggRow = useMemo(() => aggregateRow(accounts), [accounts]);
    const campaignAdsets = useMemo(() => {
        if (!selectedCampaignId || !accountDetail?.adsets) return [];
        return accountDetail.adsets.filter((a: any) => a.campaign_id === selectedCampaignId);
    }, [selectedCampaignId, accountDetail]);
    const adsetAds = useMemo(() => {
        if (!selectedAdsetId || !campaignDetail?.ads) return [];
        return campaignDetail.ads.filter((a: any) => a.adset_id === selectedAdsetId);
    }, [selectedAdsetId, campaignDetail]);
    const selectedAdset = useMemo(() =>
        accountDetail?.adsets?.find((a: any) => a.adset_id === selectedAdsetId),
        [accountDetail, selectedAdsetId]);

    const cmdItems: CmdItem[] = useMemo(() => {
        const items: CmdItem[] = [];
        for (const a of accounts) {
            items.push({ id: a.id, title: a.name || a.account_id, subtitle: `${formatCurrency(a.spend)} · ${a.leads || 0} leads`, type: "account", onSelect: () => handleSelectAccount(a.id) });
        }
        if (accountDetail?.campaigns) {
            for (const c of accountDetail.campaigns) {
                items.push({ id: c.campaign_id, title: c.campaign_name, subtitle: `${formatCurrency(c.spend)}`, type: "campaign", onSelect: () => handleSelectCampaign(c.campaign_id) });
            }
        }
        return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accounts, accountDetail]);

    const periodLabel = periodMeta?.range
        ? `${periodMeta.range.since} → ${periodMeta.range.until}`
        : (period.since && period.until ? `${period.since} → ${period.until}` : (period.preset || "—"));

    const color = me?.agency.primary_color || "#7c3aed";
    const anyLoading = loading || loadingDetail || loadingCampaign;

    if (meError) return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="glass p-6 max-w-md text-center">
                <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: "#fca5a5" }} />
                <p className="muted mb-4">{meError}</p>
                <button onClick={logout} className="btn-secondary">Sair</button>
            </div>
        </div>
    );

    if (!me) return (
        <div className="gestor-root" style={{ minHeight: "100vh", padding: "1.5rem 2rem", paddingTop: "5rem" }}>
            <div className="g-loadbar" />
            <SkeletonDashboard kpiCount={6} />
        </div>
    );

    return (
        <div style={{ minHeight: "100vh" }}>
            {anyLoading && <div className="g-loadbar" />}

            {/* SIDEBAR */}
            {sidebarOpen && <div className="g-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
            <aside className={`g-sidebar ${sidebarOpen ? "is-open" : ""}`} style={{
                position: "fixed", left: 0, top: 0, bottom: 0, width: sidebarOpen ? 240 : 72, zIndex: 50,
                background: "rgba(10,12,28,0.95)", borderRight: "1px solid var(--glass-border)",
                backdropFilter: "blur(20px)", display: "flex", flexDirection: "column", transition: "width 0.3s ease",
            }}>
                <div style={{ height: 72, display: "flex", alignItems: "center", justifyContent: sidebarOpen ? "space-between" : "center", padding: sidebarOpen ? "0 1.25rem" : "0", borderBottom: "1px solid var(--glass-border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        {me.agency.logo_url
                            ? <img src={me.agency.logo_url} alt="" style={{ width: 34, height: 34, borderRadius: "0.65rem", objectFit: "cover" }} />
                            : <div style={{ width: 34, height: 34, borderRadius: "0.65rem", display: "flex", alignItems: "center", justifyContent: "center", background: color }}>
                                <BarChart3 style={{ width: 18, height: 18, color: "white" }} />
                              </div>}
                        {sidebarOpen && <div>
                            <h1 style={{ color: "white", fontWeight: 700, fontSize: "0.9rem" }}>{me.agency.name}</h1>
                            <p style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.35)" }}>{me.client.name}</p>
                        </div>}
                    </div>
                    {sidebarOpen && <button onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}><X style={{ width: 18, height: 18 }} /></button>}
                </div>

                <nav style={{ padding: "0.85rem 0.5rem 0.4rem" }}>
                    {PAGES.map(p => {
                        const Icon = p.icon;
                        const active = currentPage === p.id && !selectedAccountId;
                        return (
                            <button key={p.id} onClick={() => { setCurrentPage(p.id); setSelectedAccountId(null); setSelectedCampaignId(null); }}
                                className={`g-sidebar-link ${active ? "active" : ""}`}
                                style={{ justifyContent: sidebarOpen ? "flex-start" : "center", padding: sidebarOpen ? "0.6rem 0.85rem" : "0.6rem", fontSize: "0.82rem" }}>
                                <Icon style={{ width: 18, height: 18 }} />
                                {sidebarOpen && <span>{p.label}</span>}
                            </button>
                        );
                    })}
                </nav>

                <div style={{ flex: 1 }} />

                <div style={{ padding: "0.85rem", borderTop: "1px solid var(--glass-border)" }}>
                    <button onClick={logout} className="g-btn-secondary"
                        style={{ width: "100%", display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem", fontSize: "0.75rem", justifyContent: sidebarOpen ? "flex-start" : "center", color: "#fca5a5" }}>
                        <LogOut style={{ width: 14, height: 14 }} />
                        {sidebarOpen && "Sair"}
                    </button>
                </div>
            </aside>

            {/* MAIN */}
            <main className="g-main" style={{ marginLeft: sidebarOpen ? 240 : 72, minHeight: "100vh", transition: "margin-left 0.3s ease" }}>
                {/* TOPBAR */}
                <header className="g-header" style={{
                    position: "sticky", top: 0, zIndex: 40, minHeight: 72,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0 1.5rem", background: "rgba(15,18,37,0.92)",
                    borderBottom: "1px solid var(--glass-border)", backdropFilter: "blur(20px)",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                        {!sidebarOpen && (
                            <button onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", color: "white", cursor: "pointer", display: "flex" }}>
                                <Menu style={{ width: 22, height: 22 }} />
                            </button>
                        )}
                        {(selectedAccountId || selectedCampaignId || selectedAdsetId || selectedAdId) && (
                            <button onClick={handleBack} className="g-btn-secondary" style={{ padding: "0.4rem", display: "inline-flex" }}>
                                <ChevronLeft style={{ width: 16, height: 16 }} />
                            </button>
                        )}
                        <div>
                            <h1 style={{ fontSize: "1.05rem", fontWeight: 700, color: "white" }}>
                                {selectedAdId ? (campaignDetail?.ads.find((a: any) => a.ad_id === selectedAdId)?.ad_name || "Anúncio")
                                    : selectedAdsetId ? (selectedAdset?.adset_name || "Conjunto de Anúncios")
                                    : selectedCampaignId ? (accountDetail?.campaigns.find((c: any) => c.campaign_id === selectedCampaignId)?.campaign_name || "Campanha")
                                    : selectedAccountId ? (selectedAccount?.name || "Conta")
                                    : currentPage === "insights" ? "Insights"
                                    : "Painel Geral"}
                            </h1>
                            <p style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)" }}>
                                {periodLabel}
                                {periodMeta?.previous && compare && <> · vs {periodMeta.previous.since} → {periodMeta.previous.until}</>}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <DateRangePicker value={period} onChange={setPeriod} compare={compare} onCompareChange={setCompare} />
                        <button onClick={fetchAccounts} disabled={loading} className="g-btn-secondary"
                            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 0.75rem", fontSize: "0.75rem" }}>
                            <RefreshCw style={{ width: 13, height: 13, animation: loading ? "spin 1s linear infinite" : "none" }} />
                            {loading ? "Atualizando..." : "Atualizar"}
                        </button>
                    </div>
                </header>

                <div style={{ padding: "1.5rem" }}>
                    {error && (
                        <div className="g-glass" style={{ padding: "1rem", display: "flex", alignItems: "center", gap: "0.5rem", color: "#fca5a5", marginBottom: "1rem" }}>
                            <AlertCircle style={{ width: 16, height: 16 }} /> {error}
                        </div>
                    )}

                    {/* ── PAINEL GERAL ── */}
                    {!selectedAccountId && currentPage === "dashboard" && (
                        <div className="g-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                            <KpiGrid ctx="dashboard" row={dashboardAggRow} selected={dashboardKpis} onOpenPicker={() => setKpiPickerOpen("dashboard")} />
                            <div className="g-glass" style={{ overflow: "hidden" }}>
                                <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--glass-border)" }}>
                                    <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "white" }}>
                                        <Building2 style={{ width: 14, height: 14, display: "inline", marginRight: 6 }} />
                                        Contas de Anúncio
                                    </h3>
                                    <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                                        {accounts.length} conta{accounts.length !== 1 ? "s" : ""}
                                    </p>
                                </div>
                                {loading && accounts.length === 0
                                    ? <SkeletonTable rows={6} cols={6} />
                                    : <InsightsTable
                                        rows={accounts}
                                        selectedMetrics={accountMetrics}
                                        nameKey="name" nameLabel="Conta" idKey="id"
                                        onRowClick={r => handleSelectAccount(r.id)}
                                        onOpenMetricsPicker={() => setPickerOpen("account")}
                                        emptyText="Nenhuma conta com dados no período."
                                    />
                                }
                            </div>
                        </div>
                    )}

                    {/* ── DETALHE DA CONTA ── */}
                    {selectedAccountId && selectedAccount && !selectedCampaignId && !selectedAdId && (
                        <div className="g-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                            <KpiGrid ctx="account" row={selectedAccount} selected={accountKpis} onOpenPicker={() => setKpiPickerOpen("account")} />
                            <ActiveAdsList accountId={selectedAccountId} />
                            {accountDetail?.daily && accountDetail.daily.length > 0 && (
                                <BudgetPacing daily={accountDetail.daily} />
                            )}
                            {loadingDetail
                                ? <SkeletonAccountDetail kpiCount={accountKpis.length || 8} />
                                : accountDetail && (
                                    <>
                                        {accountDetail.daily.length > 0 && (
                                            <div className="g-grid-2col">
                                                <div className="g-glass" style={{ padding: "1.1rem" }}>
                                                    <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "white", marginBottom: "0.65rem" }}>Investimento Diário</h4>
                                                    <ResponsiveContainer width="100%" height={220}>
                                                        <BarChart data={accountDetail.daily}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                                            <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                                                            <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                                                            <Tooltip content={<TooltipBox />} />
                                                            <Bar dataKey="spend" name="Investimento (R$)" fill="#4c6ef5" radius={[4, 4, 0, 0]} />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                                <div className="g-glass" style={{ padding: "1.1rem" }}>
                                                    <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "white", marginBottom: "0.65rem" }}>Conversões Diárias</h4>
                                                    <ResponsiveContainer width="100%" height={220}>
                                                        <LineChart data={accountDetail.daily}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                                            <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                                                            <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                                                            <Tooltip content={<TooltipBox />} />
                                                            <Line type="monotone" dataKey="leads" name="Leads" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
                                                            <Line type="monotone" dataKey="messaging_started" name="Conversas" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} />
                                                            <Line type="monotone" dataKey="purchases" name="Compras" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} />
                                                        </LineChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        )}
                                        <BreakdownsPanel objectId={selectedAccountId} level="account" period={period} />
                                        <div className="g-glass" style={{ overflow: "hidden" }}>
                                            <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--glass-border)" }}>
                                                <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "white" }}>
                                                    <Layers style={{ width: 14, height: 14, display: "inline", marginRight: 6 }} />
                                                    Campanhas ({accountDetail.campaigns.length})
                                                </h4>
                                            </div>
                                            <InsightsTable
                                                rows={accountDetail.campaigns}
                                                selectedMetrics={campaignMetrics}
                                                nameKey="campaign_name" nameLabel="Campanha" idKey="campaign_id"
                                                onRowClick={r => handleSelectCampaign(r.campaign_id)}
                                                onOpenMetricsPicker={() => setPickerOpen("campaign")}
                                                emptyText="Nenhuma campanha com dados no período."
                                            />
                                        </div>
                                    </>
                                )
                            }
                        </div>
                    )}

                    {/* ── DETALHE DA CAMPANHA (conjuntos) ── */}
                    {selectedAccountId && selectedCampaignId && !selectedAdsetId && !selectedAdId && (
                        <div className="g-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                            {(() => {
                                const camp = accountDetail?.campaigns.find((c: any) => c.campaign_id === selectedCampaignId);
                                return camp ? <KpiGrid ctx="campaign" row={camp} selected={campaignKpis} onOpenPicker={() => setKpiPickerOpen("campaign")} /> : null;
                            })()}
                            <ActiveAdsList accountId={selectedAccountId} campaignId={selectedCampaignId} />
                            {loadingCampaign
                                ? <SkeletonCampaignDetail kpiCount={campaignKpis.length || 8} />
                                : <>
                                    <BreakdownsPanel objectId={selectedCampaignId} level="campaign" period={period} />
                                    {campaignDetail && campaignDetail.daily.length > 0 && (
                                        <div className="g-glass" style={{ padding: "1.1rem" }}>
                                            <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "white", marginBottom: "0.65rem" }}>Performance Diária</h4>
                                            <ResponsiveContainer width="100%" height={220}>
                                                <BarChart data={campaignDetail.daily}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                                    <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                                                    <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                                                    <Tooltip content={<TooltipBox />} />
                                                    <Bar dataKey="spend" name="Investimento" fill="#4c6ef5" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                    <div className="g-glass" style={{ overflow: "hidden" }}>
                                        <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--glass-border)" }}>
                                            <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "white" }}>
                                                <Hash style={{ width: 14, height: 14, display: "inline", marginRight: 6 }} />
                                                Conjuntos de Anúncios ({campaignAdsets.length})
                                            </h4>
                                        </div>
                                        <InsightsTable
                                            rows={campaignAdsets}
                                            selectedMetrics={adsetMetrics}
                                            nameKey="adset_name" nameLabel="Conjunto" idKey="adset_id"
                                            onRowClick={r => handleSelectAdset(r.adset_id)}
                                            onOpenMetricsPicker={() => setPickerOpen("adset")}
                                            emptyText="Nenhum conjunto com dados no período."
                                        />
                                    </div>
                                </>
                            }
                        </div>
                    )}

                    {/* ── DETALHE DO CONJUNTO (anúncios) ── */}
                    {selectedAccountId && selectedCampaignId && selectedAdsetId && !selectedAdId && (
                        <div className="g-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                            {selectedAdset && <KpiGrid ctx="adset" row={selectedAdset} selected={adsetKpis} onOpenPicker={() => setKpiPickerOpen("adset")} />}
                            <ActiveAdsList accountId={selectedAccountId} campaignId={selectedCampaignId} adsetId={selectedAdsetId} />
                            <BreakdownsPanel objectId={selectedAdsetId} level="adset" period={period} />
                            <div className="g-glass" style={{ overflow: "hidden" }}>
                                <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--glass-border)" }}>
                                    <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "white" }}>
                                        <Hash style={{ width: 14, height: 14, display: "inline", marginRight: 6 }} />
                                        Anúncios ({adsetAds.length})
                                    </h4>
                                </div>
                                {loadingCampaign
                                    ? <SkeletonTable rows={5} cols={5} />
                                    : <InsightsTable
                                        rows={adsetAds}
                                        selectedMetrics={adMetrics}
                                        nameKey="ad_name" nameLabel="Anúncio" idKey="ad_id"
                                        onRowClick={r => setSelectedAdId(r.ad_id)}
                                        onOpenMetricsPicker={() => setPickerOpen("ad")}
                                        emptyText="Nenhum anúncio com dados."
                                    />
                                }
                            </div>
                        </div>
                    )}

                    {/* ── DETALHE DO ANÚNCIO ── */}
                    {selectedAdId && (
                        <div className="g-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <CreativePreview adId={selectedAdId} />
                            {(() => {
                                const ad = campaignDetail?.ads.find((a: any) => a.ad_id === selectedAdId);
                                if (!ad) return null;
                                return (
                                    <>
                                        <KpiGrid ctx="ad" row={ad} selected={adKpis} onOpenPicker={() => setKpiPickerOpen("ad")} />
                                        <BreakdownsPanel objectId={selectedAdId} level="ad" period={period} />
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {/* ── INSIGHTS ── */}
                    {currentPage === "insights" && !selectedAccountId && (
                        <div className="g-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <div className="g-glass" style={{ padding: "1.25rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", marginBottom: "1rem" }}>
                                    <div style={{ padding: "0.6rem", borderRadius: "0.65rem", background: "var(--gradient-primary)" }}>
                                        <Brain style={{ width: 20, height: 20, color: "white" }} />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "white" }}>Insights</h3>
                                        <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)" }}>
                                            Análise de {accounts.length} conta{accounts.length !== 1 ? "s" : ""}
                                        </p>
                                    </div>
                                </div>
                                <SmartInsights accounts={accounts} />
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* MODAIS */}
            <MetricsPicker
                open={!!pickerOpen}
                onClose={() => setPickerOpen(null)}
                selected={pickerOpen === "account" ? accountMetrics : pickerOpen === "campaign" ? campaignMetrics : pickerOpen === "adset" ? adsetMetrics : adMetrics}
                onChange={(keys) => {
                    if (pickerOpen === "account") setAccountMetrics(keys);
                    else if (pickerOpen === "campaign") setCampaignMetrics(keys);
                    else if (pickerOpen === "adset") setAdsetMetrics(keys);
                    else if (pickerOpen === "ad") setAdMetrics(keys);
                }}
                title={`Métricas — ${pickerOpen === "account" ? "Contas" : pickerOpen === "campaign" ? "Campanhas" : pickerOpen === "adset" ? "Conjuntos" : "Anúncios"}`}
            />
            <KpiPicker
                open={!!kpiPickerOpen}
                onClose={() => setKpiPickerOpen(null)}
                ctx={(kpiPickerOpen || "dashboard") as KpiCtx}
                selected={kpiPickerOpen === "dashboard" ? dashboardKpis : kpiPickerOpen === "account" ? accountKpis : kpiPickerOpen === "campaign" ? campaignKpis : kpiPickerOpen === "adset" ? adsetKpis : adKpis}
                onChange={(keys) => {
                    if (kpiPickerOpen === "dashboard") setDashboardKpis(keys);
                    else if (kpiPickerOpen === "account") setAccountKpis(keys);
                    else if (kpiPickerOpen === "campaign") setCampaignKpis(keys);
                    else if (kpiPickerOpen === "adset") setAdsetKpis(keys);
                    else if (kpiPickerOpen === "ad") setAdKpis(keys);
                }}
                title={`KPIs — ${kpiPickerOpen}`}
            />
            <CmdK items={cmdItems} open={cmdkOpen} onClose={() => setCmdkOpen(false)} />
        </div>
    );
}

function TooltipBox({ active, payload, label }: any) {
    if (!active || !payload) return null;
    return (
        <div className="g-glass" style={{ padding: "0.6rem", background: "rgba(15,18,37,0.95)" }}>
            <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 4, fontSize: "0.7rem" }}>{label}</p>
            {payload.map((p: any, i: number) => (
                <p key={i} style={{ color: p.color || "white", fontWeight: 500, fontSize: "0.72rem" }}>
                    {p.name}: {typeof p.value === "number" ? p.value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : p.value}
                </p>
            ))}
        </div>
    );
}
