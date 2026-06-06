import Link from "next/link";
import { BarChart3, ShieldCheck, Zap, Users } from "lucide-react";

export default function Home() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-16">
      <header className="flex items-center justify-between mb-16">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4c6ef5 0%, #7c3aed 50%, #f472b6 100%)" }}>
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Newgestor</h1>
            <p className="text-xs muted">Meta Ads para agências</p>
          </div>
        </div>
        <Link href="/login" className="btn-secondary">Entrar</Link>
      </header>

      <section className="mb-20">
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-5">
          Gestão de tráfego Meta para <span style={{ background: "linear-gradient(135deg, #748ffc, #c084fc, #f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>todas suas contas</span>, em um só lugar.
        </h2>
        <p className="text-lg muted max-w-2xl mb-8">
          Conecte seu Meta Business uma vez e visualize, exporte e compartilhe relatórios de todos seus clientes.
          Diagnóstico automático, anúncios ativos compartilháveis, análise IA.
        </p>
        <div className="flex gap-3">
          <Link href="/login" className="btn-primary">Começar grátis</Link>
          <a href="#como-funciona" className="btn-secondary">Como funciona</a>
        </div>
      </section>

      <section id="como-funciona" className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Feature icon={Zap} title="Setup em 5 minutos" body="Crie sua agência, cole App ID/Secret do seu Meta App próprio, autorize o Facebook. Pronto." />
        <Feature icon={ShieldCheck} title="Suas chaves, seu acesso" body="Cada agência cadastra seu próprio Meta App dentro da plataforma. Tokens criptografados AES-256, isolados por RLS." />
        <Feature icon={Users} title="Portal do cliente" body="Cada cliente recebe um link de convite e acessa um portal somente-leitura com as contas que você liberou — permissões granulares." />
        <Feature icon={BarChart3} title="Todas as métricas" body="KPIs Meta em tempo real, campanhas, criativos ativos. Dados puxados direto da Graph API." />
      </section>
    </main>
  );
}

function Feature({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="glass p-5">
      <Icon className="w-5 h-5 mb-3" style={{ color: "#a78bfa" }} />
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm muted">{body}</p>
    </div>
  );
}
