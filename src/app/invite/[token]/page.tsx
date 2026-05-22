"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, BarChart3, CircleCheck, AlertCircle } from "lucide-react";
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
    const supabase = createClient();

    const [info, setInfo] = useState<InviteInfo | null>(null);
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(true);

    const [mode, setMode] = useState<"login" | "signup">("signup");
    const [email, setEmail] = useState("");
    const [pwd, setPwd] = useState("");
    const [busy, setBusy] = useState(false);
    const [authed, setAuthed] = useState(false);

    useEffect(() => {
        fetch(`/api/invite/${token}`).then(async r => {
            const j = await r.json();
            if (!r.ok) { setErr(j.error); setLoading(false); return; }
            setInfo(j);
            setEmail(j.email);
            // já logado?
            const { data: { user } } = await supabase.auth.getUser();
            if (user && user.email?.toLowerCase() === j.email.toLowerCase()) {
                setAuthed(true);
                await accept();
            }
            setLoading(false);
        });
        /* eslint-disable-next-line */
    }, [token]);

    const signUp = async () => {
        if (!pwd) { toast.error("Crie uma senha"); return; }
        setBusy(true);
        const { error } = await supabase.auth.signUp({
            email, password: pwd,
            options: { emailRedirectTo: `${location.origin}/auth/callback?invite=${token}` },
        });
        setBusy(false);
        if (error) { toast.error(error.message); return; }
        toast.success("Conta criada — verifique seu email (ou clique 'já tenho conta' se já confirmou).");
    };

    const login = async () => {
        if (!pwd) { toast.error("Digite a senha"); return; }
        setBusy(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
        if (error) { toast.error(error.message); setBusy(false); return; }
        await accept();
        setBusy(false);
    };

    const accept = async () => {
        const r = await fetch(`/api/invite/${token}`, { method: "POST" });
        const j = await r.json();
        if (!r.ok) { toast.error(j.error); return; }
        toast.success("Convite aceito!");
        router.push(j.redirect || "/portal");
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin muted" /></div>;
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
                <div className="flex items-center gap-3 mb-5">
                    {info.org_logo_url
                        ? <img src={info.org_logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        : <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: color }}><BarChart3 className="w-5 h-5 text-white" /></div>}
                    <div>
                        <p className="text-xs muted">Você foi convidado por</p>
                        <h1 className="font-bold">{info.org_name}</h1>
                    </div>
                </div>

                <p className="text-sm mb-5">
                    Olá <strong>{info.client_name}</strong>! Crie sua conta pra acompanhar suas campanhas Meta no portal da agência.
                </p>

                {authed ? (
                    <div className="text-center">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> <p className="text-sm muted">Entrando no portal...</p>
                    </div>
                ) : (
                    <>
                        <div className="flex gap-1 mb-4">
                            <button onClick={() => setMode("signup")} className={`btn-secondary flex-1 justify-center ${mode === "signup" ? "" : "opacity-60"}`}>Criar conta</button>
                            <button onClick={() => setMode("login")} className={`btn-secondary flex-1 justify-center ${mode === "login" ? "" : "opacity-60"}`}>Já tenho</button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="label">Email</label>
                                <input className="input" value={email} readOnly />
                            </div>
                            <div>
                                <label className="label">{mode === "signup" ? "Crie uma senha" : "Sua senha"}</label>
                                <input type="password" className="input" value={pwd} onChange={e => setPwd(e.target.value)} />
                            </div>
                            <button onClick={mode === "signup" ? signUp : login} disabled={busy} className="btn-primary w-full justify-center" style={{ padding: "0.7rem" }}>
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CircleCheck className="w-4 h-4" />}
                                {mode === "signup" ? "Criar conta e entrar" : "Entrar e aceitar"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
