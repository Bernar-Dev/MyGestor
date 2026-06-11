"use client";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { formatDelta } from "../lib/format";

export default function DeltaTag({ value, inverse = false, compact = false }: { value: number | null | undefined; inverse?: boolean; compact?: boolean }) {
    const d = formatDelta(value);
    if (d.positive === null) return <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.7rem" }}>—</span>;
    const isGood = inverse ? !d.positive : d.positive;
    const color = isGood ? "#34d399" : "#f87171";
    const Icon = d.positive ? TrendingUp : (value === 0 ? Minus : TrendingDown);
    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color, fontSize: compact ? "0.65rem" : "0.7rem", fontWeight: 600 }}>
            <Icon style={{ width: 11, height: 11 }} /> {d.text}
        </span>
    );
}

