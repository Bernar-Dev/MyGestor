"use client";
import { useEffect, useRef, useState } from "react";
import { Search, Hash, Building2, Layers } from "lucide-react";

export interface CmdItem {
    id: string;
    title: string;
    subtitle?: string;
    type: "account" | "campaign" | "ad";
    onSelect: () => void;
}

export default function CmdK({ items, open, onClose }: { items: CmdItem[]; open: boolean; onClose: () => void }) {
    const [q, setQ] = useState("");
    const [active, setActive] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setQ(""); setActive(0);
            setTimeout(() => inputRef.current?.focus(), 30);
        }
    }, [open]);

    const filtered = q
        ? items.filter(i => i.title.toLowerCase().includes(q.toLowerCase()) || (i.subtitle?.toLowerCase().includes(q.toLowerCase())))
        : items.slice(0, 50);

    const onKey = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(filtered.length - 1, a + 1)); }
        if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
        if (e.key === "Enter" && filtered[active]) { filtered[active].onSelect(); onClose(); }
        if (e.key === "Escape") onClose();
    };

    if (!open) return null;
    return (
        <div onClick={onClose} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
            zIndex: 200, display: "flex", justifyContent: "center", paddingTop: "10vh",
        }}>
            <div onClick={e => e.stopPropagation()} className="g-glass" style={{
                width: "min(620px, 92%)", height: "fit-content", overflow: "hidden",
                background: "rgba(15,18,37,0.98)",
            }}>
                <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--glass-border)", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <Search style={{ width: 16, height: 16, color: "rgba(255,255,255,0.5)" }} />
                    <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setActive(0); }} onKeyDown={onKey}
                        placeholder="Buscar contas, campanhas, anúncios..."
                        style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "white", fontSize: "0.9rem" }} />
                    <kbd style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem", background: "rgba(255,255,255,0.06)", borderRadius: 4, color: "rgba(255,255,255,0.4)" }}>ESC</kbd>
                </div>
                <div style={{ maxHeight: 380, overflowY: "auto" }}>
                    {filtered.length === 0 && <p style={{ padding: "1.5rem", color: "rgba(255,255,255,0.4)", textAlign: "center", fontSize: "0.85rem" }}>Nenhum resultado.</p>}
                    {filtered.map((it, i) => {
                        const Icon = it.type === "account" ? Building2 : it.type === "campaign" ? Layers : Hash;
                        return (
                            <button key={it.id} onClick={() => { it.onSelect(); onClose(); }}
                                onMouseEnter={() => setActive(i)}
                                style={{
                                    display: "flex", alignItems: "center", gap: "0.7rem",
                                    width: "100%", textAlign: "left", padding: "0.7rem 1rem",
                                    background: active === i ? "rgba(76,110,245,0.15)" : "transparent",
                                    border: "none", color: "white", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.04)",
                                }}>
                                <Icon style={{ width: 14, height: 14, color: "rgba(255,255,255,0.4)", flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: "0.82rem", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</p>
                                    {it.subtitle && <p style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.subtitle}</p>}
                                </div>
                                <span style={{ fontSize: "0.6rem", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>{it.type}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

