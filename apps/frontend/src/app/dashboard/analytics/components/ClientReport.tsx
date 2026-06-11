"use client";
import { useState } from "react";
import { Copy, MessageCircle, Check } from "lucide-react";
import { formatCurrency, formatDelta, formatNumber, formatPct } from "../lib/format";

interface Props {
    accountName: string;
    period: string;
    flat: any;       // FlatInsight
    deltas?: any;    // {spend, ctr, cpc, leads, cpl, roas, ...} delta percentual ou null
}

/**
 * Gera texto pronto para copiar/colar no WhatsApp do cliente.
 * Formatado em markdown leve (negrito com *, emojis), nivelado para gestor.
 */
export default function ClientReport({ accountName, period, flat, deltas }: Props) {
    const [copied, setCopied] = useState(false);
    const text = buildText(accountName, period, flat, deltas);
    const copy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };
    return (
        <div className="g-glass" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <MessageCircle style={{ width: 16, height: 16, color: "#34d399" }} />
                    <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "white" }}>Relatório do Cliente</h4>
                </div>
                <button onClick={copy} className="g-btn-secondary"
                    style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {copied ? <><Check style={{ width: 12, height: 12, color: "#34d399" }} /> Copiado</> : <><Copy style={{ width: 12, height: 12 }} /> Copiar</>}
                </button>
            </div>
            <pre style={{
                fontFamily: "inherit", whiteSpace: "pre-wrap", color: "rgba(255,255,255,0.85)",
                background: "rgba(0,0,0,0.2)", padding: "0.85rem", borderRadius: 8, fontSize: "0.78rem", lineHeight: 1.55,
                maxHeight: 320, overflowY: "auto",
            }}>{text}</pre>
        </div>
    );
}

function buildText(name: string, period: string, f: any, d: any): string {
    const lines: string[] = [];
    lines.push(`📊 *Relatório ${name}*`);
    lines.push(`📅 Período: ${period}`);
    lines.push("");
    lines.push("*Resumo*");
    lines.push(`• Investimento: ${formatCurrency(f.spend)} ${dline(d?.spend)}`);
    lines.push(`• Alcance: ${formatNumber(f.reach)} pessoas (freq. ${(f.frequency || 0).toFixed(1)})`);
    lines.push(`• Cliques no link: ${formatNumber(f.inline_link_clicks)} · CTR ${formatPct(f.inline_link_click_ctr || f.ctr)} ${dline(d?.ctr)}`);
    lines.push(`• CPC link: ${formatCurrency(f.cost_per_inline_link_click || f.cpc)} ${dline(d?.cpc, true)}`);
    if (f.leads > 0) {
        lines.push(`• Leads: *${f.leads}* · CPL ${formatCurrency(f.cpl)} ${dline(d?.cpl, true)}`);
    }
    if (f.messaging_started > 0) {
        lines.push(`• Conversas WhatsApp: *${f.messaging_started}* · custo ${formatCurrency(f.cpa_messaging)}`);
    }
    if (f.purchases > 0) {
        lines.push(`• Compras: *${f.purchases}* · receita ${formatCurrency(f.purchase_value)} · ROAS ${(f.roas || 0).toFixed(2)}x ${dline(d?.roas)}`);
    }
    if (f.video_3s > 0) {
        lines.push(`• Vídeo: ${formatNumber(f.video_3s)} views 3s · hook ${formatPct(f.hook_rate)} · hold ${formatPct(f.hold_rate)}`);
    }
    lines.push("");
    lines.push("*Destaques*");
    if (f.frequency > 4) lines.push("⚠ Frequência alta — público pode estar saturado");
    if ((f.ctr || 0) < 0.8 && f.impressions > 1000) lines.push("⚠ CTR abaixo do esperado — testar criativos novos");
    if (f.spend > 50 && (f.leads + f.messaging_started + f.purchases) === 0) lines.push("⚠ Sem conversões registradas — verificar pixel/eventos");
    if (f.roas >= 2) lines.push("✅ ROAS positivo — campanha lucrativa");
    if (d?.leads && d.leads > 20) lines.push("📈 Crescimento expressivo de leads vs período anterior");
    if (d?.cpl && d.cpl < -10) lines.push("📉 CPL caindo — campanha está se otimizando");
    lines.push("");
    lines.push("_gerado pelo Meu Gestor_");
    return lines.join("\n");
}

function dline(delta?: number | null, inverse = false): string {
    if (delta === undefined || delta === null || !isFinite(delta)) return "";
    const fd = formatDelta(delta);
    const isGood = inverse ? !fd.positive : fd.positive;
    return `(${isGood ? "🟢" : "🔴"} ${fd.text} vs período anterior)`;
}

