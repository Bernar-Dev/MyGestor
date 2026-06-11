/**
 * Catálogo de métricas exibíveis no Meu Gestor.
 * Cada métrica tem: chave (no flatten), label PT-BR, categoria, formatador e tooltip.
 */

export type MetricCategory =
    | 'investimento'
    | 'engajamento'
    | 'custo'
    | 'conversao'
    | 'video'
    | 'qualidade'
    | 'audiencia';

export type MetricFormat = 'currency' | 'number' | 'percent' | 'decimal' | 'text' | 'duration';

export interface MetricDef {
    key: string;
    label: string;
    short?: string;
    category: MetricCategory;
    format: MetricFormat;
    tooltip: string;
    higherIsBetter?: boolean; // p/ colorir delta
}

export const METRIC_CATALOG: MetricDef[] = [
    // INVESTIMENTO
    { key: 'spend', label: 'Investimento', category: 'investimento', format: 'currency', tooltip: 'Valor total gasto no período', higherIsBetter: undefined },
    { key: 'reach', label: 'Alcance', category: 'investimento', format: 'number', tooltip: 'Pessoas únicas que viram o anúncio', higherIsBetter: true },
    { key: 'impressions', label: 'Impressões', category: 'investimento', format: 'number', tooltip: 'Quantas vezes o anúncio foi exibido', higherIsBetter: true },
    { key: 'frequency', label: 'Frequência', category: 'investimento', format: 'decimal', tooltip: 'Média de vezes que cada pessoa viu (impressões / alcance). >3,5 = saturação', higherIsBetter: false },

    // ENGAJAMENTO
    { key: 'clicks', label: 'Cliques (todos)', category: 'engajamento', format: 'number', tooltip: 'Cliques totais — inclui curtidas, perfil, comentários etc.', higherIsBetter: true },
    { key: 'inline_link_clicks', label: 'Cliques no Link', short: 'CLT', category: 'engajamento', format: 'number', tooltip: 'Cliques que levaram para fora do Facebook (LP / WhatsApp / site)', higherIsBetter: true },
    { key: 'unique_clicks', label: 'Cliques Únicos', category: 'engajamento', format: 'number', tooltip: 'Cliques de pessoas únicas', higherIsBetter: true },
    { key: 'ctr', label: 'CTR', category: 'engajamento', format: 'percent', tooltip: 'Taxa de clique (cliques / impressões). Saudável: 1-3%', higherIsBetter: true },
    { key: 'inline_link_click_ctr', label: 'CTR do Link', category: 'engajamento', format: 'percent', tooltip: 'Cliques no link / impressões — métrica mais limpa para tráfego', higherIsBetter: true },
    { key: 'unique_ctr', label: 'CTR Único', category: 'engajamento', format: 'percent', tooltip: 'CTR considerando pessoas únicas', higherIsBetter: true },
    { key: 'post_engagement', label: 'Engajamento Post', category: 'engajamento', format: 'number', tooltip: 'Reações + comentários + compartilhamentos + cliques no post', higherIsBetter: true },
    { key: 'page_engagement', label: 'Engaj. Página', category: 'engajamento', format: 'number', tooltip: 'Engajamento total na página', higherIsBetter: true },
    { key: 'post_reaction', label: 'Reações', category: 'engajamento', format: 'number', tooltip: 'Curtidas, amor, etc.', higherIsBetter: true },
    { key: 'post_save', label: 'Salvamentos', category: 'engajamento', format: 'number', tooltip: 'Sinal forte de criativo de qualidade', higherIsBetter: true },

    // CUSTO
    { key: 'cpc', label: 'CPC', category: 'custo', format: 'currency', tooltip: 'Custo por clique', higherIsBetter: false },
    { key: 'cpm', label: 'CPM', category: 'custo', format: 'currency', tooltip: 'Custo por mil impressões', higherIsBetter: false },
    { key: 'cpp', label: 'CPP', category: 'custo', format: 'currency', tooltip: 'Custo por mil pessoas alcançadas', higherIsBetter: false },
    { key: 'cost_per_inline_link_click', label: 'CPC do Link', category: 'custo', format: 'currency', tooltip: 'Custo por clique no link (mais relevante que CPC)', higherIsBetter: false },
    { key: 'cost_per_unique_click', label: 'CPC Único', category: 'custo', format: 'currency', tooltip: 'Custo por clique único', higherIsBetter: false },

    // CONVERSÃO
    { key: 'leads', label: 'Leads', category: 'conversao', format: 'number', tooltip: 'Cadastros captados', higherIsBetter: true },
    { key: 'cpl', label: 'CPL', category: 'conversao', format: 'currency', tooltip: 'Custo por lead', higherIsBetter: false },
    { key: 'lead_rate', label: 'Taxa de Lead', category: 'conversao', format: 'percent', tooltip: 'Leads / cliques', higherIsBetter: true },
    { key: 'purchases', label: 'Compras', category: 'conversao', format: 'number', tooltip: 'Eventos de compra registrados', higherIsBetter: true },
    { key: 'purchase_value', label: 'Receita', category: 'conversao', format: 'currency', tooltip: 'Valor monetário das compras (action_value)', higherIsBetter: true },
    { key: 'cpa_purchase', label: 'CPA (Compra)', category: 'conversao', format: 'currency', tooltip: 'Custo por compra', higherIsBetter: false },
    { key: 'roas', label: 'ROAS', category: 'conversao', format: 'decimal', tooltip: 'Retorno sobre investimento (receita / spend)', higherIsBetter: true },
    { key: 'conversion_rate', label: 'Conv. Rate', category: 'conversao', format: 'percent', tooltip: 'Compras / cliques', higherIsBetter: true },
    { key: 'add_to_cart', label: 'Adic. Carrinho', category: 'conversao', format: 'number', tooltip: 'Eventos add_to_cart', higherIsBetter: true },
    { key: 'initiate_checkout', label: 'Início Checkout', category: 'conversao', format: 'number', tooltip: 'Eventos initiate_checkout', higherIsBetter: true },
    { key: 'view_content', label: 'View Content', category: 'conversao', format: 'number', tooltip: 'Visualizações de produto/página', higherIsBetter: true },
    { key: 'complete_registration', label: 'Cadastros Concluídos', category: 'conversao', format: 'number', tooltip: 'Registros completos', higherIsBetter: true },
    { key: 'contact', label: 'Contatos', category: 'conversao', format: 'number', tooltip: 'Eventos contact', higherIsBetter: true },
    { key: 'cpa_contact', label: 'CPA Contato', category: 'conversao', format: 'currency', tooltip: 'Custo por contato', higherIsBetter: false },
    { key: 'messaging_started', label: 'Conversas WhatsApp', category: 'conversao', format: 'number', tooltip: 'Conversas iniciadas via Click-to-Message', higherIsBetter: true },
    { key: 'messaging_replied', label: 'Conversas Respondidas', category: 'conversao', format: 'number', tooltip: 'Primeira resposta após mensagem', higherIsBetter: true },
    { key: 'cpa_messaging', label: 'CPA Conversa', category: 'conversao', format: 'currency', tooltip: 'Custo por conversa iniciada', higherIsBetter: false },
    { key: 'link_clicks', label: 'Link Clicks (action)', category: 'conversao', format: 'number', tooltip: 'Cliques em link reportados como ação', higherIsBetter: true },
    { key: 'landing_page_views', label: 'Landing Page Views', category: 'conversao', format: 'number', tooltip: 'Carregamentos completos da página de destino — diferente de cliques!', higherIsBetter: true },
    { key: 'cpa_landing', label: 'Custo / LPV', category: 'conversao', format: 'currency', tooltip: 'Custo por landing page view', higherIsBetter: false },
    { key: 'search', label: 'Buscas', category: 'conversao', format: 'number', tooltip: 'Eventos search', higherIsBetter: true },

    // VÍDEO
    { key: 'video_3s', label: 'Views 3s', category: 'video', format: 'number', tooltip: 'Visualizações de pelo menos 3 segundos (hook)', higherIsBetter: true },
    { key: 'hook_rate', label: 'Hook Rate', category: 'video', format: 'percent', tooltip: 'Views 3s / impressões — mede o quanto o início do vídeo segura', higherIsBetter: true },
    { key: 'thumbstop_rate', label: 'Thumbstop', category: 'video', format: 'percent', tooltip: 'Sinônimo de Hook Rate', higherIsBetter: true },
    { key: 'hold_rate', label: 'Hold Rate', category: 'video', format: 'percent', tooltip: 'Views 100% / Views 3s — mede retenção', higherIsBetter: true },
    { key: 'video_p25', label: 'Views 25%', category: 'video', format: 'number', tooltip: 'Views até 25% do vídeo', higherIsBetter: true },
    { key: 'video_p50', label: 'Views 50%', category: 'video', format: 'number', tooltip: 'Views até 50% do vídeo', higherIsBetter: true },
    { key: 'video_p75', label: 'Views 75%', category: 'video', format: 'number', tooltip: 'Views até 75% do vídeo', higherIsBetter: true },
    { key: 'video_p95', label: 'Views 95%', category: 'video', format: 'number', tooltip: 'Views até 95%', higherIsBetter: true },
    { key: 'video_p100', label: 'Views 100%', category: 'video', format: 'number', tooltip: 'Vídeos assistidos por completo', higherIsBetter: true },
    { key: 'view_rate_25', label: 'Taxa 25%', category: 'video', format: 'percent', tooltip: 'Views 25% / impressões', higherIsBetter: true },
    { key: 'view_rate_50', label: 'Taxa 50%', category: 'video', format: 'percent', tooltip: 'Views 50% / impressões', higherIsBetter: true },
    { key: 'view_rate_75', label: 'Taxa 75%', category: 'video', format: 'percent', tooltip: 'Views 75% / impressões', higherIsBetter: true },
    { key: 'view_rate_95', label: 'Taxa 95%', category: 'video', format: 'percent', tooltip: 'Views 95% / impressões', higherIsBetter: true },
    { key: 'view_rate_100', label: 'Taxa 100%', category: 'video', format: 'percent', tooltip: 'Views 100% / impressões — retenção real', higherIsBetter: true },
    { key: 'thruplay', label: 'ThruPlay', category: 'video', format: 'number', tooltip: 'Vídeos assistidos por completo até 15s (métrica oficial Meta)', higherIsBetter: true },
    { key: 'cost_per_thruplay', label: 'Custo / ThruPlay', category: 'video', format: 'currency', tooltip: 'Custo por ThruPlay', higherIsBetter: false },
    { key: 'video_avg_time', label: 'Tempo Médio', category: 'video', format: 'duration', tooltip: 'Tempo médio assistido (segundos)', higherIsBetter: true },

    // QUALIDADE META
    { key: 'quality_ranking', label: 'Quality Ranking', category: 'qualidade', format: 'text', tooltip: 'Como a Meta avalia a qualidade do anúncio comparado a concorrentes (ABOVE / AVERAGE / BELOW_*)' },
    { key: 'engagement_rate_ranking', label: 'Engagement Ranking', category: 'qualidade', format: 'text', tooltip: 'Engajamento esperado vs concorrentes' },
    { key: 'conversion_rate_ranking', label: 'Conversion Ranking', category: 'qualidade', format: 'text', tooltip: 'Taxa de conversão vs concorrentes' },
    { key: 'health', label: 'Health Score', category: 'qualidade', format: 'number', tooltip: 'Score proprietário (0-100) — combina CTR, frequência, CPM, rankings e ausência de conversão', higherIsBetter: true },
];

