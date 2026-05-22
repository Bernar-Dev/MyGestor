"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    BarChart3, ExternalLink, Copy, Check, Loader2, ChevronRight,
    CircleCheck, Circle, Sparkles, Building2,
} from "lucide-react";
import { toast } from "sonner";

const STEPS = [
    { id: 0, label: "Sua agência" },
    { id: 1, label: "Criar App no Meta" },
    { id: 2, label: "Pegar credenciais" },
    { id: 3, label: "Cadastrar aqui" },
    { id: 4, label: "Autorizar Facebook" },
];

function OnboardingContent() {
    const router = useRouter();
    const params = useSearchParams();
    const [step, setStep] = useState(0);
    const [orgName, setOrgName] = useState("");
    const [appId, setAppId] = useState("");
    const [appSecret, setAppSecret] = useState("");
    const [appName, setAppName] = useState("");
    const [busy, setBusy] = useState(false);
    const [redirectUri, setRedirectUri] = useState("");
    const [copiedRedirect, setCopiedRedirect] = useState(false);
    const [orgReady, setOrgReady] = useState(false);

    useEffect(() => {
        setRedirectUri(`${location.origin}/api/meta/callback`);
        // Já tem org?
        fetch("/api/org").then(r => r.json()).then(d => {
            if (d.org) {
                setOrgReady(true);
                setOrgName(d.org.name);
                // Tem credenciais?
                return fetch("/api/meta/credentials").then(r => r.json()).then(c => {
                    if (c.configured) {
                        setAppId(c.appId);
                        setAppName(c.appName || "");
                        setStep(4);
                    } else {
                        setStep(1);
                    }
                });
            }
            // sem org → começa do zero
            setStep(0);
        }).catch(() => { });

        const err = params.get("error");
        if (err) toast.error(decodeURIComponent(err));
    }, [params]);

    const createOrg = async () => {
        if (!orgName.trim()) { toast.error("Informe o nome da sua agência"); return; }
        setBusy(true);
        try {
            const r = await fetch("/api/org", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: orgName.trim() }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error);
            toast.success("Organização criada");
            setOrgReady(true);
            setStep(1);
        } catch (e: any) { toast.error(e.message); }
        finally { setBusy(false); }
    };

    const copyRedirect = async () => {
        await navigator.clipboard.writeText(redirectUri);
        setCopiedRedirect(true);
        setTimeout(() => setCopiedRedirect(false), 2000);
    };

    const saveCredentials = async () => {
        if (!appId || !appSecret) { toast.error("Preencha App ID e App Secret"); return; }
        setBusy(true);
        try {
            const res = await fetch("/api/meta/credentials", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ appId, appSecret, appName }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || "Falha");
            toast.success("Credenciais salvas");
            setStep(4);
        } catch (e: any) { toast.error(e.message); }
        finally { setBusy(false); }
    };

    const connectFacebook = () => { window.location.href = "/api/meta/connect"; };

    return (
        <main className="max-w-3xl mx-auto px-4 py-8 md:py-14">
            <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4c6ef5 0%, #7c3aed 50%, #f472b6 100%)" }}>
                    <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="font-bold text-lg">Setup da Newgestor</h1>
                    <p className="text-xs muted">Da criação da agência ao primeiro cliente em ~5 minutos.</p>
                </div>
            </div>

            <div className="flex items-center gap-2 mb-8 flex-wrap">
                {STEPS.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                            {step > s.id
                                ? <CircleCheck className="w-5 h-5" style={{ color: "#34d399" }} />
                                : step === s.id
                                    ? <Circle className="w-5 h-5" style={{ color: "#a78bfa" }} />
                                    : <Circle className="w-5 h-5" style={{ color: "rgba(255,255,255,0.2)" }} />}
                            <span className="text-xs" style={{ color: step >= s.id ? "white" : "rgba(255,255,255,0.4)" }}>{s.label}</span>
                        </div>
                        {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 muted hidden md:inline" />}
                    </div>
                ))}
            </div>

            {/* PASSO 0 — criar org */}
            {step === 0 && (
                <div className="glass p-6 md:p-8 space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Building2 className="w-5 h-5" style={{ color: "#a78bfa" }} /> Passo 1 — Sua agência
                    </h2>
                    <p className="muted text-sm">
                        Crie o registro da sua agência (ou seu nome se for gestor solo). Você poderá adicionar clientes depois.
                    </p>
                    <div>
                        <label className="label">Nome da agência ou seu nome</label>
                        <input className="input" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Ex: Tráfego Premium" />
                    </div>
                    <button onClick={createOrg} disabled={busy || orgReady} className="btn-primary w-full justify-center" style={{ padding: "0.75rem" }}>
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {orgReady ? "Já criada — próximo passo →" : "Criar agência →"}
                    </button>
                </div>
            )}

            {/* PASSO 1 — guidança Meta */}
            {step === 1 && (
                <div className="glass p-6 md:p-8 space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Sparkles className="w-5 h-5" style={{ color: "#a78bfa" }} /> Passo 2 — Criar o Meta App
                    </h2>
                    <p className="muted text-sm">
                        Cada agência usa seu <strong>próprio</strong> Meta App. Assim seus tokens ficam isolados dos outros clientes da plataforma.
                    </p>
                    <ol className="space-y-3 text-sm">
                        <li><strong className="muted-strong">1.</strong> Abra o portal Meta Developers:
                            <a href="https://developers.facebook.com/apps/create/" target="_blank" rel="noopener" className="btn-secondary inline-flex ml-2 mt-1" style={{ padding: "0.35rem 0.7rem", fontSize: "0.78rem" }}>Criar App <ExternalLink className="w-3 h-3" /></a>
                        </li>
                        <li><strong className="muted-strong">2.</strong> Login com sua conta Facebook (a que tem acesso às contas de anúncio dos clientes).</li>
                        <li><strong className="muted-strong">3.</strong> Caso de uso: <strong>"Outros"</strong>. Tipo de App: <strong>"Empresa"</strong>.</li>
                        <li><strong className="muted-strong">4.</strong> Dê um nome qualquer (ex.: <em>"{orgName || "Meu Gestor"}"</em>), email, criar.</li>
                        <li><strong className="muted-strong">5.</strong> No menu lateral procure <strong>Marketing API</strong> → <strong>Adicionar</strong>.</li>
                        <li><strong className="muted-strong">6.</strong> Procure <strong>Login com Facebook</strong> → <strong>Adicionar</strong> → Web → cole sua URL.</li>
                    </ol>
                    <button onClick={() => setStep(2)} className="btn-primary w-full justify-center mt-4" style={{ padding: "0.75rem" }}>
                        Já criei o app, próximo →
                    </button>
                </div>
            )}

            {/* PASSO 2 — pegar credenciais */}
            {step === 2 && (
                <div className="glass p-6 md:p-8 space-y-4">
                    <h2 className="text-xl font-bold">Passo 3 — Pegar App ID e Secret</h2>
                    <p className="muted text-sm">
                        Dentro do app no developers.facebook.com, vá em <strong>Configurações → Básico</strong>.
                    </p>
                    <ol className="space-y-2 text-sm muted-strong">
                        <li><strong>•</strong> <strong>App ID</strong> está no topo (15-16 dígitos).</li>
                        <li><strong>•</strong> <strong>App Secret</strong> logo abaixo. Clique em <strong>"Mostrar"</strong> e digite sua senha do Facebook.</li>
                    </ol>
                    <div className="glass p-4" style={{ background: "rgba(251,191,36,0.05)", borderColor: "rgba(251,191,36,0.2)" }}>
                        <p className="text-xs muted-strong">⚠️ App Secret é como uma senha. Salvamos cifrado AES-256 e nunca exibimos depois.</p>
                    </div>

                    <div>
                        <label className="label">URL de Redirecionamento OAuth (copie e cole no Meta)</label>
                        <div className="flex gap-2">
                            <input className="input" value={redirectUri} readOnly />
                            <button onClick={copyRedirect} className="btn-secondary" style={{ padding: "0.55rem 0.75rem" }}>
                                {copiedRedirect ? <Check className="w-4 h-4" style={{ color: "#34d399" }} /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>
                        <p className="text-xs muted mt-2">
                            No Meta App: <strong>Login com Facebook → Configurações</strong> → cole em <strong>"URIs de redirecionamento OAuth válidos"</strong> → Salvar.
                        </p>
                    </div>

                    <div className="flex gap-2 mt-4">
                        <button onClick={() => setStep(1)} className="btn-secondary">← Voltar</button>
                        <button onClick={() => setStep(3)} className="btn-primary flex-1 justify-center">Próximo →</button>
                    </div>
                </div>
            )}

            {/* PASSO 3 — colar credenciais */}
            {step === 3 && (
                <div className="glass p-6 md:p-8 space-y-4">
                    <h2 className="text-xl font-bold">Passo 4 — Colar credenciais</h2>
                    <p className="muted text-sm">Salvamos cifrado e nunca exibimos depois.</p>

                    <div>
                        <label className="label">Nome do App <span className="muted text-xs">(só pra você lembrar)</span></label>
                        <input className="input" value={appName} onChange={e => setAppName(e.target.value)} placeholder={orgName || "Meu Gestor"} />
                    </div>
                    <div>
                        <label className="label">App ID</label>
                        <input className="input" value={appId} onChange={e => setAppId(e.target.value.trim())} placeholder="123456789012345" inputMode="numeric" />
                    </div>
                    <div>
                        <label className="label">App Secret</label>
                        <input className="input" type="password" value={appSecret} onChange={e => setAppSecret(e.target.value.trim())} placeholder="abcdef1234567890..." />
                    </div>

                    <div className="flex gap-2 mt-4">
                        <button onClick={() => setStep(2)} className="btn-secondary" disabled={busy}>← Voltar</button>
                        <button onClick={saveCredentials} disabled={busy || !appId || !appSecret} className="btn-primary flex-1 justify-center">
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Salvar e prosseguir →
                        </button>
                    </div>
                </div>
            )}

            {/* PASSO 4 — autorizar FB */}
            {step === 4 && (
                <div className="glass p-6 md:p-8 space-y-4">
                    <h2 className="text-xl font-bold">Passo 5 — Autorizar Facebook</h2>
                    <p className="muted text-sm">
                        Clique abaixo. Você será redirecionado pra autorizar permissões (ads_read, ads_management, business_management, read_insights).
                        Depois volta automático.
                    </p>

                    <div className="glass p-4 space-y-2" style={{ background: "rgba(52,211,153,0.05)", borderColor: "rgba(52,211,153,0.2)" }}>
                        <p className="text-xs muted-strong">App configurado: <strong>{appName || appId}</strong></p>
                        <p className="text-xs muted">App ID: {appId}</p>
                    </div>

                    <button onClick={connectFacebook} className="btn-primary w-full justify-center" style={{ padding: "0.85rem", fontSize: "0.95rem" }}>
                        <FacebookIcon /> Conectar com Facebook
                    </button>

                    <button onClick={() => setStep(3)} className="btn-secondary w-full justify-center text-sm">
                        ← Trocar credenciais
                    </button>
                </div>
            )}

            <div className="mt-6 text-center">
                <button onClick={() => router.push("/dashboard")} className="text-xs muted hover:underline">
                    Pular onboarding por agora →
                </button>
            </div>
        </main>
    );
}

export default function OnboardingPage() {
    return (
        <Suspense fallback={null}>
            <OnboardingContent />
        </Suspense>
    );
}

function FacebookIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
    );
}
