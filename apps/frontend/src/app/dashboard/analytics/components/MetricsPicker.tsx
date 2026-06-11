"use client";
import { useState, useMemo } from "react";
import { Search, X, Check, Sparkles } from "lucide-react";
import { METRIC_CATALOG, MetricCategory, PRESETS } from "../lib/metrics";

const CATEGORY_LABEL: Record<MetricCategory, string> = {
    investimento: "Investimento & Alcance",
    engajamento: "Engajamento",
    custo: "Custo",
    conversao: "Conversão",
    video: "Vídeo",
    qualidade: "Qualidade Meta",
    audiencia: "Audiência",
};

interface Props {
    open: boolean;
    onClose: () => void;
    selected: string[];
    onChange: (keys: string[]) => void;
    title?: string;
}

export default function MetricsPicker({ open, onClose, selected, onChange, title = "Selecionar Métricas" }: Props) {
    const [q, setQ] = useState("");

    const filtered = useMemo(() => {
        const lower = q.toLowerCase();
        const groups: Record<string, typeof METRIC_CATALOG> = {};
        for (const m of METRIC_CATALOG) {
            if (lower && !m.label.toLowerCase().includes(lower) && !m.key.toLowerCase().includes(lower) && !m.tooltip.toLowerCase().includes(lower))
                continue;
            groups[m.category] = groups[m.category] || [];
            groups[m.category].push(m);
        }
        return groups;
    }, [q]);

    if (!open) return null;

    const toggle = (k: string) => {
        if (selected.includes(k)) onChange(selected.filter(x => x !== k));
        else onChange([...selected, k]);
    };
    const applyPreset = (keys: string[]) => onChange([...keys]);

    return (
        <div onClick={onClose} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem",
        }}>
            <div onClick={e => e.stopPropagation()} className="g-glass" style={{
                width: "min(900px, 100%)", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden",
            }}>
                <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <h3 style={{ color: "white", fontWeight: 700, fontSize: "1.05rem" }}>{title}</h3>
                        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem", marginTop: 2 }}>{selected.length} de {METRIC_CATALOG.length} selecionadas</p>
                    </div>
                    <button onClick={onClose} className="g-btn-secondary" style={{ padding: "0.4rem", display: "inline-flex" }}>
                        <X style={{ width: 16, height: 16 }} />
                    </button>
                </div>

                <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--glass-border)", display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
                        <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "rgba(255,255,255,0.3)" }} />
                        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar métrica..."
                            style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.65rem", padding: "0.45rem 0.75rem 0.45rem 2rem", fontSize: "0.8rem", color: "white", outline: "none" }} />
                    </div>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.7rem", marginLeft: "0.5rem" }}><Sparkles style={{ width: 12, height: 12, display: "inline" }} /> Presets:</span>
                    {Object.entries(PRESETS).map(([name, keys]) => (
                        <button key={name} onClick={() => applyPreset(keys)} className="g-btn-secondary"
                            style={{ padding: "0.3rem 0.6rem", fontSize: "0.7rem" }}>
                            {name}
                        </button>
                    ))}
                    <button onClick={() => onChange([])} className="g-btn-secondary"
                        style={{ padding: "0.3rem 0.6rem", fontSize: "0.7rem", color: "#f87171" }}>
                        Limpar
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem 1.5rem 1.5rem" }}>
                    {Object.entries(filtered).map(([cat, metrics]) => (
                        <div key={cat} style={{ marginTop: "1.25rem" }}>
                            <h4 style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)", marginBottom: "0.5rem", fontWeight: 700 }}>
                                {CATEGORY_LABEL[cat as MetricCategory]}
                            </h4>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.4rem" }}>
                                {metrics.map(m => {
                                    const on = selected.includes(m.key);
                                    return (
                                        <button key={m.key} onClick={() => toggle(m.key)} title={m.tooltip}
                                            style={{
                                                padding: "0.55rem 0.7rem", borderRadius: "0.65rem", textAlign: "left",
                                                background: on ? "rgba(76,110,245,0.18)" : "rgba(255,255,255,0.03)",
                                                border: `1px solid ${on ? "rgba(76,110,245,0.5)" : "rgba(255,255,255,0.08)"}`,
                                                color: on ? "white" : "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: "0.78rem",
                                                display: "flex", alignItems: "center", gap: "0.5rem",
                                            }}>
                                            <span style={{
                                                width: 14, height: 14, borderRadius: 4,
                                                background: on ? "#4c6ef5" : "transparent",
                                                border: `1px solid ${on ? "#4c6ef5" : "rgba(255,255,255,0.2)"}`,
                                                display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                            }}>{on && <Check style={{ width: 10, height: 10, color: "white" }} />}</span>
                                            <span>{m.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                    {Object.keys(filtered).length === 0 && (
                        <p style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "2rem" }}>Nenhuma métrica encontrada.</p>
                    )}
                </div>

                <div style={{ padding: "0.85rem 1.5rem", borderTop: "1px solid var(--glass-border)", display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={onClose} className="g-btn-primary">Aplicar</button>
                </div>
            </div>
        </div>
    );
}

