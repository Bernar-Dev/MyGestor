"use client";
import { useEffect, useState } from "react";
import { Loader2, ExternalLink, Copy, Check, Link2, Instagram, Facebook, Eye, Share2, AlertCircle, Layers, Hash } from "lucide-react";

interface ActiveAd {
    ad_id: string;
    ad_name: string;
    effective_status: string;
    campaign_id?: string;
    campaign_name?: string;
    adset_id?: string;
    adset_name?: string;
    thumbnail_url?: string;
    instagram_permalink_url?: string;
    facebook_permalink_url?: string;
    preview_shareable_link?: string;
}

interface Props {
    accountId: string;
    /** Se informado, filtra anúncios desta campanha */
    campaignId?: string;
    /** Se informado, filtra anúncios deste adset (dentro de uma campanha) */
    adsetId?: string;
}

export default function ActiveAdsList({ accountId, campaignId, adsetId }: Props) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [ads, setAds] = useState<ActiveAd[] | null>(null);
    const [err, setErr] = useState<string>("");
    const [copied, setCopied] = useState<string | null>(null);

    const load = async () => {
        setLoading(true); setErr("");
        try {
            // Endpoint baseado no contexto (adset tem precedência sobre campanha)
            const endpoint = adsetId
                ? `/api/meugestor/adsets/${adsetId}/active-ads`
                : campaignId
                    ? `/api/meugestor/campaigns/${campaignId}/active-ads`
                    : `/api/meugestor/accounts/${accountId}/active-ads`;
            const res = await fetch(endpoint);
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Falha");
            setAds(json.data);
        } catch (e: any) {
            setErr(e.message || "Erro");
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        if (open && ads === null && !loading) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const copy = async (text: string, key: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(key);
            setTimeout(() => setCopied(null), 1500);
        } catch { }
    };

    /**
     * Copia todos os links organizados por campanha → conjunto → vídeos
     * Quando está na visão de conta (sem filtro de campanha).
     * Quando está dentro de uma campanha, agrupa por conjunto.
     */
    const copyAll = async () => {
        if (!ads) return;
        let lines: string;

        if (!campaignId) {
            // Visão da conta: agrupar por campanha → conjunto → anúncios
            const byCampaign = new Map<string, { name: string; adsets: Map<string, { name: string; ads: ActiveAd[] }> }>();
            for (const a of ads) {
                const cid = a.campaign_id || "sem_campanha";
                const cname = a.campaign_name || "Sem campanha";
                if (!byCampaign.has(cid)) byCampaign.set(cid, { name: cname, adsets: new Map() });
                const camp = byCampaign.get(cid)!;
                const asid = a.adset_id || "sem_conjunto";
                const asname = a.adset_name || "Sem conjunto";
                if (!camp.adsets.has(asid)) camp.adsets.set(asid, { name: asname, ads: [] });
                camp.adsets.get(asid)!.ads.push(a);
            }
            const parts: string[] = [];
            for (const [, camp] of byCampaign) {
                parts.push(`📣 CAMPANHA: ${camp.name}`);
                for (const [, adset] of camp.adsets) {
                    parts.push(`  📦 Conjunto: ${adset.name}`);
                    for (const a of adset.ads) {
                        const link = a.instagram_permalink_url || a.facebook_permalink_url || a.preview_shareable_link;
                        parts.push(link ? `    🎬 ${a.ad_name}\n    ${link}` : `    🎬 ${a.ad_name}`);
                    }
                }
            }
            lines = parts.join("\n");
        } else if (!adsetId) {
            // Visão de campanha: agrupar por conjunto → anúncios
            const byAdset = new Map<string, { name: string; ads: ActiveAd[] }>();
            for (const a of ads) {
                const asid = a.adset_id || "sem_conjunto";
                const asname = a.adset_name || "Sem conjunto";
                if (!byAdset.has(asid)) byAdset.set(asid, { name: asname, ads: [] });
                byAdset.get(asid)!.ads.push(a);
            }
            const parts: string[] = [];
            for (const [, adset] of byAdset) {
                parts.push(`📦 Conjunto: ${adset.name}`);
                for (const a of adset.ads) {
                    const link = a.instagram_permalink_url || a.facebook_permalink_url || a.preview_shareable_link;
                    parts.push(link ? `  🎬 ${a.ad_name}\n  ${link}` : `  🎬 ${a.ad_name}`);
                }
            }
            lines = parts.join("\n");
        } else {
            // Visão de adset: lista simples de anúncios
            lines = ads.map(a => {
                const link = a.instagram_permalink_url || a.facebook_permalink_url || a.preview_shareable_link;
                return link ? `🎬 ${a.ad_name}\n${link}` : `🎬 ${a.ad_name}`;
            }).join("\n\n");
        }

        await copy(lines, "all");
    };

    // Agrupamento para renderização
    const grouped = (() => {
        if (!ads) return null;
        if (!campaignId) {
            // Conta: agrupar por campanha → conjunto → anúncios
            const byCampaign = new Map<string, { name: string; adsets: Map<string, { name: string; ads: ActiveAd[] }> }>();
            for (const a of ads) {
                const cid = a.campaign_id || "sem_campanha";
                const cname = a.campaign_name || "Sem campanha";
                if (!byCampaign.has(cid)) byCampaign.set(cid, { name: cname, adsets: new Map() });
                const camp = byCampaign.get(cid)!;
                const asid = a.adset_id || "sem_conjunto";
                const asname = a.adset_name || "Sem conjunto";
                if (!camp.adsets.has(asid)) camp.adsets.set(asid, { name: asname, ads: [] });
                camp.adsets.get(asid)!.ads.push(a);
            }
            return { mode: "account" as const, byCampaign };
        } else if (!adsetId) {
            // Campanha: agrupar por conjunto → anúncios
            const byAdset = new Map<string, { name: string; ads: ActiveAd[] }>();
            for (const a of ads) {
                const asid = a.adset_id || "sem_conjunto";
                const asname = a.adset_name || "Sem conjunto";
                if (!byAdset.has(asid)) byAdset.set(asid, { name: asname, ads: [] });
                byAdset.get(asid)!.ads.push(a);
            }
            return { mode: "campaign" as const, byAdset };
        } else {
            // Adset: lista plana
            return { mode: "adset" as const, ads };
        }
    })();

    return (
        <div className="g-glass" style={{ overflow: "hidden" }}>
            <button onClick={() => setOpen(!open)}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1rem", background: "transparent", border: "none", color: "white", cursor: "pointer", textAlign: "left" }}>
                <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "white", display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Share2 style={{ width: 14, height: 14, color: "#34d399" }} />
                    {campaignId ? (adsetId ? "Criativos ativos neste conjunto" : "Criativos ativos nesta campanha") : "Anúncios ativos"}
                    {ads ? ` (${ads.length})` : ""}
                </h4>
                <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.5)" }}>
                    {open ? "Ocultar" : "Mostrar links compartilháveis"}
                </span>
            </button>

            {open && (
                <div style={{ borderTop: "1px solid var(--glass-border)" }}>
                    {loading && (
                        <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
                            <Loader2 className="g-pulse" style={{ width: 24, height: 24, color: "rgba(255,255,255,0.4)" }} />
                        </div>
                    )}
                    {err && !loading && (
                        <div style={{ padding: "1rem", color: "#fca5a5", fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <AlertCircle style={{ width: 14, height: 14 }} /> {err}
                            <button onClick={load} style={{ marginLeft: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "0.25rem 0.6rem", color: "white", fontSize: "0.7rem", cursor: "pointer" }}>Tentar de novo</button>
                        </div>
                    )}
                    {!loading && !err && ads && ads.length === 0 && (
                        <div style={{ padding: "1.2rem", textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: "0.78rem" }}>
                            Nenhum anúncio ativo{campaignId ? " nesta campanha" : " nesta conta"} no momento.
                        </div>
                    )}
                    {!loading && !err && ads && ads.length > 0 && grouped && (
                        <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.55rem 1rem", borderBottom: "1px solid var(--glass-border)", background: "rgba(255,255,255,0.02)" }}>
                                <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)" }}>
                                    {ads.length} anúncio{ads.length > 1 ? "s" : ""} em veiculação
                                </span>
                                <button onClick={copyAll}
                                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0.35rem 0.7rem", borderRadius: 6, fontSize: "0.72rem", color: copied === "all" ? "#34d399" : "white", background: "rgba(52,211,153,0.1)", border: `1px solid ${copied === "all" ? "#34d39988" : "rgba(52,211,153,0.3)"}`, cursor: "pointer" }}>
                                    {copied === "all" ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
                                    {copied === "all" ? "Copiado!" : "Copiar todos os links"}
                                </button>
                            </div>
                            <div style={{ maxHeight: 600, overflowY: "auto" }}>
                                {grouped.mode === "account" && (
                                    Array.from(grouped.byCampaign.entries()).map(([cid, camp]) => (
                                        <div key={cid}>
                                            {/* Título da campanha */}
                                            <div style={{ padding: "0.55rem 1rem", background: "rgba(76,110,245,0.08)", borderBottom: "1px solid var(--glass-border)", display: "flex", alignItems: "center", gap: 7 }}>
                                                <Layers style={{ width: 13, height: 13, color: "#748ffc", flexShrink: 0 }} />
                                                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#748ffc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{camp.name}</span>
                                            </div>
                                            {Array.from(camp.adsets.entries()).map(([asid, adset]) => (
                                                <div key={asid}>
                                                    {/* Título do conjunto */}
                                                    <div style={{ padding: "0.45rem 1rem 0.45rem 2rem", background: "rgba(52,211,153,0.05)", borderBottom: "1px solid var(--glass-border)", display: "flex", alignItems: "center", gap: 7 }}>
                                                        <Hash style={{ width: 11, height: 11, color: "#34d399", flexShrink: 0 }} />
                                                        <span style={{ fontSize: "0.67rem", fontWeight: 600, color: "#34d399", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{adset.name}</span>
                                                    </div>
                                                    {adset.ads.map(a => (
                                                        <AdRow key={a.ad_id} a={a} indent copy={copy} copied={copied} />
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    ))
                                )}
                                {grouped.mode === "campaign" && (
                                    Array.from(grouped.byAdset.entries()).map(([asid, adset]) => (
                                        <div key={asid}>
                                            {/* Título do conjunto */}
                                            <div style={{ padding: "0.5rem 1rem", background: "rgba(52,211,153,0.06)", borderBottom: "1px solid var(--glass-border)", display: "flex", alignItems: "center", gap: 7 }}>
                                                <Hash style={{ width: 12, height: 12, color: "#34d399", flexShrink: 0 }} />
                                                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#34d399", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{adset.name}</span>
                                            </div>
                                            {adset.ads.map(a => (
                                                <AdRow key={a.ad_id} a={a} copy={copy} copied={copied} />
                                            ))}
                                        </div>
                                    ))
                                )}
                                {grouped.mode === "adset" && (
                                    grouped.ads.map(a => (
                                        <AdRow key={a.ad_id} a={a} copy={copy} copied={copied} />
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function AdRow({ a, copy, copied, indent = false }: {
    a: ActiveAd;
    copy: (text: string, key: string) => void;
    copied: string | null;
    indent?: boolean;
}) {
    const igLink = a.instagram_permalink_url;
    const fbLink = a.facebook_permalink_url;
    const preview = a.preview_shareable_link;
    const primary = igLink || fbLink || preview;

    return (
        <div style={{ display: "flex", gap: "0.7rem", padding: `0.7rem 1rem 0.7rem ${indent ? "2.5rem" : "1rem"}`, borderBottom: "1px solid var(--glass-border)", alignItems: "flex-start" }}>
            {a.thumbnail_url ? (
                <img src={a.thumbnail_url} alt="" style={{ width: 48, height: 48, borderRadius: 6, objectFit: "cover", flexShrink: 0, background: "rgba(255,255,255,0.05)" }} />
            ) : (
                <div style={{ width: 48, height: 48, borderRadius: 6, background: "rgba(255,255,255,0.05)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Eye style={{ width: 16, height: 16, color: "rgba(255,255,255,0.3)" }} />
                </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.ad_name}</p>
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    {igLink && (
                        <LinkChip href={igLink} icon={Instagram} label="Instagram" color="#e1306c"
                            onCopy={() => copy(igLink, `${a.ad_id}-ig`)} copied={copied === `${a.ad_id}-ig`} />
                    )}
                    {fbLink && (
                        <LinkChip href={fbLink} icon={Facebook} label="Facebook" color="#4267B2"
                            onCopy={() => copy(fbLink, `${a.ad_id}-fb`)} copied={copied === `${a.ad_id}-fb`} />
                    )}
                    {preview && !igLink && !fbLink && (
                        <LinkChip href={preview} icon={Link2} label="Preview" color="#748ffc"
                            onCopy={() => copy(preview, `${a.ad_id}-pv`)} copied={copied === `${a.ad_id}-pv`} />
                    )}
                    {!primary && (
                        <span style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>Sem link público</span>
                    )}
                </div>
            </div>
        </div>
    );
}

function LinkChip({ href, icon: Icon, label, color, onCopy, copied }: { href: string; icon: any; label: string; color: string; onCopy: () => void; copied: boolean }) {
    return (
        <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 6, border: `1px solid ${color}44`, background: `${color}10`, overflow: "hidden" }}>
            <a href={href} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "0.22rem 0.5rem", fontSize: "0.65rem", color, textDecoration: "none" }}>
                <Icon style={{ width: 11, height: 11 }} />
                {label}
                <ExternalLink style={{ width: 9, height: 9, opacity: 0.7 }} />
            </a>
            <button onClick={onCopy} title="Copiar link"
                style={{ padding: "0.22rem 0.4rem", background: "transparent", border: "none", borderLeft: `1px solid ${color}44`, color: copied ? "#34d399" : color, cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
                {copied ? <Check style={{ width: 10, height: 10 }} /> : <Copy style={{ width: 10, height: 10 }} />}
            </button>
        </span>
    );
}

