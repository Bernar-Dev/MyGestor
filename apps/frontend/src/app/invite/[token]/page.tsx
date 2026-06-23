"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api-client";
import { Loader2, BarChart3, AlertCircle, CircleCheck } from "lucide-react";
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
    const [pwd, setPwd] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        apiFetch<InviteInfo>(`/invite/${token}`)
            .then(j => setInfo(j))
            .catch((e: any) => setErr(e.message || "Convite inválido ou expirado"))
            .finally(() => setLoading(false));
    }, [token]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pwd || pwd.length < 6) { toast.error("Senha deve ter pelo menos 6 caracteres"); return; }
        setBusy(true);
        try {
            // Cria conta já confirmada via backend (sem pedir confirmação de email)
            await apiFetch(`/invite/${token}/signup`, { method: "POST", body: { password: pwd } });

            // Faz login imediatamente com a senha criada
            const { error } = await createClient().auth.signInWithPassword({
                email: info!.email,
                password: pwd,
            });
            if (error) throw new Error(error.message);

            toast.success("Bem-vindo ao portal!");
            router.push("/portal");
        } catch (e: any) {
            toast.error(e.message || "Erro ao criar conta");
        } finally {
            setBusy(false);
        }
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

                <p className="text-sm mb-5">
                    Olá <strong>{info.client_name}</strong>! Crie sua senha para acessar o portal e acompanhar suas campanhas.
                </p>

                <form onSubmit={submit} className="space-y-3">
                    <div>
                        <label className="label">Email</label>
                        <input className="input" value={info.email} readOnly style={{ opacity: 0.6 }} />
                    </div>
                    <div>
                        <label className="label">Crie uma senha</label>
                        <input
                            type="password"
                            className="input"
                            value={pwd}
                            onChange={e => setPwd(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            autoFocus
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={busy}
                        className="btn-primary w-full justify-center"
                        style={{ padding: "0.75rem", background: color, borderColor: color }}
                    >
                        {busy
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando conta...</>
                            : <><CircleCheck className="w-4 h-4" /> Criar conta e entrar</>
                        }
                    </button>
                </form>
            </div>
        </main>
    );
}