export const METRIC_BY_KEY: Record<string, MetricDef> = METRIC_CATALOG.reduce((acc, m) => {
    acc[m.key] = m; return acc;
}, {} as Record<string, MetricDef>);

export const PRESETS: Record<string, string[]> = {
    'Tráfego': ['spend', 'impressions', 'inline_link_clicks', 'inline_link_click_ctr', 'cost_per_inline_link_click', 'frequency', 'health'],
    'Conversão': ['spend', 'leads', 'cpl', 'purchases', 'cpa_purchase', 'roas', 'conversion_rate', 'health'],
    'Vídeo': ['spend', 'impressions', 'video_3s', 'hook_rate', 'hold_rate', 'thruplay', 'cost_per_thruplay', 'video_avg_time'],
    'WhatsApp': ['spend', 'inline_link_clicks', 'messaging_started', 'cpa_messaging', 'messaging_replied', 'frequency', 'health'],
    'Engajamento': ['spend', 'reach', 'frequency', 'post_engagement', 'post_reaction', 'post_save', 'ctr'],
    'E-commerce': ['spend', 'view_content', 'add_to_cart', 'initiate_checkout', 'purchases', 'purchase_value', 'roas', 'cpa_purchase'],
    'Diagnóstico': ['spend', 'ctr', 'cpc', 'cpm', 'frequency', 'quality_ranking', 'engagement_rate_ranking', 'conversion_rate_ranking', 'health'],
};

