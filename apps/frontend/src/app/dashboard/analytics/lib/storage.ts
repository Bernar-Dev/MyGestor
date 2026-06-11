/**
 * Persistência local (localStorage) para preferências do gestor.
 * Toda chave é prefixada com mg: para escopo do meugestor.
 */

const PREFIX = 'mg:';

export const KEYS = {
    favorites: 'favorites',
    clientLabels: 'clientLabels',
    metricsByLevel: 'metricsByLevel',
    period: 'period',
    customRange: 'customRange',
    compare: 'compare',
    onlyFavorites: 'onlyFavorites',
    sidebarOpen: 'sidebarOpen',
};

export function load<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    try {
        const raw = localStorage.getItem(PREFIX + key);
        if (raw === null) return fallback;
        return JSON.parse(raw) as T;
    } catch { return fallback; }
}

export function save(key: string, value: any) {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch {}
}

export function remove(key: string) {
    if (typeof window === 'undefined') return;
    try { localStorage.removeItem(PREFIX + key); } catch {}
}

