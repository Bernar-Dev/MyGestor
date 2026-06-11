"use client";
import { ReactNode } from "react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { formatDelta } from "../lib/format";

interface Props {
    title: string;
    tooltip?: string;
    value: string;
    sub?: string;
    color?: "blue" | "green" | "yellow" | "red" | "purple";
    icon?: ReactNode;
    delta?: number | null;
    deltaInverse?: boolean; // se true, queda é positiva (ex: CPC, CPL)
    sparkline?: number[];
}

export default function KpiCard({ title, tooltip, value, sub, color = "blue", icon, delta, deltaInverse = false, sparkline }: Props) {
    const d = formatDelta(delta);
    let deltaColor = "rgba(255,255,255,0.4)";
    let DeltaIcon: any = Minus;
    if (d.positive !== null) {
        const isGood = deltaInverse ? !d.positive : d.positive;
        deltaColor = isGood ? "#34d399" : "#f87171";
        DeltaIcon = d.positive ? TrendingUp : TrendingDown;
    }
    return (
        <div className={`g-glass g-glass-hover g-metric ${color}`} title={tooltip}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <p style={{ fontSize: "0.625rem", fontWeight: 600, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.08em", cursor: "help" }}>{title}</p>
                {icon && <div style={{ color: "rgba(255,255,255,0.3)" }}>{icon}</div>}
            </div>
            <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "white", letterSpacing: "-0.02em", lineHeight: 1.1 }}>{value}</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.5rem", gap: "0.5rem" }}>
                <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)" }}>{sub || ""}</p>
                {delta !== undefined && (
                    <span style={{ fontSize: "0.7rem", color: deltaColor, display: "inline-flex", alignItems: "center", gap: "0.2rem", fontWeight: 600 }}>
                        <DeltaIcon style={{ width: 12, height: 12 }} /> {d.text}
                    </span>
                )}
            </div>
            {sparkline && sparkline.length > 1 && (
                <Sparkline data={sparkline} color={color} />
            )}
        </div>
    );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
    const w = 200, h = 28;
    const max = Math.max(...data), min = Math.min(...data);
    const span = max - min || 1;
    const pts = data.map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((v - min) / span) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const stroke =
        color === "green" ? "#34d399" :
        color === "yellow" ? "#fbbf24" :
        color === "red" ? "#f87171" :
        color === "purple" ? "#a78bfa" : "#748ffc";
    return (
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 28, marginTop: 6 }}>
            <polyline fill="none" stroke={stroke} strokeWidth={1.5} points={pts} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}

