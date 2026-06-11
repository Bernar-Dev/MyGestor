"use client";
import { useState, useMemo, ReactNode } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown, Star, Settings2 } from "lucide-react";
import { METRIC_BY_KEY, formatMetric, rankingColor } from "../lib/metrics";
import DeltaTag from "./DeltaTag";
import HealthBadge from "./HealthBadge";

interface Props {
    rows: any[];
    selectedMetrics: string[];
    nameKey: string;          // ex: "name", "campaign_name", "ad_name"
    nameLabel: string;
    idKey: string;            // ex: "id", "campaign_id", "ad_id"
    onRowClick?: (row: any) => void;
    favorites?: Set<string>;
    onToggleFavorite?: (id: string) => void;
    onOpenMetricsPicker?: () => void;
    extraColumnsLeft?: { key: string; label: string; render: (row: any) => ReactNode }[];
    extraColumnsRight?: { key: string; label: string; render: (row: any) => ReactNode }[];
    showHealth?: boolean;
    emptyText?: string;
    rowSubtitle?: (row: any) => string | undefined;
    showFooter?: boolean;
}

export default function InsightsTable({
    rows, selectedMetrics, nameKey, nameLabel, idKey,
    onRowClick, favorites, onToggleFavorite, onOpenMetricsPicker,
    extraColumnsLeft = [], extraColumnsRight = [],
    showHealth = true, emptyText = "Sem dados.",
    rowSubtitle, showFooter = true,
}: Props) {
    const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>({ key: "spend", dir: "desc" });

    const sorted = useMemo(() => {
        if (!sort) return rows;
        const { key, dir } = sort;
        return [...rows].sort((a, b) => {
            const va = key === nameKey ? String(a[key] || "").toLowerCase() : Number(a[key] || 0);
            const vb = key === nameKey ? String(b[key] || "").toLowerCase() : Number(b[key] || 0);
            if (va < vb) return dir === "asc" ? -1 : 1;
            if (va > vb) return dir === "asc" ? 1 : -1;
            return 0;
        });
    }, [rows, sort, nameKey]);

    const totals = useMemo(() => {
        const t: any = {};
        for (const m of selectedMetrics) {
            t[m] = rows.reduce((s, r) => s + (Number(r[m]) || 0), 0);
        }
        const ti = rows.reduce((s, r) => s + (Number(r.impressions) || 0), 0);
        const tc = rows.reduce((s, r) => s + (Number(r.clicks) || 0), 0);
        const ts = rows.reduce((s, r) => s + (Number(r.spend) || 0), 0);
        if (t.ctr !== undefined) t.ctr = ti > 0 ? (tc / ti) * 100 : 0;
        if (t.cpc !== undefined) t.cpc = tc > 0 ? ts / tc : 0;
        if (t.cpm !== undefined) t.cpm = ti > 0 ? (ts / ti) * 1000 : 0;
        if (t.cpl !== undefined) {
            const tl = rows.reduce((s, r) => s + (Number(r.leads) || 0), 0);
            t.cpl = tl > 0 ? ts / tl : 0;
        }
        if (t.roas !== undefined) {
            const tv = rows.reduce((s, r) => s + (Number(r.purchase_value) || 0), 0);
            t.roas = ts > 0 ? tv / ts : 0;
        }
        return t;
    }, [rows, selectedMetrics]);

    const handleSort = (key: string) => {
        if (sort?.key === key) {
            if (sort.dir === "desc") setSort({ key, dir: "asc" });
            else setSort(null);
        } else setSort({ key, dir: "desc" });
    };
    const sortIcon = (key: string) => {
        if (sort?.key !== key) return <ArrowUpDown style={{ width: 11, height: 11, opacity: 0.3, marginLeft: 3 }} />;
        if (sort.dir === "asc") return <ArrowUp style={{ width: 11, height: 11, color: "white", marginLeft: 3 }} />;
        return <ArrowDown style={{ width: 11, height: 11, color: "white", marginLeft: 3 }} />;
    };

    if (rows.length === 0) {
        return <p style={{ padding: "2rem", color: "rgba(255,255,255,0.35)", textAlign: "center", fontSize: "0.85rem" }}>{emptyText}</p>;
    }

    return (
        <div style={{ overflowX: "auto" }}>
            {onOpenMetricsPicker && (
                <div style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)" }}>{rows.length} linhas · {selectedMetrics.length} métricas</span>
                    <button onClick={onOpenMetricsPicker} className="g-btn-secondary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.7rem", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Settings2 style={{ width: 12, height: 12 }} /> Métricas
                    </button>
                </div>
            )}
            <div className="g-table-scroll">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", minWidth: 720 }}>
                <thead>
                    <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--glass-border)" }}>
                        {onToggleFavorite && <th style={{ width: 28, padding: "0.6rem 0.4rem" }}></th>}
                        <th onClick={() => handleSort(nameKey)}
                            style={{ textAlign: "left", padding: "0.7rem 0.5rem", color: "rgba(255,255,255,0.5)", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer", fontWeight: 600 }}>
                            <span style={{ display: "inline-flex", alignItems: "center" }}>{nameLabel} {sortIcon(nameKey)}</span>
                        </th>
                        {extraColumnsLeft.map(c => (
                            <th key={c.key} style={{ textAlign: "left", padding: "0.7rem 0.5rem", color: "rgba(255,255,255,0.5)", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{c.label}</th>
                        ))}
                        {selectedMetrics.map(k => {
                            const def = METRIC_BY_KEY[k];
                            if (!def) return null;
                            return (
                                <th key={k} onClick={() => handleSort(k)} title={def.tooltip}
                                    style={{ textAlign: "right", padding: "0.7rem 0.5rem", color: "rgba(255,255,255,0.5)", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
                                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end" }}>{def.short || def.label} {sortIcon(k)}</span>
                                </th>
                            );
                        })}
                        {showHealth && <th style={{ textAlign: "center", padding: "0.7rem 0.5rem", color: "rgba(255,255,255,0.5)", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Saúde</th>}
                        {extraColumnsRight.map(c => (
                            <th key={c.key} style={{ textAlign: "center", padding: "0.7rem 0.5rem", color: "rgba(255,255,255,0.5)", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{c.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((row, idx) => {
                        const id = row[idKey];
                        const fav = favorites?.has(id);
                        return (
                            <tr key={idx} className="g-table-row" style={{ cursor: onRowClick ? "pointer" : "default" }}
                                onClick={() => onRowClick?.(row)}>
                                {onToggleFavorite && (
                                    <td style={{ padding: "0.55rem 0.4rem", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                                        <button onClick={() => onToggleFavorite(id)} title={fav ? "Remover dos favoritos" : "Marcar como cliente"}
                                            style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                                            <Star style={{ width: 14, height: 14, color: fav ? "#fbbf24" : "rgba(255,255,255,0.18)", fill: fav ? "#fbbf24" : "transparent" }} />
                                        </button>
                                    </td>
                                )}
                                <td style={{ padding: "0.55rem 0.5rem", color: "white", fontWeight: 600, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis" }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}>{row[nameKey] || "—"}</span>
                                        {rowSubtitle?.(row) && <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>{rowSubtitle(row)}</span>}
                                    </div>
                                </td>
                                {extraColumnsLeft.map(c => <td key={c.key} style={{ padding: "0.55rem 0.5rem" }}>{c.render(row)}</td>)}
                                {selectedMetrics.map(k => {
                                    const def = METRIC_BY_KEY[k];
                                    if (!def) return null;
                                    const val = row[k];
                                    const delta = row.deltas?.[k];
                                    const isText = def.format === "text";
                                    return (
                                        <td key={k} style={{ padding: "0.55rem 0.5rem", textAlign: "right", color: isText ? rankingColor(val) : "rgba(255,255,255,0.85)", whiteSpace: "nowrap" }}>
                                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                                                <span style={{ fontWeight: k === "spend" ? 700 : 500, color: k === "spend" ? "white" : isText ? rankingColor(val) : "rgba(255,255,255,0.85)" }}>{formatMetric(val, def.format)}</span>
                                                {delta !== undefined && delta !== null && <DeltaTag value={delta} inverse={def.higherIsBetter === false} compact />}
                                            </div>
                                        </td>
                                    );
                                })}
                                {showHealth && (
                                    <td style={{ padding: "0.55rem 0.5rem", textAlign: "center" }}>
                                        {row.health !== undefined ? <HealthBadge score={row.health} reasons={row.health_reasons} /> : null}
                                    </td>
                                )}
                                {extraColumnsRight.map(c => <td key={c.key} onClick={e => e.stopPropagation()} style={{ padding: "0.55rem 0.5rem", textAlign: "center" }}>{c.render(row)}</td>)}
                            </tr>
                        );
                    })}
                </tbody>
                {showFooter && (
                    <tfoot>
                        <tr style={{ borderTop: "2px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.02)" }}>
                            {onToggleFavorite && <td></td>}
                            <td style={{ padding: "0.65rem 0.5rem", color: "white", fontWeight: 700 }}>Total ({rows.length})</td>
                            {extraColumnsLeft.map(c => <td key={c.key}></td>)}
                            {selectedMetrics.map(k => {
                                const def = METRIC_BY_KEY[k];
                                if (!def) return null;
                                if (def.format === "text") return <td key={k}></td>;
                                return (
                                    <td key={k} style={{ padding: "0.65rem 0.5rem", textAlign: "right", color: "white", fontWeight: 700 }}>
                                        {formatMetric(totals[k], def.format)}
                                    </td>
                                );
                            })}
                            {showHealth && <td></td>}
                            {extraColumnsRight.map(c => <td key={c.key}></td>)}
                        </tr>
                    </tfoot>
                )}
            </table>
            </div>
        </div>
    );
}

