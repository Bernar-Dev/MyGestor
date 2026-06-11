"use client";
import { useState, useMemo } from "react";
import { Search, X, Check } from "lucide-react";
import { KPI_CATALOG, KpiCtx, KpiDef } from "../lib/kpis";
import { METRIC_BY_KEY } from "../lib/metrics";

interface Props {
    open: boolean;
    onClose: () => void;
    ctx: KpiCtx;
    selected: string[];
    onChange: (keys: string[]) => void;
    title?: string;
}

const CATEGORY_LABEL: Record<string, string> = {
    investimento: "Investimento & Alcance",
    engajamento: "Engajamento",
    custo: "Custo",
    conversao: "Conversão",
    video: "Vídeo",
    qualidade: "Qualidade",
};

export default function KpiPicker({ open, onClose, ctx, selected, onChange, title = "Configurar KPIs" }: Props) {
    const [q, setQ] = useState("");

    const filtered = useMemo(() => {
        const lower = q.toLowerCase();
        const groups: Record<string, KpiDef[]> = {};
        for (const k of KPI_CATALOG) {
            if (!k.contexts.includes(ctx)) continue;
            const def = METRIC_BY_KEY[k.metricKey];
            if (!def) continue;
            if (lower && !def.label.toLowerCase().includes(lower) && !k.metricKey.toLowerCase().includes(lower) && !def.tooltip.toLowerCase().includes(lower)) continue;
            const cat = def.category;
            groups[cat] = groups[cat] || [];
            groups[cat].push(k);
        }
        return groups;
    }, [q, ctx]);

    if (!open) return null;

    const toggle = (id: string) => {
        if (selected.includes(id)) onChange(selected.filter(x => x !== id));
        else onChange([...selected, id]);
    };
    const move = (id: string, dir: -1 | 1) => {
        const i = selected.indexOf(id);
        if (i < 0) return;
        const j = i + dir;
        if (j < 0 || j >= selected.length) return;
        const next = [...selected];
        [next[i], next[j]] = [next[j], next[i]];
        onChange(next);
    };

    return (
        <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
            <div onClick={e => e.stopPropagation()} className="g-glass" style={{ width: "min(900px, 100%)", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "rgba(15,18,37,0.98)" }}>
                <div style={{ padding: "1.1rem 1.5rem", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <h3 style={{ color: "white", fontWeight: 700, fontSize: "1.05rem" }}>{title}</h3>
                        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", marginTop: 2 }}>{selected.length} KPIs selecionados · ordem definida pela sequência abaixo</p>
                    </div>
                    <button onClick={onClose} className="g-btn-secondary" style={{ padding: "0.4rem", display: "inline-flex" }}><X style={{ width: 16, height: 16 }} /></button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 320px) 1fr", flex: 1, overflow: "hidden" }}>
                    {/* SELECIONADOS */}
                    <div style={{ borderRight: "1px solid var(--glass-border)", overflowY: "auto", padding: "1rem" }}>
                        <p style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.45)", fontWeight: 700, marginBottom: "0.5rem" }}>Selecionados</p>
                        {selected.length === 0 && <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }}>Nenhum KPI selecionado.</p>}
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {selected.map((id, i) => {
                                const k = KPI_CATALOG.find(x => x.id === id);
                                const def = k ? METRIC_BY_KEY[k.metricKey] : null;
                                return (
                                    <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.4rem 0.5rem", background: "rgba(76,110,245,0.1)", border: "1px solid rgba(76,110,245,0.25)", borderRadius: 6, fontSize: "0.78rem", color: "white" }}>
                                        <span style={{ flex: 1 }}>{def?.label || id}</span>
                                        <button onClick={() => move(id, -1)} disabled={i === 0} className="g-btn-secondary" style={{ padding: "0.1rem 0.3rem", fontSize: "0.65rem", opacity: i === 0 ? 0.3 : 1 }}>↑</button>
                                        <button onClick={() => move(id, 1)} disabled={i === selected.length - 1} className="g-btn-secondary" style={{ padding: "0.1rem 0.3rem", fontSize: "0.65rem", opacity: i === selected.length - 1 ? 0.3 : 1 }}>↓</button>
                                        <button onClick={() => toggle(id)} className="g-btn-secondary" style={{ padding: "0.1rem 0.3rem", fontSize: "0.65rem", color: "#f87171" }}>✕</button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* CATÁLOGO */}
                    <div style={{ overflowY: "auto", padding: "1rem 1.5rem 1.5rem" }}>
                        <div style={{ position: "relative", marginBottom: "0.75rem" }}>
                            <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "rgba(255,255,255,0.3)" }} />
                            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar KPI..."
                                style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "0.45rem 0.75rem 0.45rem 2rem", fontSize: "0.8rem", color: "white", outline: "none" }} />
                        </div>
                        {Object.entries(filtered).map(([cat, kpis]) => (
                            <div key={cat} style={{ marginBottom: "1rem" }}>
                                <h4 style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)", marginBottom: "0.4rem", fontWeight: 700 }}>{CATEGORY_LABEL[cat] || cat}</h4>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 4 }}>
                                    {kpis.map(k => {
                                        const def = METRIC_BY_KEY[k.metricKey];
                                        const on = selected.includes(k.id);
                                        const Icon = k.icon;
                                        return (
                                            <button key={k.id} onClick={() => toggle(k.id)} title={def.tooltip}
                                                style={{ padding: "0.5rem 0.65rem", borderRadius: 8, textAlign: "left",
                                                    background: on ? "rgba(76,110,245,0.18)" : "rgba(255,255,255,0.03)",
                                                    border: `1px solid ${on ? "rgba(76,110,245,0.5)" : "rgba(255,255,255,0.08)"}`,
                                                    color: on ? "white" : "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: "0.78rem",
                                                    display: "flex", alignItems: "center", gap: 6 }}>
                                                <span style={{ width: 14, height: 14, borderRadius: 4, background: on ? "#4c6ef5" : "transparent", border: `1px solid ${on ? "#4c6ef5" : "rgba(255,255,255,0.2)"}`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                    {on && <Check style={{ width: 10, height: 10, color: "white" }} />}
                                                </span>
                                                <Icon style={{ width: 13, height: 13, color: "rgba(255,255,255,0.5)" }} />
                                                <span>{def.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                        {Object.keys(filtered).length === 0 && <p style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "2rem" }}>Nenhum KPI encontrado.</p>}
                    </div>
                </div>

                <div style={{ padding: "0.75rem 1.5rem", borderTop: "1px solid var(--glass-border)", display: "flex", justifyContent: "flex-end", gap: 6 }}>
                    <button onClick={() => onChange([])} className="g-btn-secondary" style={{ fontSize: "0.78rem" }}>Limpar</button>
                    <button onClick={onClose} className="g-btn-primary" style={{ fontSize: "0.78rem" }}>Aplicar</button>
                </div>
            </div>
        </div>
    );
}

