"use client";
import { useState, useRef, useEffect } from "react";
import { Download, FileText, Brain, ChevronDown, Printer, Loader2, Check, AlertCircle } from "lucide-react";

interface Props {
    period: { preset?: string; since?: string; until?: string };
    accounts?: string[];
    /** Quando definido, mostra um rótulo do escopo no menu (ex: nome da conta atual). */
    scopeLabel?: string;
}

type Status = "idle" | "loading" | "success" | "error";

export default function ExportMenu({ period, accounts, scopeLabel }: Props) {
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState<Status>("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", fn);
        return () => document.removeEventListener("mousedown", fn);
    }, []);

    const buildUrl = (level: "accounts" | "campaigns" | "ads", format: "csv" | "json") => {
        const p = new URLSearchParams();
        if (period.preset) p.set("period", period.preset);
        if (period.since) p.set("since", period.since);
        if (period.until) p.set("until", period.until);
        if (accounts?.length) p.set("accounts", accounts.join(","));
        p.set("level", level);
        p.set("format", format);
        return `/api/meugestor/export?${p.toString()}`;
    };

    /** Faz download via fetch+blob — detecta erro JSON e mostra ao usuário em vez de baixar arquivo quebrado */
    const handleExport = async (level: "accounts" | "campaigns" | "ads", format: "csv" | "json", filename: string) => {
        setStatus("loading"); setErrorMsg("");
        try {
            const res = await fetch(buildUrl(level, format));
            const ctype = res.headers.get("content-type") || "";
            if (!res.ok || ctype.includes("application/json") && format === "csv") {
                // erro: tentar ler como JSON
                const txt = await res.text();
                try {
                    const err = JSON.parse(txt);
                    throw new Error(err.error || "Falha no export");
                } catch {
                    throw new Error(txt.slice(0, 200) || `HTTP ${res.status}`);
                }
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
            setStatus("success");
            setTimeout(() => setStatus("idle"), 2500);
        } catch (e: any) {
            setErrorMsg(e.message || "Erro");
            setStatus("error");
            setTimeout(() => setStatus("idle"), 5000);
        }
    };

    const handlePdf = () => {
        setOpen(false);
        setTimeout(() => window.print(), 100);
    };

    const periodTag = period.since && period.until
        ? `${period.since}_${period.until}`
        : (period.preset || "periodo");

    const items = [
        { label: "Contas (CSV)", icon: FileText, level: "accounts" as const, format: "csv" as const, hint: "1 linha por conta · abre no Excel/Sheets" },
        { label: "Campanhas (CSV)", icon: FileText, level: "campaigns" as const, format: "csv" as const, hint: "Todas campanhas + métricas completas" },
        { label: "Anúncios (CSV)", icon: FileText, level: "ads" as const, format: "csv" as const, hint: "Todos criativos com métricas" },
        { label: "Pacote IA (JSON)", icon: Brain, level: "ads" as const, format: "json" as const, hint: "Dados + instruções para LLM" },
    ];

    let btnLabel = "Exportar";
    let btnIcon: any = Download;
    let btnColor: string | undefined;
    if (status === "loading") { btnLabel = "Gerando..."; btnIcon = Loader2; }
    else if (status === "success") { btnLabel = "Pronto!"; btnIcon = Check; btnColor = "#34d399"; }
    else if (status === "error") { btnLabel = "Erro"; btnIcon = AlertCircle; btnColor = "#f87171"; }

    const BtnIcon = btnIcon;

    return (
        <div ref={ref} style={{ position: "relative" }}>
            <button onClick={() => setOpen(!open)} className="g-btn-secondary"
                style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", fontSize: "0.75rem", color: btnColor, borderColor: btnColor ? `${btnColor}66` : undefined }}>
                <BtnIcon style={{ width: 14, height: 14, animation: status === "loading" ? "spin 1s linear infinite" : "none" }} />
                {btnLabel}
                {status === "idle" && <ChevronDown style={{ width: 12, height: 12, opacity: 0.6 }} />}
            </button>
            {status === "error" && errorMsg && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: "rgba(248,113,113,0.95)", color: "white", fontSize: "0.7rem", padding: "0.45rem 0.7rem", borderRadius: 6, zIndex: 60, maxWidth: 320 }}>{errorMsg}</div>
            )}
            {open && status !== "loading" && (
                <div className="g-glass" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 50, width: 290, padding: "0.5rem", background: "rgba(15,18,37,0.98)" }}>
                    {scopeLabel && (
                        <div style={{ padding: "0.4rem 0.6rem 0.55rem", marginBottom: "0.3rem", borderBottom: "1px solid var(--glass-border)" }}>
                            <p style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Escopo</p>
                            <p style={{ fontSize: "0.75rem", color: "#a78bfa", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={scopeLabel}>
                                {scopeLabel}
                            </p>
                        </div>
                    )}
                    {items.map((it, i) => {
                        const Icon = it.icon;
                        const fname = `meugestor_${it.level}_${periodTag}.${it.format}`;
                        return (
                            <button key={i} onClick={() => { setOpen(false); handleExport(it.level, it.format, fname); }}
                                style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.55rem 0.6rem", borderRadius: 6, color: "rgba(255,255,255,0.85)", transition: "background 0.2s", background: "transparent", border: "none", width: "100%", textAlign: "left", cursor: "pointer" }}
                                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                                <Icon style={{ width: 16, height: 16, color: it.format === "json" ? "#a78bfa" : "#748ffc", flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: "0.78rem", fontWeight: 600 }}>{it.label}</p>
                                    <p style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)" }}>{it.hint}</p>
                                </div>
                            </button>
                        );
                    })}
                    <div style={{ borderTop: "1px solid var(--glass-border)", margin: "0.4rem 0", paddingTop: "0.4rem" }}>
                        <button onClick={handlePdf}
                            style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.55rem 0.6rem", borderRadius: 6, color: "rgba(255,255,255,0.85)", background: "transparent", border: "none", width: "100%", textAlign: "left", cursor: "pointer" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                            <Printer style={{ width: 16, height: 16, color: "#fbbf24", flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                                <p style={{ fontSize: "0.78rem", fontWeight: 600 }}>PDF (tela atual)</p>
                                <p style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)" }}>Imprimir / Salvar como PDF</p>
                            </div>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

