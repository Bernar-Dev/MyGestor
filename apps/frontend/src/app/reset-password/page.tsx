"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BarChart3, Loader2, AlertCircle, CircleCheck } from "lucide-react";
import { toast } from "sonner";

export default function ResetPasswordPage() {
    const router = useRouter();
    const [pwd, setPwd] = useState("");
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pwd.length < 6) { setErr("Senha deve ter pelo menos 6 caracteres"); return; }
        if (pwd !== confirm) { setErr("As senhas não coincidem"); return; }
        setBusy(true); setErr("");
        const { error } = await createClient().auth.updateUser({ password: pwd });
        setBusy(false);
        if (error) { setErr(error.message); return; }
        toast.success("Senha atualizada!");
        router.push("/dashboard");
    };

    return (
        <main className="min-h-screen flex items-center justify-center px-4">
            <div className="glass w-full max-w-md p-7">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4c6ef5 0%, #7c3aed 50%, #f472b6 100%)" }}>
                        <BarChart3 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold">Nova senha</h1>
                        <p className="text-xs muted">Escolha uma senha segura</p>
                    </div>
                </div>

                <form onSubmit={submit} className="space-y-3">
                    <div>
                        <label className="label">Nova senha</label>
                        <input
                            type="password"
                            className="input"
                            value={pwd}
                            onChange={e => setPwd(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            autoFocus
                            autoComplete="new-password"
                        />
                    </div>
                    <div>
                        <label className="label">Confirmar senha</label>
                        <input
                            type="password"
                            className="input"
                            value={confirm}
                            onChange={e => setConfirm(e.target.value)}
                            placeholder="Repita a senha"
                            autoComplete="new-password"
                        />
                    </div>

                    {err && (
                        <div className="flex items-start gap-2 text-sm" style={{ color: "#fca5a5" }}>
                            <AlertCircle className="w-4 h-4 mt-0.5" />
                            <span>{err}</span>
                        </div>
                    )}

                    <button type="submit" disabled={busy} className="btn-primary w-full justify-center" style={{ padding: "0.7rem" }}>
                        {busy
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                            : <><CircleCheck className="w-4 h-4" /> Salvar nova senha</>
                        }
                    </button>
                </form>
            </div>
        </main>
    );
}
