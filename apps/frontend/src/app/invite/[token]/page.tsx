"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api-client";
import { Loader2, BarChart3, AlertCircle, CircleCheck, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface InviteInfo {
    email: string;
    client_name: string;
    org_name: string;
    org_logo_url: string | null;
    org_primary_color: string | null;
    user_exists: boolean;
    user_is_gestor: boolean;
}

type Mode = "signup" | "login";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const router = useRouter();

    const [info, setInfo] = useState<InviteInfo | null>(null);
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState<Mode>("signup");
    const [pwd, setPwd] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        apiFetch<InviteInfo>(`/invite/${token}`)
            .then(j => {
                setInfo(j);
                if (!j.user_is_gestor) setMode(j.user_exists ? "login" : "signup");
            })
            .catch((e: any) => setErr(e.message || "Convite inválido ou expirado"))
            .finally(() => setLoading(false));
    }, [token]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pwd || pwd.length < 6) { toast.error("Senha deve ter pelo menos 6 caracteres"); return; }
        setBusy(true);
        try {
            if (mode === "signup") {
                // Cria conta já confirmada via backend
                await apiFetch(`/invite/${token}/signup`, { method: "POST", body: { password: pwd } });

                // Login imediato
                const { error } = await createClient().auth.signInWithPassword({
                    email: info!.email,
                    password: pwd,
                });
                if (error) throw new Error(error.message);
            } else {
                // Login com conta existente
                const { error } = await createClient().auth.signInWithPassword({
                    email: info!.email,
                    password: pwd,
                });
                if (error) throw new Error("Senha incorreta. Tente novamente.");

                // Aceita o convite com a sessão criada
                await apiFetch(`/invite/${token}`, { method: "POST" });
            }

            toast.success("Bem-vindo ao portal!");
            router.push("/portal");
        } catch (e: any) {
            toast.error(e.message || "Erro ao entrar");
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

    if (info.user_is_gestor) return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <div className="glass max-w-md w-full p-7 text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)" }}>
                    <AlertCircle className="w-6 h-6" style={{ color: "#fbbf24" }} />
                </div>
                <h2 className="font-bold mb-2">Convite não disponível</h2>
                <p className="text-sm muted">
                    O email <strong>{info.email}</strong> já está associado a uma conta de gestor no {info.org_name}.
                    Contas de gestor não podem aceitar convites de cliente.
                </p>
                <p className="text-xs muted mt-3">
                    Para acessar o portal, use um email diferente ou entre em contato com seu gestor.
                </p>
            </div>
        </main>
    );

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

                {/* Modo banner */}
                <div className="rounded-lg p-3 mb-5 text-sm" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    {mode === "signup" ? (
                        <>
                            <p><strong>{info.client_name}</strong>, crie uma senha para acessar o portal e acompanhar suas campanhas.</p>
                        </>
                    ) : (
                        <>
                            <p>Encontramos uma conta cadastrada com <strong>{info.email}</strong>. Entre com sua senha para aceitar o convite.</p>
                        </>
                    )}
                </div>

                <form onSubmit={submit} className="space-y-3">
                    <div>
                        <label className="label">Email</label>
                        <input className="input" value={info.email} readOnly style={{ opacity: 0.6 }} />
                    </div>
                    <div>
                        <label className="label">{mode === "signup" ? "Crie uma senha" : "Sua senha"}</label>
                        <input
                            type="password"
                            className="input"
                            value={pwd}
                            onChange={e => setPwd(e.target.value)}
                            placeholder={mode === "signup" ? "Mínimo 6 caracteres" : "Digite sua senha"}
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
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Aguarde...</>
                            : mode === "signup"
                                ? <><UserPlus className="w-4 h-4" /> Criar conta e entrar</>
                                : <><LogIn className="w-4 h-4" /> Entrar no portal</>
                        }
                    </button>
                </form>

                {/* Alternar modo */}
                <p className="text-center text-xs muted mt-4">
                    {mode === "signup" ? (
                        <>Já tem uma conta?{" "}
                            <button className="underline" onClick={() => { setMode("login"); setPwd(""); }}>
                                Entrar com conta existente
                            </button>
                        </>
                    ) : (
                        <>Não tem conta?{" "}
                            <button className="underline" onClick={() => { setMode("signup"); setPwd(""); }}>
                                Criar nova conta
                            </button>
                        </>
                    )}
                </p>

                {/* Modo atual indicado visualmente */}
                <div className="flex gap-2 mt-4 justify-center">
                    <button
                        onClick={() => { setMode("signup"); setPwd(""); }}
                        className="text-xs px-3 py-1 rounded-full transition-all"
                        style={{
                            background: mode === "signup" ? color : "transparent",
                            color: mode === "signup" ? "#fff" : undefined,
                            border: `1px solid ${mode === "signup" ? color : "rgba(255,255,255,0.15)"}`,
                            opacity: mode === "signup" ? 1 : 0.5,
                        }}
                    >
                        Nova conta
                    </button>
                    <button
                        onClick={() => { setMode("login"); setPwd(""); }}
                        className="text-xs px-3 py-1 rounded-full transition-all"
                        style={{
                            background: mode === "login" ? color : "transparent",
                            color: mode === "login" ? "#fff" : undefined,
                            border: `1px solid ${mode === "login" ? color : "rgba(255,255,255,0.15)"}`,
                            opacity: mode === "login" ? 1 : 0.5,
                        }}
                    >
                        Já tenho conta
                    </button>
                </div>
            </div>
        </main>
    );
}
