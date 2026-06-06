"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle, TrendingUp, MousePointerClick, Eye, DollarSign } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

interface Insights {
    spend?: string; impressions?: string; clicks?: string;
    ctr?: string; cpc?: string; cpm?: string; reach?: string; frequency?: string;
}
interface Campaign {
    id: string; name: string; objective: string; effective_status: string;
    daily_budget?: string; lifetime_budget?: string;
}
interface AdCreative {
    id: string; name: string; status: string;
    creative?: { thumbnail_url?: string; image_url?: string; title?: string; body?: string };
}
interface PortalResp {
    insights: Insights | null;
    campaigns: Campaign[];
    ads: AdCreative[];
    permissions: Record<string, boolean>;
}

const PRESETS: { v: string; label: string }[] = [
    { v: "today",      label: "Hoje" },
    { v: "yesterday",  label: "Ontem" },
    { v: "last_7d",    label: "7 dias" },
    { v: "last_30d",   label: "30 dias" },
    { v: "this_month", label: "Este mês" },
    { v: "last_month", label: "Mês passado" },
];

export default function PortalAccountPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: adAccountId } = use(params);
    const [data, setData] = useState<PortalResp | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [preset, setPreset] = useState("last_30d");

    const load = async () => {
        setLoading(true); setErr("");
        try {
            const j = await apiFetch<PortalResp>(
                `/portal/insights?ad_account_id=${encodeURIComponent(adAccountId)}&date_preset=${preset}`,
            );
            setData(j);
        } catch (e: any) { setErr(e.message); }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); /* eslint-disable-line */ }, [preset]);

    return (
        <div className="min-h-screen">
            <header className="flex items-center justify-between px-4 md:px-6 py-4 border-b" style={{ borderColor: "var(--color-glass-border)" }}>
                <div className="flex items-center gap-3">
                    <Link href="/portal" className="btn-secondary"><ArrowLeft className="w-4 h-4" /></Link>
                    <div>
                        <h1 className="font-bold">Conta {adAccountId}</h1>
                        <p className="text-xs muted">Métricas e campanhas</p>
                    </div>
                </div>
                <select className="input" style={{ width: "auto" }} value={preset} onChange={e => setPreset(e.target.value)}>
                    {PRESETS.map(p => <option key={p.v} value={p.v}>{p.label}</option>)}
                </select>
            </header>

            <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
                {loading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin muted" /></div>}

                {err && (
                    <div className="glass p-4 flex items-center gap-2 text-sm" style={{ color: "#fca5a5" }}>
                        <AlertCircle className="w-4 h-4" /> {err}
                    </div>
                )}

                {data?.insights && (
                    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <KPI label="Gasto" icon={DollarSign} value={fmtMoney(data.insights.spend)} />
                        <KPI label="Impressões" icon={Eye} value={fmtNum(data.insights.impressions)} />
                        <KPI label="Cliques" icon={MousePointerClick} value={fmtNum(data.insights.clicks)} />
                        <KPI label="CTR" icon={TrendingUp} value={fmtPct(data.insights.ctr)} />
                        <KPI label="CPC" value={fmtMoney(data.insights.cpc)} />
                        <KPI label="CPM" value={fmtMoney(data.insights.cpm)} />
                        <KPI label="Alcance" value={fmtNum(data.insights.reach)} />
                        <KPI label="Frequência" value={fmtFloat(data.insights.frequency)} />
                    </section>
                )}

                {data && data.campaigns.length > 0 && (
                    <section className="glass">
                        <div className="p-4 md:p-5 border-b" style={{ borderColor: "var(--color-glass-border)" }}>
                            <h2 className="font-bold">Campanhas ({data.campaigns.length})</h2>
                        </div>
                        <ul className="divide-y" style={{ borderColor: "var(--color-glass-border)" }}>
                            {data.campaigns.map(c => (
                                <li key={c.id} className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold text-sm">{c.name}</p>
                                        <p className="text-xs muted">{c.objective}</p>
                                    </div>
                                    <span className="text-xs px-2 py-0.5 rounded-full" style={{
                                        background: c.effective_status === "ACTIVE" ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.05)",
                                        color: c.effective_status === "ACTIVE" ? "#34d399" : "rgba(255,255,255,0.5)",
                                    }}>{c.effective_status}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {data && data.ads.length > 0 && (
                    <section className="glass p-5">
                        <h2 className="font-bold mb-3">Anúncios ativos ({data.ads.length})</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {data.ads.map(a => (
                                <div key={a.id} className="glass p-2">
                                    {a.creative?.thumbnail_url || a.creative?.image_url ? (
                                        <img src={a.creative.image_url || a.creative.thumbnail_url} alt="" className="w-full aspect-square object-cover rounded-md" />
                                    ) : (
                                        <div className="w-full aspect-square rounded-md flex items-center justify-center muted text-xs" style={{ background: "rgba(255,255,255,0.03)" }}>sem mídia</div>
                                    )}
                                    <p className="text-xs mt-2 line-clamp-2">{a.name}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}

function KPI({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) {
    return (
        <div className="glass p-3">
            <div className="flex items-start justify-between">
                <p className="text-xs muted uppercase tracking-wide">{label}</p>
                {Icon && <Icon className="w-4 h-4" style={{ color: "#a78bfa" }} />}
            </div>
            <p className="text-xl font-bold mt-1">{value}</p>
        </div>
    );
}

function fmtNum(s: string | undefined): string {
    if (!s) return "—";
    return Number(s).toLocaleString("pt-BR");
}
function fmtMoney(s: string | undefined): string {
    if (!s) return "—";
    return Number(s).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPct(s: string | undefined): string {
    if (!s) return "—";
    return `${Number(s).toFixed(2)}%`;
}
function fmtFloat(s: string | undefined): string {
    if (!s) return "—";
    return Number(s).toFixed(2);
}
