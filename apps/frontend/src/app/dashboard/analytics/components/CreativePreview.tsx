"use client";
import { useState, useEffect } from "react";
import { ExternalLink, Loader2, Image as ImageIcon } from "lucide-react";

interface Creative {
    id?: string;
    thumbnail_url?: string;
    image_url?: string;
    body?: string;
    title?: string;
    call_to_action_type?: string;
    instagram_permalink_url?: string;
    video_id?: string;
}
interface AdInfo {
    ad_id: string;
    ad_name: string;
    status: string;
    effective_status: string;
    creative?: Creative;
}

export default function CreativePreview({ adId }: { adId: string }) {
    const [data, setData] = useState<AdInfo | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!adId) return;
        setLoading(true);
        fetch(`/api/meugestor/ads/${adId}`).then(r => r.json())
            .then(j => { if (j.success) setData(j.data); })
            .finally(() => setLoading(false));
    }, [adId]);

    if (loading) {
        return (
            <div className="g-glass" style={{ padding: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Loader2 style={{ width: 16, height: 16 }} className="g-pulse" />
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>Carregando criativo...</span>
            </div>
        );
    }
    if (!data) return null;
    const c = data.creative;
    const thumb = c?.image_url || c?.thumbnail_url;
    return (
        <div className="g-glass" style={{ padding: "1rem", display: "flex", gap: "0.85rem" }}>
            <div style={{
                width: 110, height: 110, borderRadius: "0.65rem", overflow: "hidden",
                background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
            }}>
                {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt={data.ad_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                    <ImageIcon style={{ width: 24, height: 24, color: "rgba(255,255,255,0.2)" }} />
                )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: "white", fontWeight: 600, fontSize: "0.85rem", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.ad_name}</p>
                <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
                    <span className={`g-badge ${data.effective_status === "ACTIVE" ? "g-badge-success" : data.effective_status === "PAUSED" ? "g-badge-warning" : "g-badge-danger"}`} style={{ fontSize: "0.6rem" }}>
                        {data.effective_status}
                    </span>
                    {c?.call_to_action_type && (
                        <span className="g-badge g-badge-info" style={{ fontSize: "0.6rem" }}>{c.call_to_action_type}</span>
                    )}
                    {c?.video_id && <span className="g-badge g-badge-purple" style={{ fontSize: "0.6rem" }}>VÍDEO</span>}
                </div>
                {c?.title && <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.78rem", fontWeight: 600, marginBottom: 2 }}>{c.title}</p>}
                {c?.body && <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.72rem", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.body}</p>}
                {c?.instagram_permalink_url && (
                    <a href={c.instagram_permalink_url} target="_blank" rel="noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.7rem", color: "#748ffc", marginTop: 6 }}>
                        Ver no Instagram <ExternalLink style={{ width: 11, height: 11 }} />
                    </a>
                )}
            </div>
        </div>
    );
}

