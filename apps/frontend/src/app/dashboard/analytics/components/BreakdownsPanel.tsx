"use client";
import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Layers, Loader2 } from "lucide-react";
import { formatCurrency, formatNumber, formatPct } from "../lib/format";

const DIMENSIONS = [
    { value: "age,gender", label: "Idade + Gênero" },
    { value: "age", label: "Idade" },
    { value: "gender", label: "Gênero" },
    { value: "device_platform", label: "Dispositivo" },
    { value: "publisher_platform", label: "Plataforma" },
    { value: "platform_position", label: "Posicionamento" },
    { value: "impression_device", label: "Aparelho" },
    { value: "country", label: "País" },
    { value: "region", label: "Região" },
    { value: "hourly_stats_aggregated_by_advertiser_time_zone", label: "Hora do dia" },
];

const METRICS = [
    { key: "spend", label: "Investimento", format: "currency" },
    { key: "impressions", label: "Impressões", format: "number" },
    { key: "ctr", label: "CTR", format: "percent" },
    { key: "cpc", label: "CPC", format: "currency" },
    { key: "leads", label: "Leads", format: "number" },
    { key: "messaging_started", label: "Conversas", format: "number" },
    { key: "purchases", label: "Compras", format: "number" },
];

interface Props {
    objectId: string;
    level?: "account" | "campaign" | "adset" | "ad";
    period: { preset?: string; since?: string; until?: string };
}

export default function BreakdownsPanel({ objectId, level = "account", period }: Props) {
    const accountId = objectId; // mantém variável legada do componente
    const [dim, setDim] = useState<string>("age,gender");
    const [metric, setMetric] = useState("spend");
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!accountId) return;
        setLoading(true);
        const params = new URLSearchParams();
        params.set("dim", dim);
        if (period.preset) params.set("period", period.preset);
        if (period.since) params.set("since", period.since);
        if (period.until) params.set("until", period.until);
        fetch(`/api/meugestor/breakdowns/${accountId}?${params.toString()}`)
            .then(r => r.json())
            .then(j => { if (j.success) setData(j.data); else setData([]); })
            .finally(() => setLoading(false));
    }, [accountId, dim, period.preset, period.since, period.until]);

    const fmt = METRICS.find(m => m.key === metric)?.format || "number";
    const fmtFn = (v: number) => fmt === "currency" ? formatCurrency(v) : fmt === "percent" ? formatPct(v) : formatNumber(v);

    const labelOf = (row: any): string => {
        if (dim === "age,gender") return `${row.age || "?"} · ${row.gender || "?"}`;
        if (dim === "hourly_stats_aggregated_by_advertiser_time_zone")
            return row.hourly_stats_aggregated_by_advertiser_time_zone || "?";
        const k = dim.split(",")[0];
        return row[k] || "?";
    };

    const sorted = [...data].sort((a, b) => Number(b[metric] || 0) - Number(a[metric] || 0)).slice(0, 30);
    const chartData = sorted.map(r => ({ name: labelOf(r), value: Number(r[metric] || 0), raw: r }));

    return (
        <div className="g-glass" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                <Layers style={{ width: 16, height: 16, color: "#a78bfa" }} />
                <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "white" }}>
                    Análise por Segmento {level !== "account" && <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)", fontWeight: 500, marginLeft: 4 }}>({level === "campaign" ? "campanha" : level === "adset" ? "conjunto" : "anúncio"})</span>}
                </h4>
                <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <select value={dim} onChange={e => setDim(e.target.value)}
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "0.35rem 0.6rem", color: "white", fontSize: "0.75rem" }}>
                        {DIMENSIONS.map(d => <option key={d.value} value={d.value} style={{ background: "#1a1d35" }}>{d.label}</option>)}
                    </select>
                    <select value={metric} onChange={e => setMetric(e.target.value)}
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "0.35rem 0.6rem", color: "white", fontSize: "0.75rem" }}>
                        {METRICS.map(m => <option key={m.key} value={m.key} style={{ background: "#1a1d35" }}>{m.label}</option>)}
                    </select>
                </div>
            </div>
            {loading ? (
                <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Loader2 className="g-pulse" style={{ width: 24, height: 24, color: "rgba(255,255,255,0.3)" }} />
                </div>
            ) : chartData.length === 0 ? (
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", textAlign: "center", padding: "2rem" }}>Sem dados desse breakdown.</p>
            ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 22)}>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 60, top: 4, bottom: 4 }}>
                        <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                        <YAxis dataKey="name" type="category" width={140} tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }} />
                        <Tooltip content={({ active, payload }: any) =>
                            active && payload?.[0] ? (
                                <div className="g-glass" style={{ padding: 8, background: "rgba(15,18,37,0.95)" }}>
                                    <p style={{ color: "white", fontSize: "0.75rem", fontWeight: 600 }}>{payload[0].payload.name}</p>
                                    <p style={{ color: "#748ffc", fontSize: "0.75rem" }}>{fmtFn(payload[0].value)}</p>
                                </div>
                            ) : null
                        } />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {chartData.map((_, i) => (
                                <Cell key={i} fill={`hsl(${230 + (i * 7) % 120}, 70%, 60%)`} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}

