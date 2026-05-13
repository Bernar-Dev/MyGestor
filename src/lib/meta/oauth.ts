/**
 * URLs de OAuth do Facebook Login. As permissões aqui são as mínimas
 * pra um gestor de tráfego operar contas de clientes existentes.
 */

export const META_SCOPES = [
    "ads_read",
    "ads_management",
    "business_management",
    "read_insights",
];

export function buildAuthorizeUrl(opts: {
    appId: string;
    redirectUri: string;
    state: string;
}): string {
    const p = new URLSearchParams({
        client_id: opts.appId,
        redirect_uri: opts.redirectUri,
        state: opts.state,
        scope: META_SCOPES.join(","),
        response_type: "code",
        auth_type: "rerequest",
    });
    return `https://www.facebook.com/v22.0/dialog/oauth?${p.toString()}`;
}

export function buildRedirectUri(origin: string): string {
    return `${origin.replace(/\/$/, "")}/api/meta/callback`;
}
