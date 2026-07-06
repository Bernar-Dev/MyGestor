"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BarChart3, Loader2, AlertCircle, CircleCheck } from "lucide-react";
import Link from "next/link";

export default function SignupPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [pwd, setPwd] = useState("");
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const [done, setDone] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pwd.length < 6) { setErr("Senha deve ter pelo menos 6 caracteres"); return; }
        if (pwd !== confirm) { setErr("As senhas não coincidem"); return; }
        setBusy(true); setErr("");
        const { error } = await createClient().auth.signUp({
            email,
            password: pwd,
            options: { emailRedirectTo: `${location.origin}/auth/callback?next=/dashboard` },
        });
        setBusy(false);
        if (error) { setErr(error.message); return; }
        setDone(true);
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
                        <p className="text-xs muted">Criar nova conta</p>
                    </div>
                </div>

                {done ? (
                    <div className="text-center space-y-4 py-4">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)" }}>
                            <CircleCheck className="w-7 h-7" style={{ color: "#34d399" }} />
                        </div>
                        <div>
                            <p className="font-semibold">Conta criada com sucesso!</p>
                            <p className="text-sm muted mt-1">Enviamos um link de confirmação para <strong>{email}</strong>. Clique nele para ativar sua conta.</p>
                        </div>
                        <Link href="/login" className="btn-secondary w-full justify-center text-sm" style={{ display: "inline-flex", marginTop: "0.5rem" }}>
                            Voltar ao login
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-3">
                        <div>
                            <label className="label">Email</label>
                            <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required autoFocus autoComplete="email" />
                        </div>
                        <div>
                            <label className="label">Senha</label>
                            <input type="password" className="input" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
                        </div>
                        <div>
                            <label className="label">Confirmar senha</label>
                            <input type="password" className="input" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repita a senha" autoComplete="new-password" />
                        </div>

                        {err && (
                            <div className="flex items-start gap-2 text-sm" style={{ color: "#fca5a5" }}>
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>{err}</span>
                            </div>
                        )}

                        <button type="submit" disabled={busy} className="btn-primary w-full justify-center" style={{ padding: "0.7rem" }}>
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Criar conta
                        </button>

                        <p className="text-center text-xs muted pt-1">
                            Já tem uma conta?{" "}
                            <Link href="/login" className="underline">Entrar</Link>
                        </p>
                    </form>
                )}
            </div>
        </main>
    );
}
