"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    BarChart3, ExternalLink, Copy, Check, Loader2, AlertCircle, ChevronRight,
    CircleCheck, Circle, Sparkles,
} from "lucide-react";
import { toast } from "sonner";

const STEPS = [
    { id: 1, label: "Criar App no Meta" },
    { id: 2, label: "Pegar App ID + Secret" },
    { id: 3, label: "Cadastrar aqui" },
    { id: 4, label: "Autorizar Facebook" },
];

function OnboardingContent() {
    const router = useRouter();
    const params = useSearchParams();
    const [step, setStep] = useState(1);
    const [appId, setAppId] = useState("");
    const [appSecret, setAppSecret] = useState("");
    const [appName, setAppName] = useState("");
    const [busy, setBusy] = useState(false);
    const [redirectUri, setRedirectUri] = useState("");
    const [copiedRedirect, setCopiedRedirect] = useState(false);

    useEffect(() => {
        setRedirectUri(`${location.origin}/api/meta/callback`);
        // se já tem credenciais salvas, pula pro passo 4
        fetch("/api/meta/credentials").then(r => r.json()).then(d => {
            if (d.configured) {
                setAppId(d.appId);
                setAppName(d.appName || "");
                setStep(4);
            }
        }).catch(() => { });
        const err = params.get("error");
        if (err) toast.error(decodeURIComponent(err));
    }, [params]);

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

    const connectFacebook = () => {
        window.location.href = "/api/meta/connect";
    };

    return (
        <main className="max-w-3xl mx-auto px-4 py-8 md:py-14">
            <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4c6ef5 0%, #7c3aed 50%, #f472b6 100%)" }}>
                    <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="font-bold text-lg">Conectar sua conta Meta</h1>
                    <p className="text-xs muted">Setup em ~3 minutos. Seus dados ficam só com você.</p>
                </div>
            </div>

            {/* Progresso */}
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

            {/* PASSO 1 */}
            {step === 1 && (
                <div className="glass p-6 md:p-8 space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Sparkles className="w-5 h-5" style={{ color: "#a78bfa" }} />
                        Passo 1 — Criar o app no Meta
                    </h2>
                    <p className="muted text-sm">
                        Você precisa de um <strong>App do Meta for Developers</strong> pra conectar sua conta.
                        É grátis e leva ~1 minuto. Vou te guiar exatamente onde clicar.
                    </p>

                    <ol className="space-y-3 text-sm">
                        <li>
                            <strong className="muted-strong">1.</strong> Abra o portal do Meta Developers:
                            <a href="https://developers.facebook.com/apps/create/" target="_blank" rel="noopener"
                                className="btn-secondary inline-flex ml-2 mt-1" style={{ padding: "0.35rem 0.7rem", fontSize: "0.78rem" }}>
                                Criar App <ExternalLink className="w-3 h-3" />
                            </a>
                        </li>
                        <li><strong className="muted-strong">2.</strong> Faça login com sua conta pessoal do Facebook (a mesma que tem acesso às contas de anúncio dos clientes).</li>
                        <li><strong className="muted-strong">3.</strong> Em <em>"Adicionar caso de uso"</em>, escolha <strong>"Outros"</strong>.</li>
                        <li><strong className="muted-strong">4.</strong> Em <em>"Tipo de App"</em>, escolha <strong>"Empresa"</strong>.</li>
                        <li><strong className="muted-strong">5.</strong> Dê um nome (qualquer um, ex: <em>"Meu Gestor"</em>), informe seu email e clique <strong>Criar app</strong>.</li>
                    </ol>

                    <div className="glass p-4 mt-4" style={{ background: "rgba(167,139,250,0.05)", borderColor: "rgba(167,139,250,0.2)" }}>
                        <p className="text-xs muted-strong">💡 Após criar, no menu lateral procure "Marketing API" e clique em <strong>"Adicionar"</strong> ou <strong>"Configurar"</strong>. É isso que permite ler suas contas.</p>
                    </div>

                    <button onClick={() => setStep(2)} className="btn-primary w-full justify-center mt-4" style={{ padding: "0.75rem" }}>
                        Já criei o app, próximo →
                    </button>
                </div>
            )}

            {/* PASSO 2 */}
            {step === 2 && (
                <div className="glass p-6 md:p-8 space-y-4">
                    <h2 className="text-xl font-bold">Passo 2 — Pegar App ID e Secret</h2>
                    <p className="muted text-sm">
                        Dentro do seu app, abra <strong>Configurações → Básico</strong> no menu lateral.
                    </p>
                    <ol className="space-y-2 text-sm muted-strong">
                        <li><strong>•</strong> O <strong>App ID</strong> aparece no topo, é um número longo (15-16 dígitos).</li>
                        <li><strong>•</strong> O <strong>App Secret</strong> está logo abaixo. Clique em <strong>"Mostrar"</strong> e digite sua senha do Facebook.</li>
                    </ol>

                    <div className="glass p-4" style={{ background: "rgba(251,191,36,0.05)", borderColor: "rgba(251,191,36,0.2)" }}>
                        <p className="text-xs muted-strong">
                            ⚠️ O App Secret é como uma senha — nunca compartilhe. Nós salvamos cifrado (AES-256) e nunca exibimos depois.
                        </p>
                    </div>

                    <div>
                        <label className="label">URL de Redirecionamento OAuth (você vai configurar isso no Meta)</label>
                        <div className="flex gap-2">
                            <input className="input" value={redirectUri} readOnly />
                            <button onClick={copyRedirect} className="btn-secondary" style={{ padding: "0.55rem 0.75rem" }}>
                                {copiedRedirect ? <Check className="w-4 h-4" style={{ color: "#34d399" }} /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>
                        <p className="text-xs muted mt-2">
                            No app Meta, vá em <strong>Login com Facebook → Configurações</strong> e cole esta URL em <strong>"URIs de redirecionamento OAuth válidos"</strong>. Depois clique em "Salvar alterações".
                        </p>
                    </div>

                    <div className="flex gap-2 mt-4">
                        <button onClick={() => setStep(1)} className="btn-secondary">← Voltar</button>
                        <button onClick={() => setStep(3)} className="btn-primary flex-1 justify-center">Próximo →</button>
                    </div>
                </div>
            )}

            {/* PASSO 3 */}
            {step === 3 && (
                <div className="glass p-6 md:p-8 space-y-4">
                    <h2 className="text-xl font-bold">Passo 3 — Colar credenciais aqui</h2>
                    <p className="muted text-sm">Cole o App ID e App Secret. Salvamos cifrado e nunca exibimos depois.</p>

                    <div>
                        <label className="label">Nome do App <span className="muted text-xs">(opcional, só pra você lembrar)</span></label>
                        <input className="input" value={appName} onChange={e => setAppName(e.target.value)} placeholder="Ex: Meu Gestor" />
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

            {/* PASSO 4 */}
            {step === 4 && (
                <div className="glass p-6 md:p-8 space-y-4">
                    <h2 className="text-xl font-bold">Passo 4 — Autorizar Facebook</h2>
                    <p className="muted text-sm">
                        Clique no botão abaixo. Você será redirecionado pro Facebook pra autorizar as permissões
                        (ler contas, ler insights, gerenciar anúncios). Depois volta automático e já tá pronto.
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
