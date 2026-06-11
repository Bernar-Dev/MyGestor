"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    BarChart3, LayoutDashboard, Lightbulb, Star, Users, DollarSign,
    MousePointerClick, Target, ChevronLeft,
    RefreshCw, Search, Loader2, AlertCircle, Eye, Menu, X,
    Building2, Layers, Hash, Brain, Wallet, Activity, Filter,
} from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    LineChart, Line, CartesianGrid,
} from "recharts";

import { load, save, KEYS } from "./lib/storage";
import { PRESETS } from "./lib/metrics";
import { formatCurrency, formatNumber, formatPct } from "./lib/format";

import KpiGrid from "./components/KpiGrid";
import KpiPicker from "./components/KpiPicker";
import MetricsPicker from "./components/MetricsPicker";
import DateRangePicker, { DateRangeValue } from "./components/DateRangePicker";
import BudgetPacing from "./components/BudgetPacing";
import BreakdownsPanel from "./components/BreakdownsPanel";
import CreativePreview from "./components/CreativePreview";
import ExportMenu from "./components/ExportMenu";
import ActiveAdsList from "./components/ActiveAdsList";
import ClientReport from "./components/ClientReport";
import CmdK, { CmdItem } from "./components/CmdK";
import InsightsTable from "./components/InsightsTable";
import SmartInsights from "./components/SmartInsights";
import { DEFAULT_KPIS, KpiCtx, aggregateRow } from "./lib/kpis";

// ─────────────────────────────────────────────────────────────
// PAGES (sidebar)
// ─────────────────────────────────────────────────────────────
const PAGES = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "favorites", label: "Meus Clientes", icon: Star },
    { id: "insights", label: "Insights", icon: Lightbulb },
];

// ─────────────────────────────────────────────────────────────
// MÉTRICAS DEFAULT
// ─────────────────────────────────────────────────────────────
const DEFAULT_ACCOUNT_METRICS = PRESETS["Diagnóstico"];
const DEFAULT_CAMPAIGN_METRICS = ["spend", "impressions", "ctr", "inline_link_clicks", "cpc", "cpm", "leads", "cpl", "messaging_started", "frequency"];
const DEFAULT_ADSET_METRICS = ["spend", "impressions", "ctr", "inline_link_clicks", "cpc", "cpm", "leads", "cpl", "messaging_started", "frequency"];
const DEFAULT_AD_METRICS = ["spend", "impressions", "ctr", "cpc", "leads", "cpl", "messaging_started", "hook_rate", "hold_rate", "frequency"];

