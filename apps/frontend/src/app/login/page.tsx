"use client";
import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BarChart3, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

function LoginContent() {
    const params = useSearchParams();
    const next = params.get("next") || "/dashboard";
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [pwd, setPwd] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [forgotMode, setForgotMode] = useState(false);
    const [resetSent, setResetSent] = useState(false);

    const sendReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) { setErr("Digite seu email"); return; }
        setBusy(true); setErr("");
        const { error } = await createClient().auth.resetPasswordForEmail(email, {
            redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
        });
        setBusy(false);
        if (error) { setErr(error.message); return; }
        setResetSent(true);
    };

    const signInGoogle = async () => {
        setBusy(true); setErr("");
        const { error } = await createClient().auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
            },
        });
        if (error) { setErr(error.message); setBusy(false); }
    };

    const signInFacebook = async () => {
        setBusy(true); setErr("");
        const { error } = await createClient().auth.signInWithOAuth({
            provider: "facebook",
            options: {
                redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
                scopes: "public_profile,email",
            },
        });
        if (error) { setErr(error.message); setBusy(false); }
    };

    const signInEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true); setErr("");
        const { error } = await createClient().auth.signInWithPassword({ email, password: pwd });
        if (error) { setErr(error.message); setBusy(false); return; }
        toast.success("Login OK");
        router.push(next);
    };

    const signUp = async () => {
        if (!email || !pwd) { setErr("Preencha email e senha"); return; }
        setBusy(true); setErr("");
        const { error } = await createClient().auth.signUp({
            email, password: pwd,
            options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
        });
        setBusy(false);
        if (error) { setErr(error.message); return; }
        toast.success("Conta criada! Verifique seu email.");
    };

    return (
        <main className="min-h-screen flex items-center justify-center px-4">
            <div className="glass w-full max-w-md p-7">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4c6ef5 0%, #7c3aed 50%, #f472b6 100%)" }}>
                        <BarChart3 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold">Newgestor</h1>
                        <p className="text-xs muted">Entrar na sua conta</p>
                        {/* v2 */}
                    </div>
                </div>

                <button onClick={signInGoogle} disabled={busy}
                    className="btn-secondary w-full justify-center mb-2" style={{ padding: "0.7rem" }}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
                    Continuar com Google
                </button>

                <button onClick={signInFacebook} disabled={busy}
                    className="w-full justify-center mb-3 flex items-center gap-2 rounded-lg font-medium text-sm transition-opacity"
                    style={{ padding: "0.7rem", background: "#1877f2", color: "#fff", opacity: busy ? 0.6 : 1, border: "none", cursor: busy ? "not-allowed" : "pointer" }}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FacebookIcon />}
                    Continuar com Facebook
                </button>

                <div className="flex items-center gap-2 my-4">
                    <div className="divider flex-1" />
                    <span className="text-xs muted">ou com email</span>
                    <div className="divider flex-1" />
                </div>

                {forgotMode ? (
                    resetSent ? (
                        <div className="text-center space-y-3 py-2">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)" }}>
                                <AlertCircle className="w-6 h-6" style={{ color: "#34d399" }} />
                            </div>
                            <p className="font-semibold text-sm">Verifique seu email</p>
                            <p className="text-xs muted">Enviamos um link para <strong>{email}</strong>. Clique nele para criar uma nova senha.</p>
                            <button onClick={() => { setForgotMode(false); setResetSent(false); }} className="text-xs underline muted">Voltar ao login</button>
                        </div>
                    ) : (
                        <form onSubmit={sendReset} className="space-y-3">
                            <p className="text-sm muted">Digite seu email e enviaremos um link para redefinir sua senha.</p>
                            <div>
                                <label className="label">Email</label>
                                <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required autoFocus autoComplete="email" />
                            </div>
                            {err && (
                                <div className="flex items-start gap-2 text-sm" style={{ color: "#fca5a5" }}>
                                    <AlertCircle className="w-4 h-4 mt-0.5" />
                                    <span>{err}</span>
                                </div>
                            )}
                            <button type="submit" disabled={busy} className="btn-primary w-full justify-center" style={{ padding: "0.7rem" }}>
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                Enviar link de redefinição
                            </button>
                            <button type="button" onClick={() => { setForgotMode(false); setErr(""); }} className="btn-secondary w-full justify-center text-sm">
                                Voltar
                            </button>
                        </form>
                    )
                ) : (
                    <form onSubmit={signInEmail} className="space-y-3">
                        <div>
                            <label className="label">Email</label>
                            <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="label" style={{ margin: 0 }}>Senha</label>
                                <button type="button" onClick={() => { setForgotMode(true); setErr(""); }} className="text-xs muted underline">
                                    Esqueci minha senha
                                </button>
                            </div>
                            <input type="password" className="input" value={pwd} onChange={e => setPwd(e.target.value)} autoComplete="current-password" />
                        </div>

                        {err && (
                            <div className="flex items-start gap-2 text-sm" style={{ color: "#fca5a5" }}>
                                <AlertCircle className="w-4 h-4 mt-0.5" />
                                <span>{err}</span>
                            </div>
                        )}

                        <button type="submit" disabled={busy} className="btn-primary w-full justify-center" style={{ padding: "0.7rem" }}>
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Entrar com senha
                        </button>
                        <button type="button" onClick={signUp} disabled={busy} className="btn-secondary w-full justify-center text-sm">
                            Criar conta nova
                        </button>
                    </form>
                )}
            </div>
        </main>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginContent />
        </Suspense>
    );
}

function GoogleIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.32z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z" />
        </svg>
    );
}

function FacebookIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
    );
}
