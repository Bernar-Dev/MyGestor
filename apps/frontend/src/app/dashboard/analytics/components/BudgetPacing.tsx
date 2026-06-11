"use client";
import { TrendingUp } from "lucide-react";
import { formatCurrency } from "../lib/format";

interface DailyPoint { date_start?: string; spend: number; }
interface Props {
    daily: DailyPoint[];
    monthlyTarget?: number; // se nulo, projeta sem meta
}

/**
 * Pacing de orçamento: dado o gasto diário, projeta o gasto mensal
 * usando a média diária × 30 (independente do período selecionado).
 */
export default function BudgetPacing({ daily, monthlyTarget }: Props) {
    if (!daily?.length) return null;

    const totalSpent = daily.reduce((s, d) => s + d.spend, 0);
    const avgDaily = totalSpent / daily.length;
    // Projeção do mês = média diária × 30
    const projection = avgDaily * 30;

    let progressPct = 0;
    let projVsTarget: number | null = null;
    if (monthlyTarget && monthlyTarget > 0) {
        progressPct = (totalSpent / monthlyTarget) * 100;
        projVsTarget = ((projection - monthlyTarget) / monthlyTarget) * 100;
    }

    return (
        <div className="g-glass" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <TrendingUp style={{ width: 16, height: 16, color: "#748ffc" }} />
                <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "white" }}>Pacing de Orçamento</h4>
            </div>
            <div className="g-grid-3col">
                <div>
                    <p style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.45)" }}>Gasto Realizado</p>
                    <p style={{ fontSize: "1.05rem", color: "white", fontWeight: 700, marginTop: 4 }}>{formatCurrency(totalSpent)}</p>
                </div>
                <div>
                    <p style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.45)" }}>Média / dia</p>
                    <p style={{ fontSize: "1.05rem", color: "white", fontWeight: 700, marginTop: 4 }}>{formatCurrency(avgDaily)}</p>
                </div>
                <div>
                    <p style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.45)" }}>Projeção do Mês</p>
                    <p style={{ fontSize: "1.05rem", color: "#748ffc", fontWeight: 700, marginTop: 4 }}>{formatCurrency(projection)}</p>
                </div>
            </div>
            {monthlyTarget && monthlyTarget > 0 && (
                <div style={{ marginTop: "0.85rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "rgba(255,255,255,0.5)" }}>
                        <span>Meta {formatCurrency(monthlyTarget)}</span>
                        <span style={{ color: projVsTarget && projVsTarget > 5 ? "#f87171" : projVsTarget && projVsTarget < -5 ? "#fbbf24" : "#34d399" }}>
                            Projeção {projVsTarget && projVsTarget > 0 ? "+" : ""}{projVsTarget?.toFixed(1)}% vs meta
                        </span>
                    </div>
                    <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, marginTop: 4, overflow: "hidden" }}>
                        <div style={{
                            width: `${Math.min(100, progressPct)}%`, height: "100%",
                            background: progressPct > 100 ? "#f87171" : "var(--gradient-primary)",
                            transition: "width 0.4s ease",
                        }} />
                    </div>
                </div>
            )}
            <p style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", marginTop: "0.5rem" }}>
                Baseado em {daily.length} dias · média {formatCurrency(avgDaily)}/dia × 30 dias
            </p>
        </div>
    );
}