interface PeriodMeta { preset?: string; range?: { since: string; until: string }; previous?: { since: string; until: string } | null; }

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
export default function MeuGestorDashboard() {
    // Navegação
    const [currentPage, setCurrentPage] = useState("dashboard");
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
    const [selectedAdsetId, setSelectedAdsetId] = useState<string | null>(null);
    const [selectedAdId, setSelectedAdId] = useState<string | null>(null);

    // Filtros
    const [searchTerm, setSearchTerm] = useState("");
    const [period, setPeriod] = useState<DateRangeValue>({ preset: "last_7d" });
    const [compare, setCompare] = useState(true);
    const [onlyFavorites, setOnlyFavorites] = useState(false);
    const [accountFilter, setAccountFilter] = useState<'all' | 'active_ads' | 'with_spend' | 'issues'>('all');
    const [issueFilter, setIssueFilter] = useState<'all' | 'no_ads' | 'inactive' | 'no_delivery' | 'payment'>('all');

    // Dados
    const [accounts, setAccounts] = useState<any[]>([]);
    const [periodMeta, setPeriodMeta] = useState<PeriodMeta>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [accountDetail, setAccountDetail] = useState<{ campaigns: any[]; daily: any[]; adsets: any[] } | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const [campaignDetail, setCampaignDetail] = useState<{ ads: any[]; daily: any[] } | null>(null);
    const [loadingCampaign, setLoadingCampaign] = useState(false);

    // Persistência
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [accountMetrics, setAccountMetrics] = useState<string[]>(DEFAULT_ACCOUNT_METRICS);
    const [campaignMetrics, setCampaignMetrics] = useState<string[]>(DEFAULT_CAMPAIGN_METRICS);
    const [adsetMetrics, setAdsetMetrics] = useState<string[]>(DEFAULT_ADSET_METRICS);
    const [adMetrics, setAdMetrics] = useState<string[]>(DEFAULT_AD_METRICS);

    // KPIs editáveis por contexto (dashboard, account, campaign, adset, ad)
    const [dashboardKpis, setDashboardKpis] = useState<string[]>(DEFAULT_KPIS.dashboard);
    const [accountKpis, setAccountKpis] = useState<string[]>(DEFAULT_KPIS.account);
    const [campaignKpis, setCampaignKpis] = useState<string[]>(DEFAULT_KPIS.campaign);
    const [adsetKpis, setAdsetKpis] = useState<string[]>(DEFAULT_KPIS.adset);
    const [adKpis, setAdKpis] = useState<string[]>(DEFAULT_KPIS.ad);

    // Modais
    const [pickerOpen, setPickerOpen] = useState<null | "account" | "campaign" | "adset" | "ad">(null);
    const [kpiPickerOpen, setKpiPickerOpen] = useState<null | KpiCtx>(null);
    const [cmdkOpen, setCmdkOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // ── Hidrata localStorage ──
    useEffect(() => {
        setFavorites(new Set(load<string[]>(KEYS.favorites, [])));
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
        setOnlyFavorites(load(KEYS.onlyFavorites, false));
        const persisted = load(KEYS.sidebarOpen, true);
        const isMobile = typeof window !== "undefined" && window.innerWidth < 769;
        setSidebarOpen(isMobile ? false : persisted);
    }, []);

    useEffect(() => save(KEYS.favorites, Array.from(favorites)), [favorites]);
    useEffect(() => save(KEYS.metricsByLevel + ":account", accountMetrics), [accountMetrics]);
    useEffect(() => save(KEYS.metricsByLevel + ":campaign", campaignMetrics), [campaignMetrics]);
    useEffect(() => save(KEYS.metricsByLevel + ":adset", adsetMetrics), [adsetMetrics]);
    useEffect(() => save(KEYS.metricsByLevel + ":ad", adMetrics), [adMetrics]);
    useEffect(() => save("kpis:dashboard", dashboardKpis), [dashboardKpis]);
    useEffect(() => save("kpis:account", accountKpis), [accountKpis]);
    useEffect(() => save("kpis:campaign", campaignKpis), [campaignKpis]);
    useEffect(() => save("kpis:adset", adsetKpis), [adsetKpis]);
    useEffect(() => save("kpis:ad", adKpis), [adKpis]);
    useEffect(() => save(KEYS.period, period), [period]);
    useEffect(() => save(KEYS.compare, compare), [compare]);
    useEffect(() => save(KEYS.onlyFavorites, onlyFavorites), [onlyFavorites]);
    useEffect(() => save(KEYS.sidebarOpen, sidebarOpen), [sidebarOpen]);

    // ── Cmd+K shortcut ──
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault(); setCmdkOpen(true);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // ── Fetch contas ──
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
        accountsAbortRef.current?.abort();
        const ctrl = new AbortController();
        accountsAbortRef.current = ctrl;
        setLoading(true); setError(null);
        try {
            const res = await fetch(`/api/meugestor/accounts?${buildPeriodParams().toString()}`, { signal: ctrl.signal });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Erro ao buscar contas");
            setAccounts(json.data);
            setPeriodMeta(json.period);
        } catch (e: any) {
            if (e.name !== "AbortError") setError(e.message);
        } finally {
            if (accountsAbortRef.current === ctrl) setLoading(false);
        }
    }, [buildPeriodParams]);

    useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

    // ── Fetch detalhe ──
    const detailAbortRef = useRef<AbortController | null>(null);
    const fetchAccountDetail = useCallback(async (id: string) => {
        detailAbortRef.current?.abort();
        const ctrl = new AbortController();
        detailAbortRef.current = ctrl;
        setLoadingDetail(true);
        try {
            const res = await fetch(`/api/meugestor/accounts/${id}?${buildPeriodParams().toString()}`, { signal: ctrl.signal });
            const json = await res.json();
            if (json.success) {
                const daily = (json.data.daily || []).map((d: any) => {
                    const [, m, day] = (d.date_start || "").split("-");
                    return { ...d, date: `${day}/${m}` };
                });
                setAccountDetail({ campaigns: json.data.campaigns, daily, adsets: json.data.adsets });
            }
        } catch (e: any) {
            if (e.name !== "AbortError") console.error(e);
        } finally {
            if (detailAbortRef.current === ctrl) setLoadingDetail(false);
        }
    }, [buildPeriodParams]);

    const campaignAbortRef = useRef<AbortController | null>(null);
    const fetchCampaignDetail = useCallback(async (id: string) => {
        campaignAbortRef.current?.abort();
        const ctrl = new AbortController();
        campaignAbortRef.current = ctrl;
        setLoadingCampaign(true);
        try {
            const res = await fetch(`/api/meugestor/campaigns/${id}?${buildPeriodParams().toString()}`, { signal: ctrl.signal });
            const json = await res.json();
            if (json.success) {
                const daily = (json.data.daily || []).map((d: any) => {
                    const [, m, day] = (d.date_start || "").split("-");
                    return { ...d, date: `${day}/${m}` };
                });
                setCampaignDetail({ ads: json.data.ads, daily });
            }
        } catch (e: any) {
            if (e.name !== "AbortError") console.error(e);
        } finally {
            if (campaignAbortRef.current === ctrl) setLoadingCampaign(false);
        }
    }, [buildPeriodParams]);

    // re-busca detalhes ao mudar período
    useEffect(() => {
        if (selectedAccountId) fetchAccountDetail(selectedAccountId);
    }, [selectedAccountId, fetchAccountDetail]);
    useEffect(() => {
        if (selectedCampaignId) fetchCampaignDetail(selectedCampaignId);
    }, [selectedCampaignId, fetchCampaignDetail]);

    // ── Handlers ──
    const toggleFavorite = (id: string) => {
        setFavorites(prev => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    };
    const handleSelectAccount = (id: string) => {
        setSelectedAccountId(id);
        setSelectedCampaignId(null);
        setSelectedAdsetId(null);
        setSelectedAdId(null);
        setAccountDetail(null);
    };
    const handleSelectCampaign = (id: string) => {
        setSelectedCampaignId(id);
        setSelectedAdsetId(null);
        setSelectedAdId(null);
        setCampaignDetail(null);
    };
    const handleSelectAdset = (id: string) => {
        setSelectedAdsetId(id);
        setSelectedAdId(null);
    };
    const handleBack = () => {
        if (selectedAdId) { setSelectedAdId(null); return; }
        if (selectedAdsetId) { setSelectedAdsetId(null); return; }
        if (selectedCampaignId) { setSelectedCampaignId(null); setSelectedAdsetId(null); setCampaignDetail(null); return; }
        setSelectedAccountId(null); setAccountDetail(null);
    };

    const handleToggleStatus = async (id: string, currentStatus: string, kind: "campaign" | "ad") => {
        const newStatus = currentStatus === "PAUSED" ? "ACTIVE" : "PAUSED";
        if (!confirm(`Deseja ${newStatus === "PAUSED" ? "PAUSAR" : "ATIVAR"} ${kind === "campaign" ? "esta campanha" : "este anúncio"}?`)) return;
        try {
            const res = await fetch("/api/meugestor/status", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status: newStatus }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            if (kind === "campaign" && accountDetail) {
                setAccountDetail({ ...accountDetail, campaigns: accountDetail.campaigns.map((c: any) => c.campaign_id === id ? { ...c, status: newStatus } : c) });
            } else if (kind === "ad" && campaignDetail) {
                setCampaignDetail({ ...campaignDetail, ads: campaignDetail.ads.map((a: any) => a.ad_id === id ? { ...a, status: newStatus } : a) });
            }
        } catch (e: any) {
            alert("Erro: " + e.message);
        }
    };

    // ── Computed ──
    const visibleAccounts = useMemo(() => {
        let arr = accounts;
        if (onlyFavorites) arr = arr.filter(a => favorites.has(a.id));
        if (currentPage === "favorites") arr = arr.filter(a => favorites.has(a.id));
        if (accountFilter === "active_ads") arr = arr.filter(a => a.has_ads_in_period);
        else if (accountFilter === "with_spend") arr = arr.filter(a => Number(a.spend || 0) > 0);
        else if (accountFilter === "issues") {
            arr = arr.filter(a => Array.isArray(a.issues) && a.issues.length > 0);
            if (issueFilter !== "all") {
                arr = arr.filter(a => Array.isArray(a.issue_categories) && a.issue_categories.includes(issueFilter));
            }
        }
        if (searchTerm) arr = arr.filter(a => (a.name || "").toLowerCase().includes(searchTerm.toLowerCase()));
        return arr;
    }, [accounts, favorites, onlyFavorites, accountFilter, issueFilter, currentPage, searchTerm]);

    const filterCounts = useMemo(() => {
        const issues = accounts.filter((a: any) => Array.isArray(a.issues) && a.issues.length > 0);
        const cat = (key: string) => issues.filter((a: any) => Array.isArray(a.issue_categories) && a.issue_categories.includes(key)).length;
        return {
            total: accounts.length,
            active_ads: accounts.filter((a: any) => a.has_ads_in_period).length,
            with_spend: accounts.filter((a: any) => Number(a.spend || 0) > 0).length,
            issues: issues.length,
            no_ads: cat('no_ads'),
            inactive: cat('inactive'),
            no_delivery: cat('no_delivery'),
            payment: cat('payment'),
        };
    }, [accounts]);

    const totals = useMemo(() => {
        const ts = visibleAccounts.reduce((s, a) => s + a.spend, 0);
        const ti = visibleAccounts.reduce((s, a) => s + a.impressions, 0);
        const tc = visibleAccounts.reduce((s, a) => s + a.clicks, 0);
        const tl = visibleAccounts.reduce((s, a) => s + a.leads, 0);
        const tm = visibleAccounts.reduce((s, a) => s + a.messaging_started, 0);
        const tp = visibleAccounts.reduce((s, a) => s + a.purchases, 0);
        const tv = visibleAccounts.reduce((s, a) => s + (a.purchase_value || 0), 0);
        const ctr = ti > 0 ? (tc / ti) * 100 : 0;
        const cpc = tc > 0 ? ts / tc : 0;
        const cpl = tl > 0 ? ts / tl : 0;
        const roas = ts > 0 ? tv / ts : 0;
        // delta agregados (média ponderada por spend prev)
        const prevSpend = visibleAccounts.reduce((s, a) => s + (a.previous?.spend || 0), 0);
        const prevLeads = visibleAccounts.reduce((s, a) => s + (a.previous?.leads || 0), 0);
        const dSpend = prevSpend > 0 ? ((ts - prevSpend) / prevSpend) * 100 : null;
        const dLeads = prevLeads > 0 ? ((tl - prevLeads) / prevLeads) * 100 : null;
        return { ts, ti, tc, tl, tm, tp, tv, ctr, cpc, cpl, roas, dSpend, dLeads };
    }, [visibleAccounts]);

    const selectedAccount = useMemo(() => accounts.find(a => a.id === selectedAccountId), [accounts, selectedAccountId]);

    // Linha sintética para KPIs do dashboard (totais agregados, com deltas calculados a partir do previous de cada conta)
    const dashboardAggRow = useMemo(() => aggregateRow(visibleAccounts), [visibleAccounts]);

    // Adsets filtrados pela campanha selecionada
    const campaignAdsets = useMemo(() => {
        if (!selectedCampaignId || !accountDetail?.adsets) return [];
        return accountDetail.adsets.filter((a: any) => a.campaign_id === selectedCampaignId);
    }, [selectedCampaignId, accountDetail]);

    // Ads filtrados pelo adset selecionado
    const adsetAds = useMemo(() => {
        if (!selectedAdsetId || !campaignDetail?.ads) return [];
        return campaignDetail.ads.filter((a: any) => a.adset_id === selectedAdsetId);
    }, [selectedAdsetId, campaignDetail]);

    const selectedAdset = useMemo(() =>
        accountDetail?.adsets?.find((a: any) => a.adset_id === selectedAdsetId),
        [accountDetail, selectedAdsetId]
    );

    const cmdItems: CmdItem[] = useMemo(() => {
        const items: CmdItem[] = [];
        for (const a of accounts) {
            items.push({
                id: a.id, title: a.name || a.account_id, subtitle: `${formatCurrency(a.spend)} · ${a.leads || 0} leads`,
                type: "account", onSelect: () => handleSelectAccount(a.id),
            });
        }
        if (accountDetail?.campaigns) {
            for (const c of accountDetail.campaigns) {
                items.push({
                    id: c.campaign_id, title: c.campaign_name, subtitle: `${formatCurrency(c.spend)} · CTR ${(c.ctr || 0).toFixed(2)}%`,
                    type: "campaign", onSelect: () => handleSelectCampaign(c.campaign_id),
                });
            }
        }
        if (selectedCampaignId && accountDetail?.adsets) {
            for (const as of accountDetail.adsets.filter((a: any) => a.campaign_id === selectedCampaignId)) {
                items.push({
                    id: as.adset_id, title: as.adset_name, subtitle: `${formatCurrency(as.spend)} · ${as.leads || 0} leads`,
                    type: "campaign", onSelect: () => handleSelectAdset(as.adset_id),
                });
            }
        }
        if (selectedAdsetId && campaignDetail?.ads) {
            for (const a of campaignDetail.ads.filter((ad: any) => ad.adset_id === selectedAdsetId)) {
                items.push({
                    id: a.ad_id, title: a.ad_name, subtitle: `${formatCurrency(a.spend)} · ${a.leads || 0} leads`,
                    type: "ad", onSelect: () => setSelectedAdId(a.ad_id),
                });
            }
        }
        return items;
    }, [accounts, accountDetail, campaignDetail, selectedCampaignId, selectedAdsetId]);

    const periodLabel = periodMeta.range
        ? `${periodMeta.range.since} → ${periodMeta.range.until}`
        : (period.since && period.until ? `${period.since} → ${period.until}` : (period.preset || "—"));

    // ── Loading / Error ──
    if (loading && accounts.length === 0) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center" }}>
                    <Loader2 style={{ width: 48, height: 48, color: "#4c6ef5", margin: "0 auto 1rem" }} className="g-pulse" />
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.875rem" }}>Carregando contas e período comparativo...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="g-glass" style={{ padding: "2rem", textAlign: "center", maxWidth: 460 }}>
                    <AlertCircle style={{ width: 48, height: 48, color: "#f87171", margin: "0 auto 1rem" }} />
                    <h3 style={{ color: "white", fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.5rem" }}>Erro ao carregar</h3>
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", marginBottom: "1rem" }}>{error}</p>
                    <button onClick={fetchAccounts} className="g-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                        <RefreshCw style={{ width: 16, height: 16 }} /> Tentar novamente
                    </button>
                </div>
            </div>
        );
    }

    // ── Render ──
    const anyLoading = loading || loadingDetail || loadingCampaign;

    return (
        <div style={{ minHeight: "100vh" }}>
            {anyLoading && <div className="g-loadbar" />}
            {/* SIDEBAR */}
            {sidebarOpen && <div className="g-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
            <aside className={`g-sidebar ${sidebarOpen ? "is-open" : ""}`} style={{
                position: "fixed", left: 0, top: 0, bottom: 0, width: sidebarOpen ? 240 : 72, zIndex: 50,
                background: "rgba(10,12,28,0.95)", borderRight: "1px solid var(--glass-border)",
                backdropFilter: "blur(20px)", display: "flex", flexDirection: "column", transition: "width 0.3s ease, transform 0.25s ease",
            }}>
                <div style={{ height: 72, display: "flex", alignItems: "center", justifyContent: sidebarOpen ? "space-between" : "center", padding: sidebarOpen ? "0 1.25rem" : "0", borderBottom: "1px solid var(--glass-border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <div style={{ width: 34, height: 34, borderRadius: "0.65rem", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--gradient-primary)" }}>
                            <BarChart3 style={{ width: 18, height: 18, color: "white" }} />
                        </div>
                        {sidebarOpen && <div>
                            <h1 style={{ color: "white", fontWeight: 700, fontSize: "0.95rem", letterSpacing: "-0.02em" }}>Meu Gestor</h1>
                            <p style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Meta · v3</p>
                        </div>}
                    </div>
                    {sidebarOpen && <button onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}><X style={{ width: 18, height: 18 }} /></button>}
                </div>
                <nav style={{ flex: 1, padding: "0.85rem 0.5rem" }}>
                    {PAGES.map(p => {
                        const Icon = p.icon;
                        const active = currentPage === p.id;
                        return (
                            <button key={p.id} onClick={() => { setCurrentPage(p.id); setSelectedAccountId(null); setSelectedCampaignId(null); if (typeof window !== "undefined" && window.innerWidth < 769) setSidebarOpen(false); }}
                                className={`g-sidebar-link ${active ? "active" : ""}`}
                                style={{ justifyContent: sidebarOpen ? "flex-start" : "center", padding: sidebarOpen ? "0.6rem 0.85rem" : "0.6rem", fontSize: "0.82rem" }}>
                                <Icon style={{ width: 18, height: 18 }} />
                                {sidebarOpen && <span>{p.label}</span>}
                                {sidebarOpen && p.id === "favorites" && favorites.size > 0 && (
                                    <span style={{ marginLeft: "auto", fontSize: "0.65rem", padding: "0.1rem 0.4rem", background: "rgba(76,110,245,0.25)", borderRadius: 9999, color: "#748ffc" }}>{favorites.size}</span>
                                )}
                            </button>
                        );
                    })}
                </nav>
                <div style={{ padding: "0.85rem", borderTop: "1px solid var(--glass-border)", textAlign: sidebarOpen ? "left" : "center" }}>
                    <button onClick={() => setCmdkOpen(true)} className="g-btn-secondary"
                        style={{ width: "100%", display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem", fontSize: "0.7rem", justifyContent: sidebarOpen ? "flex-start" : "center" }}>
                        <Search style={{ width: 12, height: 12 }} />
                        {sidebarOpen && <><span>Buscar</span><kbd style={{ marginLeft: "auto", fontSize: "0.6rem", padding: "0.1rem 0.3rem", background: "rgba(255,255,255,0.06)", borderRadius: 3, color: "rgba(255,255,255,0.4)" }}>⌘K</kbd></>}
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
                            <h1 style={{ fontSize: "1.05rem", fontWeight: 700, color: "white", letterSpacing: "-0.01em" }}>
                                {selectedAdId ? (campaignDetail?.ads.find((a: any) => a.ad_id === selectedAdId)?.ad_name || "Detalhe do Anúncio")
                                    : selectedAdsetId ? (selectedAdset?.adset_name || "Conjunto de Anúncios")
                                    : selectedCampaignId ? (accountDetail?.campaigns.find((c: any) => c.campaign_id === selectedCampaignId)?.campaign_name || "Campanha")
                                    : selectedAccountId ? (selectedAccount?.name || "Conta")
                                    : currentPage === "insights" ? "Insights da Operação"
                                    : currentPage === "favorites" ? "Meus Clientes"
                                    : "Painel Geral"}
                            </h1>
                            <p style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>
                                {periodLabel}
                                {periodMeta.previous && compare && <> · vs {periodMeta.previous.since} → {periodMeta.previous.until}</>}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <DateRangePicker value={period} onChange={setPeriod} compare={compare} onCompareChange={setCompare} />
                        <ExportMenu
                            period={period}
                            accounts={
                                selectedAccountId
                                    ? [selectedAccountId]
                                    : onlyFavorites || currentPage === "favorites"
                                        ? Array.from(favorites)
                                        : undefined
                            }
                            scopeLabel={
                                selectedAccountId
                                    ? (selectedAccount?.name || "Conta atual")
                                    : undefined
                            }
                        />
                        <button onClick={fetchAccounts} disabled={loading} className="g-btn-secondary"
                            style={{
                                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                                padding: "0.5rem 0.75rem", fontSize: "0.75rem",
                                opacity: loading ? 0.7 : 1, cursor: loading ? "wait" : "pointer",
                                borderColor: loading ? "rgba(76,110,245,0.55)" : undefined,
                            }}>
                            <RefreshCw style={{ width: 13, height: 13, animation: loading ? "spin 1s linear infinite" : "none" }} />
                            {loading ? "Atualizando..." : "Atualizar"}
                        </button>
                    </div>
                </header>

                <div className="g-page-pad" style={{ padding: "1.5rem" }}>
                    {/* ========== DASHBOARD / FAVORITES ========== */}
                    {!selectedAccountId && (currentPage === "dashboard" || currentPage === "favorites") && (
                        <div className="g-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                            {/* KPIs editáveis (dashboard agregado) */}
                            <KpiGrid ctx="dashboard" row={dashboardAggRow} selected={dashboardKpis} onOpenPicker={() => setKpiPickerOpen("dashboard")} />

                            {/* Filtros + tabela de contas */}
                            <div className="g-glass" style={{ overflow: "hidden" }}>
                                <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                                    <div>
                                        <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "white" }}>
                                            <Building2 style={{ width: 14, height: 14, display: "inline", marginRight: 6 }} />
                                            {currentPage === "favorites" ? "Meus Clientes" : "Contas de Anúncio"}
                                        </h3>
                                        <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                                            {visibleAccounts.length} contas exibidas · {favorites.size} marcadas como cliente
                                            {filterCounts.issues > 0 && (
                                                <> · <span style={{ color: "#fbbf24" }}>{filterCounts.issues} com pendência{filterCounts.issues > 1 ? "s" : ""}</span></>
                                            )}
                                        </p>
                                    </div>
                                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                                        {currentPage !== "favorites" && (
                                            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>
                                                <input type="checkbox" checked={onlyFavorites} onChange={e => setOnlyFavorites(e.target.checked)} style={{ accentColor: "#fbbf24" }} />
                                                <Filter style={{ width: 12, height: 12 }} /> Só clientes
                                            </label>
                                        )}
                                        <div style={{ position: "relative" }}>
                                            <Search style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "rgba(255,255,255,0.35)" }} />
                                            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar conta..."
                                                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "0.4rem 0.65rem 0.4rem 1.85rem", fontSize: "0.78rem", color: "white", outline: "none", width: 220 }} />
                                        </div>
                                    </div>
                                </div>
                                <div style={{ padding: "0.55rem 1rem", borderBottom: "1px solid var(--glass-border)", display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                                    {([
                                        { key: "all", label: "Todas", count: filterCounts.total, color: "rgba(255,255,255,0.7)" },
                                        { key: "active_ads", label: "Anúncios ativos", count: filterCounts.active_ads, color: "#34d399" },
                                        { key: "with_spend", label: "Com gastos", count: filterCounts.with_spend, color: "#748ffc" },
                                        { key: "issues", label: "Pendências", count: filterCounts.issues, color: "#fbbf24" },
                                    ] as const).map(chip => {
                                        const active = accountFilter === chip.key;
                                        return (
                                            <button key={chip.key}
                                                onClick={() => { setAccountFilter(chip.key); if (chip.key !== "issues") setIssueFilter("all"); }}
                                                style={{
                                                    display: "inline-flex", alignItems: "center", gap: 5,
                                                    padding: "0.32rem 0.7rem", borderRadius: 999, fontSize: "0.7rem", fontWeight: 600,
                                                    background: active ? `${chip.color}22` : "rgba(255,255,255,0.04)",
                                                    border: `1px solid ${active ? `${chip.color}88` : "rgba(255,255,255,0.08)"}`,
                                                    color: active ? chip.color : "rgba(255,255,255,0.7)",
                                                    cursor: "pointer", transition: "all 0.15s",
                                                }}>
                                                {chip.label}
                                                <span style={{ fontSize: "0.62rem", opacity: 0.75 }}>{chip.count}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                {accountFilter === "issues" && (
                                    <div style={{ padding: "0.45rem 1rem 0.55rem", borderBottom: "1px solid var(--glass-border)", display: "flex", gap: "0.35rem", alignItems: "center", flexWrap: "wrap", background: "rgba(251,191,36,0.04)" }}>
                                        <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)", marginRight: 4 }}>Tipo de pendência:</span>
                                        {([
                                            { key: "all", label: "Todas", count: filterCounts.issues },
                                            { key: "no_ads", label: "Sem anúncios", count: filterCounts.no_ads },
                                            { key: "inactive", label: "Conta inativa/bloqueada", count: filterCounts.inactive },
                                            { key: "no_delivery", label: "Sem veiculação no período", count: filterCounts.no_delivery },
                                            { key: "payment", label: "Pagamento", count: filterCounts.payment },
                                        ] as const).map(sub => {
                                            const active = issueFilter === sub.key;
                                            const disabled = sub.count === 0 && sub.key !== "all";
                                            return (
                                                <button key={sub.key} disabled={disabled} onClick={() => setIssueFilter(sub.key)}
                                                    style={{
                                                        display: "inline-flex", alignItems: "center", gap: 4,
                                                        padding: "0.25rem 0.6rem", borderRadius: 999, fontSize: "0.65rem", fontWeight: 600,
                                                        background: active ? "rgba(251,191,36,0.18)" : "transparent",
                                                        border: `1px solid ${active ? "rgba(251,191,36,0.55)" : "rgba(255,255,255,0.08)"}`,
                                                        color: active ? "#fbbf24" : disabled ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.7)",
                                                        cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.15s",
                                                    }}>
                                                    {sub.label}
                                                    <span style={{ fontSize: "0.58rem", opacity: 0.7 }}>{sub.count}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                <InsightsTable
                                    rows={visibleAccounts}
                                    selectedMetrics={accountMetrics}
                                    nameKey="name" nameLabel="Conta" idKey="id"
                                    onRowClick={r => handleSelectAccount(r.id)}
                                    favorites={favorites}
                                    onToggleFavorite={toggleFavorite}
                                    onOpenMetricsPicker={() => setPickerOpen("account")}
                                    extraColumnsLeft={[{
                                        key: "status", label: "Status", render: (r: any) => {
                                            const sev = r.severity || (r.account_status === 1 ? "ok" : "warn");
                                            const badgeClass = sev === "ok" ? "g-badge-success" : sev === "danger" ? "g-badge-danger" : "g-badge-warning";
                                            const issues: string[] = Array.isArray(r.issues) ? r.issues : [];
                                            return (
                                                <div style={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 240 }}>
                                                    <span className={`g-badge ${badgeClass}`} style={{ fontSize: "0.6rem" }}>
                                                        {r.account_status_label || (r.account_status === 1 ? "Ativa" : "Inativa")}
                                                    </span>
                                                    {r.business_name && <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)" }}>{r.business_name}</span>}
                                                    {issues.length > 0 && (
                                                        <span title={issues.join(" · ")} style={{ fontSize: "0.58rem", color: sev === "danger" ? "#fca5a5" : "#fbbf24", lineHeight: 1.25, marginTop: 1 }}>
                                                            {issues.slice(0, 2).join(" · ")}{issues.length > 2 ? ` +${issues.length - 2}` : ""}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        }
                                    }]}
                                    emptyText={onlyFavorites ? "Marque algumas contas como cliente (estrela) para vê-las aqui." : "Nenhuma conta encontrada."}
                                />
                            </div>
                        </div>
                    )}

                    {/* ========== ACCOUNT DETAIL ========== */}
                    {selectedAccountId && selectedAccount && !selectedCampaignId && !selectedAdId && (
                        <div className="g-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                            {/* KPIs editáveis da conta */}
                            <KpiGrid ctx="account" row={selectedAccount} selected={accountKpis} onOpenPicker={() => setKpiPickerOpen("account")} />

                            {/* Anúncios ativos compartilháveis */}
                            <ActiveAdsList accountId={selectedAccountId} />

                            {/* Pacing + Cliente Report */}
                            {accountDetail?.daily && accountDetail.daily.length > 0 && (
                                <div className="g-grid-2col">
                                    <BudgetPacing daily={accountDetail.daily} />
                                    <ClientReport
                                        accountName={selectedAccount.name}
                                        period={periodLabel}
                                        flat={selectedAccount}
                                        deltas={selectedAccount.deltas}
                                    />
                                </div>
                            )}

                            {loadingDetail ? (
                                <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
                                    <Loader2 className="g-pulse" style={{ width: 28, height: 28, color: "rgba(255,255,255,0.3)" }} />
                                </div>
                            ) : accountDetail && (
                                <>
                                    {/* Charts */}
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

                                    {/* Breakdowns */}
                                    <BreakdownsPanel objectId={selectedAccountId} level="account" period={period} />

                                    {/* Tabela de campanhas */}
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
                                            extraColumnsRight={[{
                                                key: "status", label: "Ações", render: (r: any) => (
                                                    <button onClick={() => handleToggleStatus(r.campaign_id, r.status || "ACTIVE", "campaign")} className="g-btn-secondary"
                                                        style={{ padding: "0.25rem 0.55rem", fontSize: "0.65rem" }}>
                                                        {r.status === "PAUSED" ? <span style={{ color: "#34d399" }}>▶ Ativar</span> : <span style={{ color: "#fbbf24" }}>⏸ Pausar</span>}
                                                    </button>
                                                )
                                            }]}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ========== CAMPAIGN DETAIL (mostra conjuntos) ========== */}
                    {selectedAccountId && selectedCampaignId && !selectedAdsetId && !selectedAdId && (
                        <div className="g-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                            {/* KPIs da campanha */}
                            {(() => {
                                const camp = accountDetail?.campaigns.find((c: any) => c.campaign_id === selectedCampaignId);
                                if (!camp) return null;
                                return <KpiGrid ctx="campaign" row={camp} selected={campaignKpis} onOpenPicker={() => setKpiPickerOpen("campaign")} />;
                            })()}

                            {/* Links compartilháveis da campanha (separados por conjunto) */}
                            <ActiveAdsList accountId={selectedAccountId} campaignId={selectedCampaignId} />

                            {loadingCampaign ? (
                                <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
                                    <Loader2 className="g-pulse" style={{ width: 28, height: 28, color: "rgba(255,255,255,0.3)" }} />
                                </div>
                            ) : (
                                <>
                                    {/* Breakdowns da campanha */}
                                    <BreakdownsPanel objectId={selectedCampaignId} level="campaign" period={period} />

                                    {campaignDetail && campaignDetail.daily.length > 0 && (
                                        <div className="g-glass" style={{ padding: "1.1rem" }}>
                                            <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "white", marginBottom: "0.65rem" }}>Performance Diária da Campanha</h4>
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

                                    {/* Tabela de Conjuntos de Anúncios */}
                                    <div className="g-glass" style={{ overflow: "hidden" }}>
                                        <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--glass-border)" }}>
                                            <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "white" }}>
                                                <Hash style={{ width: 14, height: 14, display: "inline", marginRight: 6 }} />
                                                Conjuntos de Anúncios ({campaignAdsets.length})
                                            </h4>
                                            <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Clique num conjunto para ver os anúncios e métricas detalhadas</p>
                                        </div>
                                        {campaignAdsets.length === 0 && !loadingCampaign ? (
                                            <div style={{ padding: "1.5rem", textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}>
                                                {loadingDetail ? <Loader2 className="g-pulse" style={{ width: 20, height: 20, margin: "0 auto" }} /> : "Nenhum conjunto com dados no período."}
                                            </div>
                                        ) : (
                                            <InsightsTable
                                                rows={campaignAdsets}
                                                selectedMetrics={adsetMetrics}
                                                nameKey="adset_name" nameLabel="Conjunto" idKey="adset_id"
                                                onRowClick={r => handleSelectAdset(r.adset_id)}
                                                onOpenMetricsPicker={() => setPickerOpen("adset")}
                                                emptyText="Nenhum conjunto com dados no período."
                                            />
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ========== ADSET DETAIL (mostra anúncios do conjunto) ========== */}
                    {selectedAccountId && selectedCampaignId && selectedAdsetId && !selectedAdId && (
                        <div className="g-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                            {/* KPIs do conjunto */}
                            {selectedAdset && (
                                <KpiGrid ctx="adset" row={selectedAdset} selected={adsetKpis} onOpenPicker={() => setKpiPickerOpen("adset")} />
                            )}

                            {/* Links compartilháveis do conjunto */}
                            <ActiveAdsList accountId={selectedAccountId} campaignId={selectedCampaignId} adsetId={selectedAdsetId} />

                            {/* Breakdowns do conjunto */}
                            <BreakdownsPanel objectId={selectedAdsetId} level="adset" period={period} />

                            {/* Tabela de Anúncios do Conjunto */}
                            <div className="g-glass" style={{ overflow: "hidden" }}>
                                <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--glass-border)" }}>
                                    <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "white" }}>
                                        <Hash style={{ width: 14, height: 14, display: "inline", marginRight: 6 }} />
                                        Anúncios deste Conjunto ({adsetAds.length})
                                    </h4>
                                    <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Clique num anúncio para ver o criativo e métricas</p>
                                </div>
                                {loadingCampaign ? (
                                    <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
                                        <Loader2 className="g-pulse" style={{ width: 24, height: 24, color: "rgba(255,255,255,0.3)" }} />
                                    </div>
                                ) : (
                                    <InsightsTable
                                        rows={adsetAds}
                                        selectedMetrics={adMetrics}
                                        nameKey="ad_name" nameLabel="Anúncio" idKey="ad_id"
                                        onRowClick={r => setSelectedAdId(r.ad_id)}
                                        onOpenMetricsPicker={() => setPickerOpen("ad")}
                                        emptyText="Nenhum anúncio com dados no período."
                                        extraColumnsRight={[{
                                            key: "status", label: "Ações", render: (r: any) => (
                                                <button onClick={() => handleToggleStatus(r.ad_id, r.status || "ACTIVE", "ad")} className="g-btn-secondary"
                                                    style={{ padding: "0.25rem 0.55rem", fontSize: "0.65rem" }}>
                                                    {r.status === "PAUSED" ? <span style={{ color: "#34d399" }}>▶ Ativar</span> : <span style={{ color: "#fbbf24" }}>⏸ Pausar</span>}
                                                </button>
                                            )
                                        }]}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* ========== AD DETAIL ========== */}
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

                    {/* ========== INSIGHTS PAGE ========== */}
                    {currentPage === "insights" && !selectedAccountId && (
                        <div className="g-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <div className="g-glass" style={{ padding: "1.25rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", marginBottom: "1rem" }}>
                                    <div style={{ padding: "0.6rem", borderRadius: "0.65rem", background: "var(--gradient-primary)" }}>
                                        <Brain style={{ width: 20, height: 20, color: "white" }} />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "white" }}>Insights da Operação</h3>
                                        <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)" }}>
                                            Análise heurística de {visibleAccounts.length} contas — saturação, CTR baixo, ROAS, anomalias vs período anterior
                                        </p>
                                    </div>
                                </div>
                                <SmartInsights accounts={visibleAccounts} />
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* MODAIS */}
            <MetricsPicker
                open={!!pickerOpen}
                onClose={() => setPickerOpen(null)}
                selected={
                    pickerOpen === "account" ? accountMetrics :
                    pickerOpen === "campaign" ? campaignMetrics :
                    pickerOpen === "adset" ? adsetMetrics :
                    adMetrics
                }
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
                selected={
                    kpiPickerOpen === "dashboard" ? dashboardKpis :
                    kpiPickerOpen === "account" ? accountKpis :
                    kpiPickerOpen === "campaign" ? campaignKpis :
                    kpiPickerOpen === "adset" ? adsetKpis :
                    adKpis
                }
                onChange={(keys) => {
                    if (kpiPickerOpen === "dashboard") setDashboardKpis(keys);
                    else if (kpiPickerOpen === "account") setAccountKpis(keys);
                    else if (kpiPickerOpen === "campaign") setCampaignKpis(keys);
                    else if (kpiPickerOpen === "adset") setAdsetKpis(keys);
                    else if (kpiPickerOpen === "ad") setAdKpis(keys);
                }}
                title={`KPIs — ${kpiPickerOpen === "dashboard" ? "Painel Geral" : kpiPickerOpen === "account" ? "Conta" : kpiPickerOpen === "campaign" ? "Campanha" : kpiPickerOpen === "adset" ? "Conjunto" : "Anúncio"}`}
            />
            <CmdK items={cmdItems} open={cmdkOpen} onClose={() => setCmdkOpen(false)} />

            <footer style={{ textAlign: "center", padding: "1.25rem 1rem", fontSize: "0.72rem", color: "rgba(255,255,255,0.45)", borderTop: "1px solid var(--glass-border)", marginTop: "1.5rem" }}>
                Hamilton gestor de tráfego e i.a
            </footer>
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
