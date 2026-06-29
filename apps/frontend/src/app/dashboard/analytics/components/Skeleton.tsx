"use client";

/** Bloco básico com animação shimmer */
export function Skel({ w = "100%", h = "0.75rem", radius = "0.4rem", style }: {
    w?: string | number; h?: string | number; radius?: string; style?: React.CSSProperties;
}) {
    return (
        <div className="g-skeleton" style={{ width: w, height: h, borderRadius: radius, flexShrink: 0, ...style }} />
    );
}

/** Grade de KPI cards esqueleto */
export function SkeletonKpiGrid({ count = 6 }: { count?: number }) {
    return (
        <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: "0.75rem",
        }}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="g-skel-kpi">
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <Skel w={32} h={32} radius="0.6rem" />
                        <Skel w="55%" h="0.65rem" />
                    </div>
                    <Skel w="70%" h="1.6rem" />
                    <Skel w="45%" h="0.55rem" />
                </div>
            ))}
        </div>
    );
}

/** Tabela esqueleto com N linhas */
export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
    return (
        <div>
            {/* header */}
            <div className="g-skel-row" style={{ borderBottom: "1px solid var(--glass-border)" }}>
                {Array.from({ length: cols }).map((_, i) => (
                    <Skel key={i} w={i === 0 ? "30%" : `${Math.floor(60 / (cols - 1))}%`} h="0.55rem" />
                ))}
            </div>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="g-skel-row">
                    {/* nome (mais largo) */}
                    <Skel w={`${28 + (i % 3) * 8}%`} h="0.7rem" />
                    {/* colunas de métricas */}
                    {Array.from({ length: cols - 1 }).map((_, j) => (
                        <Skel key={j} w={`${10 + (j % 2) * 4}%`} h="0.6rem" />
                    ))}
                </div>
            ))}
        </div>
    );
}

/** Par de gráficos (barra + linha) esqueleto */
export function SkeletonCharts() {
    return (
        <div className="g-grid-2col">
            <SkeletonChart />
            <SkeletonChart lines />
        </div>
    );
}

function SkeletonChart({ lines = false }: { lines?: boolean }) {
    const bars = [55, 75, 45, 90, 60, 80, 50, 70, 40, 85, 65, 72];
    return (
        <div className="g-glass" style={{ padding: "1.1rem" }}>
            <Skel w="40%" h="0.85rem" style={{ marginBottom: "1.2rem" }} />
            <div style={{
                height: 200,
                display: "flex",
                alignItems: "flex-end",
                gap: lines ? 0 : "0.35rem",
                padding: "0 0.5rem",
                position: "relative",
            }}>
                {/* grid lines de fundo */}
                {[25, 50, 75, 100].map(p => (
                    <div key={p} style={{
                        position: "absolute",
                        left: 0, right: 0,
                        bottom: `${p}%`,
                        borderTop: "1px solid rgba(255,255,255,0.04)",
                    }} />
                ))}
                {lines
                    ? <SkeletonLine />
                    : bars.map((h, i) => (
                        <div key={i} className="g-skeleton"
                            style={{ flex: 1, height: `${h}%`, borderRadius: "4px 4px 0 0", animationDelay: `${i * 0.05}s` }} />
                    ))
                }
            </div>
            {/* eixo x */}
            <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.4rem", padding: "0 0.5rem" }}>
                {bars.map((_, i) => (
                    <Skel key={i} style={{ flex: 1 }} h="0.4rem" />
                ))}
            </div>
        </div>
    );
}

function SkeletonLine() {
    // SVG de uma linha ondulada fake
    return (
        <svg viewBox="0 0 300 160" preserveAspectRatio="none"
            style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}>
            <defs>
                <linearGradient id="skel-line-grad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.04)" />
                    <stop offset="40%" stopColor="rgba(255,255,255,0.12)" />
                    <stop offset="80%" stopColor="rgba(255,255,255,0.04)" />
                </linearGradient>
            </defs>
            <path d="M0,120 C30,100 50,60 80,80 S130,40 160,55 S210,20 240,35 S280,50 300,30"
                fill="none" stroke="url(#skel-line-grad)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M0,120 C30,100 50,60 80,80 S130,40 160,55 S210,20 240,35 S280,50 300,30 L300,160 L0,160 Z"
                fill="rgba(76,110,245,0.06)" />
        </svg>
    );
}

/** Tela completa de loading inicial (primeira vez que a página carrega) */
export function SkeletonDashboard({ kpiCount = 6 }: { kpiCount?: number }) {
    return (
        <div className="g-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <SkeletonKpiGrid count={kpiCount} />
            <div className="g-glass" style={{ overflow: "hidden" }}>
                <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--glass-border)", display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    <Skel w={16} h={16} radius="0.3rem" />
                    <Skel w="18%" h="0.8rem" />
                </div>
                <SkeletonTable rows={7} cols={6} />
            </div>
        </div>
    );
}

/** Loading de detalhe de conta (KPIs + gráficos + tabela de campanhas) */
export function SkeletonAccountDetail({ kpiCount = 8 }: { kpiCount?: number }) {
    return (
        <div className="g-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <SkeletonKpiGrid count={kpiCount} />
            <SkeletonCharts />
            <div className="g-glass" style={{ overflow: "hidden" }}>
                <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--glass-border)", display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    <Skel w={16} h={16} radius="0.3rem" />
                    <Skel w="22%" h="0.8rem" />
                </div>
                <SkeletonTable rows={5} cols={6} />
            </div>
        </div>
    );
}

/** Loading de detalhe de campanha (KPIs + gráfico + tabela de conjuntos) */
export function SkeletonCampaignDetail({ kpiCount = 8 }: { kpiCount?: number }) {
    return (
        <div className="g-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <SkeletonKpiGrid count={kpiCount} />
            <div className="g-glass" style={{ padding: "1.1rem" }}>
                <Skel w="35%" h="0.85rem" style={{ marginBottom: "1.2rem" }} />
                <div style={{ height: 180, display: "flex", alignItems: "flex-end", gap: "0.35rem", padding: "0 0.5rem" }}>
                    {[60, 80, 45, 90, 55, 75, 50, 85].map((h, i) => (
                        <div key={i} className="g-skeleton"
                            style={{ flex: 1, height: `${h}%`, borderRadius: "4px 4px 0 0", animationDelay: `${i * 0.06}s` }} />
                    ))}
                </div>
            </div>
            <div className="g-glass" style={{ overflow: "hidden" }}>
                <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--glass-border)", display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    <Skel w={16} h={16} radius="0.3rem" />
                    <Skel w="28%" h="0.8rem" />
                </div>
                <SkeletonTable rows={4} cols={6} />
            </div>
        </div>
    );
}
