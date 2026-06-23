"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api-client";
import { Loader2, BarChart3, AlertCircle, Mail, CircleCheck } from "lucide-react";
import { toast } from "sonner";

interface InviteInfo {
    email: string;
    client_name: string;
    org_name: string;
    org_logo_url: string | null;
    org_primary_color: string | null;
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const router = useRouter();

    const [info, setInfo] = useState<InviteInfo | null>(null);
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);

    const accept = async () => {
        try {
            const j = await apiFetch<{ redirect: string }>(`/invite/${token}`, { method: "POST" });
            router.push(j.redirect || "/portal");
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    useEffect(() => {
        (async () => {
            try {
                const j = await apiFetch<InviteInfo>(`/invite/${token}`);
                setInfo(j);

                // Se já está logado com o email certo, aceita direto
                const { data: { user } } = await createClient().auth.getUser();
                if (user && user.email?.toLowerCase() === j.email.toLowerCase()) {
                    await accept();
                    return;
                }
            } catch (e: any) {
                setErr(e.message || "Convite inválido ou expirado");
            } finally {
                setLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const sendMagicLink = async () => {
        if (!info) return;
        setBusy(true);
        const { error } = await createClient().auth.signInWithOtp({
            email: info.email,
            options: {
                shouldCreateUser: true,
                emailRedirectTo: `${location.origin}/auth/callback?invite=${token}`,
            },
        });
        setBusy(false);
        if (error) { toast.error(error.message); return; }
        setSent(true);
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin muted" />
        </div>
    );

    if (err) return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="glass p-6 max-w-md text-center">
                <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: "#fca5a5" }} />
                <p className="muted">{err}</p>
            </div>
        </div>
    );

    if (!info) return null;

    const color = info.org_primary_color || "#7c3aed";

    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <div className="glass max-w-md w-full p-7">
                {/* Header */}
                <div className="flex items-center gap-3 mb-5">
                    {info.org_logo_url
                        ? <img src={info.org_logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        : <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: color }}>
                            <BarChart3 className="w-5 h-5 text-white" />
                          </div>}
                    <div>
                        <p className="text-xs muted">Você foi convidado por</p>
                        <h1 className="font-bold">{info.org_name}</h1>
                    </div>
                </div>

                <p className="text-sm mb-6">
                    Olá <strong>{info.client_name}</strong>! Acesse o portal para acompanhar suas campanhas Meta em tempo real.
                </p>

                {sent ? (
                    /* ── Link enviado ── */
                    <div className="text-center space-y-3">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)" }}>
                            <Mail className="w-7 h-7" style={{ color: "#34d399" }} />
                        </div>
                        <h2 className="font-bold">Verifique seu email</h2>
                        <p className="text-sm muted">
                            Enviamos um link de acesso para <strong>{info.email}</strong>.<br />
                            Clique no link do email para entrar no portal.
                        </p>
                        <p className="text-xs muted">Não chegou? Verifique o spam ou</p>
                        <button onClick={() => setSent(false)} className="text-xs underline muted">
                            tente novamente
                        </button>
                    </div>
                ) : (
                    /* ── Botão de acesso ── */
                    <div className="space-y-3">
                        <div className="p-3 rounded-lg text-sm" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <p className="text-xs muted mb-0.5">Acesso para</p>
                            <p className="font-mono font-semibold">{info.email}</p>
                        </div>
                        <button
                            onClick={sendMagicLink}
                            disabled={busy}
                            className="btn-primary w-full justify-center"
                            style={{ padding: "0.75rem", background: color, borderColor: color }}
                        >
                            {busy
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                                : <><CircleCheck className="w-4 h-4" /> Receber link de acesso</>
                            }
                        </button>
                        <p className="text-xs muted text-center">
                            Vamos enviar um link para o seu email. Sem necessidade de senha.
                        </p>
                    </div>
                )}
            </div>
        </main>
    );
}
