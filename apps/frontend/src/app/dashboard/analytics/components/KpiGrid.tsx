"use client";
import { Settings2 } from "lucide-react";
import KpiCard from "./KpiCard";
import HealthBadge from "./HealthBadge";
import { KPI_BY_ID, KpiCtx } from "../lib/kpis";
import { METRIC_BY_KEY, formatMetric, rankingLabel, rankingColor } from "../lib/metrics";

interface Props {
    ctx: KpiCtx;
    row: any;
    selected: string[];
    onOpenPicker?: () => void;
}

export default function KpiGrid({ ctx, row, selected, onOpenPicker }: Props) {
    if (!row) return null;
    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.75rem" }}>
            {selected.map(id => {
                const k = KPI_BY_ID[id];
                if (!k) return null;
                const def = METRIC_BY_KEY[k.metricKey];
                if (!def) return null;
                const Icon = k.icon;
                const val = row?.[k.metricKey];

                // Health: card especial com badge
                if (k.metricKey === "health" && val !== undefined && val !== null) {
                    return (
                        <div key={id} className="g-glass" style={{ padding: "1rem", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 110 }}>
                            <p style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>Saúde</p>
                            <HealthBadge score={Number(val)} reasons={row.health_reasons} size="md" />
                            <p style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)", marginTop: 6 }}>Quality {rankingLabel(row.quality_ranking)}</p>
                        </div>
                    );
                }

                // Rankings: card de texto com cor
                if (def.format === "text") {
                    const txt = rankingLabel(val);
                    const c = rankingColor(val);
                    return (
                        <div key={id} className="g-glass" style={{ padding: "1rem", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 110 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <p style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>{def.label}</p>
                                <Icon style={{ width: 14, height: 14, color: "rgba(255,255,255,0.3)" }} />
                            </div>
                            <p style={{ fontSize: "1.1rem", fontWeight: 700, color: c }}>{txt}</p>
                            <p style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)" }}>{def.tooltip.split(".")[0]}</p>
                        </div>
                    );
                }

                const formatted = formatMetric(val, def.format);
                const delta = row?.deltas?.[k.metricKey];
                const deltaInverse = def.higherIsBetter === false;

                let sub: string | undefined;
                if (k.subMetric) {
                    const sd = METRIC_BY_KEY[k.subMetric];
                    if (sd) sub = `${sd.short || sd.label} ${formatMetric(row?.[k.subMetric], sd.format)}`;
                }

                return (
                    <KpiCard
                        key={id}
                        title={def.label}
                        value={formatted}
                        delta={delta}
                        deltaInverse={deltaInverse}
                        icon={<Icon style={{ width: 16, height: 16 }} />}
                        color={k.color}
                        sub={sub}
                        tooltip={def.tooltip}
                    />
                );
            })}
            {onOpenPicker && (
                <button onClick={onOpenPicker}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", cursor: "pointer", border: "1px dashed rgba(255,255,255,0.18)", borderRadius: "1rem", padding: "1rem", background: "transparent", minHeight: 110, transition: "all 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(76,110,245,0.5)"; e.currentTarget.style.color = "white"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}>
                    <Settings2 style={{ width: 14, height: 14 }} /> Configurar KPIs
                </button>
            )}
        </div>
    );
}

