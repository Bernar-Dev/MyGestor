"use client";

interface Props { score: number; reasons?: string[]; size?: "sm" | "md"; }

export default function HealthBadge({ score, reasons, size = "sm" }: Props) {
    let color = "#34d399"; // verde
    let label = "Excelente";
    if (score < 40) { color = "#f87171"; label = "Crítico"; }
    else if (score < 60) { color = "#fb923c"; label = "Atenção"; }
    else if (score < 80) { color = "#fbbf24"; label = "Ok"; }
    const tip = reasons?.length ? reasons.join("\n• ") : `Score: ${score}/100`;
    const padding = size === "md" ? "0.25rem 0.625rem" : "0.125rem 0.5rem";
    const fontSize = size === "md" ? "0.75rem" : "0.625rem";
    return (
        <span title={"• " + tip} style={{
            display: "inline-flex", alignItems: "center", gap: "0.25rem",
            padding, borderRadius: 9999, fontSize, fontWeight: 700,
            background: `${color}22`, color, border: `1px solid ${color}55`,
        }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} /> {score} · {label}
        </span>
    );
}

