"use client";
import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown, Check } from "lucide-react";

const PRESETS = [
    { value: "today", label: "Hoje" },
    { value: "yesterday", label: "Ontem" },
    { value: "last_3d", label: "Últimos 3 dias" },
    { value: "last_7d", label: "Últimos 7 dias" },
    { value: "last_14d", label: "Últimos 14 dias" },
    { value: "last_28d", label: "Últimos 28 dias" },
    { value: "last_30d", label: "Últimos 30 dias" },
    { value: "last_90d", label: "Últimos 90 dias" },
    { value: "this_month", label: "Este mês" },
    { value: "last_month", label: "Mês passado" },
    { value: "this_quarter", label: "Este trimestre" },
    { value: "last_quarter", label: "Trimestre passado" },
    { value: "this_year", label: "Este ano" },
    { value: "last_year", label: "Ano passado" },
];

export interface DateRangeValue {
    preset?: string;
    since?: string;
    until?: string;
}

interface Props {
    value: DateRangeValue;
    onChange: (v: DateRangeValue) => void;
    compare: boolean;
    onCompareChange: (v: boolean) => void;
}

export default function DateRangePicker({ value, onChange, compare, onCompareChange }: Props) {
    const [open, setOpen] = useState(false);
    const [since, setSince] = useState(value.since || "");
    const [until, setUntil] = useState(value.until || "");
    const ref = useRef<HTMLDivElement>(null);

    // ressincroniza inputs quando value muda externamente (ex: hidratado do localStorage)
    useEffect(() => {
        setSince(value.since || "");
        setUntil(value.until || "");
    }, [value.since, value.until]);

    useEffect(() => {
        const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, []);

    const presetLabel = PRESETS.find(p => p.value === value.preset)?.label;
    const customLabel = value.since && value.until ? `${value.since} → ${value.until}` : null;
    const label = customLabel || presetLabel || "Selecione período";

    const applyPreset = (preset: string) => {
        onChange({ preset });
        setSince(""); setUntil("");
        setOpen(false);
    };
    const applyCustom = () => {
        if (!since || !until) {
            alert("Preencha as duas datas (de / até).");
            return;
        }
        if (since > until) {
            alert("Data inicial deve ser menor ou igual à final.");
            return;
        }
        onChange({ since, until });
        setOpen(false);
    };

    return (
        <div ref={ref} style={{ position: "relative" }}>
            <button onClick={() => setOpen(!open)} className="g-btn-secondary"
                style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", fontSize: "0.75rem" }}>
                <Calendar style={{ width: 14, height: 14 }} />
                <span>{label}</span>
                <ChevronDown style={{ width: 12, height: 12, opacity: 0.6 }} />
            </button>
            {open && (
                <div className="g-glass" style={{
                    position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 50,
                    width: 460, padding: "1rem", display: "flex", gap: "1rem", background: "rgba(15,18,37,0.98)",
                }}>
                    <div style={{ flex: 1, borderRight: "1px solid rgba(255,255,255,0.08)", paddingRight: "1rem" }}>
                        <p style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: "0.5rem" }}>Atalhos</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 280, overflowY: "auto" }}>
                            {PRESETS.map(p => (
                                <button key={p.value} onClick={() => applyPreset(p.value)}
                                    style={{
                                        textAlign: "left", padding: "0.4rem 0.5rem", borderRadius: 6,
                                        background: value.preset === p.value ? "rgba(76,110,245,0.18)" : "transparent",
                                        border: "none", color: value.preset === p.value ? "white" : "rgba(255,255,255,0.65)",
                                        cursor: "pointer", fontSize: "0.78rem",
                                    }}>{p.label}</button>
                            ))}
                        </div>
                    </div>
                    <div style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <p style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)" }}>Personalizado</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                            <div>
                                <label style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.5)" }}>De</label>
                                <input type="date" value={since} onChange={e => setSince(e.target.value)}
                                    style={{ width: "100%", padding: "0.4rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "white", fontSize: "0.78rem" }} />
                            </div>
                            <div>
                                <label style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.5)" }}>Até</label>
                                <input type="date" value={until} onChange={e => setUntil(e.target.value)}
                                    style={{ width: "100%", padding: "0.4rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "white", fontSize: "0.78rem" }} />
                            </div>
                        </div>
                        <button onClick={applyCustom} className="g-btn-primary" style={{ marginTop: "0.5rem", padding: "0.45rem", fontSize: "0.78rem" }}>
                            Aplicar Range
                        </button>
                        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem", padding: "0.5rem", background: "rgba(255,255,255,0.03)", borderRadius: 6, cursor: "pointer", fontSize: "0.75rem", color: "rgba(255,255,255,0.8)" }}>
                            <input type="checkbox" checked={compare} onChange={e => onCompareChange(e.target.checked)} style={{ accentColor: "#4c6ef5" }} />
                            Comparar com período anterior
                            {compare && <Check style={{ width: 12, height: 12, color: "#34d399", marginLeft: "auto" }} />}
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
}

