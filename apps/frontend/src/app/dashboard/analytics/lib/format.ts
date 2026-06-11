export function formatCurrency(v: number) {
    if (!isFinite(v)) return '—';
    return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function formatNumber(v: number) {
    if (!isFinite(v)) return '—';
    return Math.round(v).toLocaleString('pt-BR');
}
export function formatPct(v: number) {
    if (!isFinite(v)) return '—';
    return `${v.toFixed(2)}%`;
}
export function formatDecimal(v: number) {
    if (!isFinite(v)) return '—';
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function formatDelta(d: number | null | undefined): { text: string; positive: boolean | null } {
    if (d === null || d === undefined) return { text: '—', positive: null };
    if (!isFinite(d)) return { text: '—', positive: null };
    const sign = d > 0 ? '+' : '';
    return { text: `${sign}${d.toFixed(1)}%`, positive: d > 0 };
}
export function todayBR(): string {
    return new Date().toLocaleDateString('pt-BR');
}

