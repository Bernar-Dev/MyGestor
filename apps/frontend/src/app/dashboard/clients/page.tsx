"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Loader2, Users, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";

interface ClientRow {
    id: string; name: string; company: string | null; status: string;
    portal_enabled: boolean; ad_accounts_count: number; contact_email: string | null;
}

export default function ClientsPage() {
    const [clients, setClients] = useState<ClientRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [openForm, setOpenForm] = useState(false);
    const [form, setForm] = useState({ name: "", company: "", contact_email: "", contact_phone: "", notes: "" });
    const [busy, setBusy] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const r = await apiFetch<{ clients: ClientRow[] }>("/clients");
            setClients(r.clients || []);
        } catch (e: any) {
            toast.error(e.message);
        }
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const submit = async () => {
        if (!form.name) { toast.error("Nome obrigatório"); return; }
        setBusy(true);
        try {
            await apiFetch("/clients", { method: "POST", body: form });
            toast.success("Cliente criado");
            setOpenForm(false);
            setForm({ name: "", company: "", contact_email: "", contact_phone: "", notes: "" });
            load();
        } catch (e: any) { toast.error(e.message); }
        finally { setBusy(false); }
    };

    return (
        <div className="min-h-screen">
            <header className="flex items-center justify-between px-4 md:px-6 py-4 border-b" style={{ borderColor: "var(--color-glass-border)" }}>
                <div className="flex items-center gap-3">
                    <Link href="/dashboard" className="btn-secondary"><ArrowLeft className="w-4 h-4" /></Link>
                    <div>
                        <h1 className="font-bold flex items-center gap-2"><Users className="w-4 h-4" /> Clientes</h1>
                        <p className="text-xs muted">{clients.length} cadastrados</p>
                    </div>
                </div>
                <button onClick={() => setOpenForm(true)} className="btn-primary"><Plus className="w-4 h-4" /> Novo cliente</button>
            </header>

            <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin muted" /></div>
                ) : clients.length === 0 ? (
                    <div className="glass p-10 text-center">
                        <Users className="w-10 h-10 mx-auto mb-3" style={{ color: "#a78bfa" }} />
                        <h2 className="font-bold mb-1">Sem clientes ainda</h2>
                        <p className="muted text-sm mb-4">Crie o primeiro cliente. Você atribui contas Meta e envia um link de acesso pro portal dele.</p>
                        <button onClick={() => setOpenForm(true)} className="btn-primary inline-flex">Adicionar cliente</button>
                    </div>
                ) : (
                    <ul className="glass divide-y" style={{ borderColor: "var(--color-glass-border)" }}>
                        {clients.map(c => (
                            <li key={c.id}>
                                <Link href={`/dashboard/clients/${c.id}`} className="flex items-center justify-between p-4 hover:bg-white/5">
                                    <div>
                                        <p className="font-semibold">{c.name} {c.status !== "active" && <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>{c.status}</span>}</p>
                                        <p className="text-xs muted mt-0.5">
                                            {c.company || "—"} · {c.contact_email || "sem email"}
                                            · <strong>{c.ad_accounts_count}</strong> contas atribuídas
                                            · {c.portal_enabled ? <span style={{ color: "#34d399" }}>portal ativo</span> : <span style={{ color: "rgba(255,255,255,0.4)" }}>portal inativo</span>}
                                        </p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 muted" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </main>

            {/* Modal novo cliente */}
            {openForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setOpenForm(false)}>
                    <div className="glass max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold">Novo cliente</h2>
                            <button onClick={() => setOpenForm(false)} className="btn-secondary p-2"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="label">Nome do contato *</label>
                                <input className="input" value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))} placeholder="João Silva" />
                            </div>
                            <div>
                                <label className="label">Empresa</label>
                                <input className="input" value={form.company} onChange={e => setForm(s => ({ ...s, company: e.target.value }))} placeholder="Empresa LTDA" />
                            </div>
                            <div>
                                <label className="label">Email</label>
                                <input className="input" type="email" value={form.contact_email} onChange={e => setForm(s => ({ ...s, contact_email: e.target.value }))} placeholder="contato@empresa.com" />
                            </div>
                            <div>
                                <label className="label">Telefone</label>
                                <input className="input" value={form.contact_phone} onChange={e => setForm(s => ({ ...s, contact_phone: e.target.value }))} placeholder="(11) 99999-9999" />
                            </div>
                            <div>
                                <label className="label">Notas</label>
                                <textarea className="input" value={form.notes} onChange={e => setForm(s => ({ ...s, notes: e.target.value }))} rows={2} />
                            </div>
                            <button onClick={submit} disabled={busy} className="btn-primary w-full justify-center" style={{ padding: "0.7rem" }}>
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Criar cliente
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