// ─────────────────────────────────────────────────────────────
// FORMATAÇÃO
// ─────────────────────────────────────────────────────────────

export function formatMetric(value: any, fmt: MetricFormat): string {
    if (value === null || value === undefined || value === '') return '—';
    const n = Number(value);
    switch (fmt) {
        case 'currency':
            if (!isFinite(n) || n === 0) return '—';
            return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        case 'percent':
            if (!isFinite(n)) return '—';
            return `${n.toFixed(2)}%`;
        case 'decimal':
            if (!isFinite(n)) return '—';
            return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        case 'number':
            if (!isFinite(n)) return '—';
            return Math.round(n).toLocaleString('pt-BR');
        case 'duration':
            if (!isFinite(n) || n === 0) return '—';
            return `${n.toFixed(1)}s`;
        case 'text':
            return rankingLabel(String(value));
        default: return String(value);
    }
}

export function rankingLabel(r?: string | null): string {
    if (!r) return '—';
    const map: Record<string, string> = {
        'ABOVE_AVERAGE': '↑ Acima',
        'AVERAGE': '≈ Média',
        'BELOW_AVERAGE_35_55': '↓ Abaixo (médio)',
        'BELOW_AVERAGE_20_35': '↓↓ Baixo',
        'BELOW_AVERAGE_10': '⚠ Crítico',
        'UNKNOWN': 'Sem dados',
    };
    return map[r] || r;
}

export function rankingColor(r?: string | null): string {
    if (!r) return 'rgba(255,255,255,0.4)';
    if (r === 'ABOVE_AVERAGE') return '#34d399';
    if (r === 'AVERAGE') return '#fbbf24';
    if (r?.startsWith('BELOW')) return '#f87171';
    return 'rgba(255,255,255,0.4)';
}

