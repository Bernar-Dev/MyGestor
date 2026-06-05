/**
 * Persistência das credenciais Meta da ORGANIZAÇÃO (não mais por user).
 * Agência cadastra App ID + Secret no perfil da org → secret AES-256-GCM.
 *
 * Usa service_role pra bypassar RLS apenas após resolver a org do user logado.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/crypto";

export interface MetaCredentials {
    app_id: string;
    app_secret: string;
    app_name: string | null;
    redirect_uri: string;
}

export interface MetaTokenRow {
    access_token: string;
    fb_user_id: string | null;
    fb_user_name: string | null;
    scopes: string[] | null;
    expires_at: string | null;
    refreshed_at: string;
}

export async function saveMetaCredentials(orgId: string, creds: {
    appId: string; appSecret: string; appName?: string; redirectUri: string;
}) {
    const svc = createServiceClient();
    const { error } = await svc.from("meta_credentials").upsert({
        org_id: orgId,
        app_id: creds.appId,
        app_secret_encrypted: encrypt(creds.appSecret),
        app_name: creds.appName || null,
        redirect_uri: creds.redirectUri,
        updated_at: new Date().toISOString(),
    }, { onConflict: "org_id" });
    if (error) throw new Error(error.message);
}

export async function loadMetaCredentials(orgId: string): Promise<MetaCredentials | null> {
    const svc = createServiceClient();
    const { data, error } = await svc.from("meta_credentials")
        .select("app_id, app_secret_encrypted, app_name, redirect_uri")
        .eq("org_id", orgId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
        app_id: data.app_id,
        app_secret: decrypt(data.app_secret_encrypted),
        app_name: data.app_name,
        redirect_uri: data.redirect_uri,
    };
}

export async function deleteMetaCredentials(orgId: string) {
    const svc = createServiceClient();
    await svc.from("meta_credentials").delete().eq("org_id", orgId);
}

export async function saveMetaToken(orgId: string, token: {
    accessToken: string;
    fbUserId?: string;
    fbUserName?: string;
    scopes?: string[];
    expiresInSeconds?: number;
}) {
    const svc = createServiceClient();
    const expiresAt = token.expiresInSeconds && token.expiresInSeconds > 0
        ? new Date(Date.now() + token.expiresInSeconds * 1000).toISOString()
        : null;
    const { error } = await svc.from("meta_tokens").upsert({
        org_id: orgId,
        access_token_encrypted: encrypt(token.accessToken),
        fb_user_id: token.fbUserId || null,
        fb_user_name: token.fbUserName || null,
        scopes: token.scopes || null,
        expires_at: expiresAt,
        refreshed_at: new Date().toISOString(),
    }, { onConflict: "org_id" });
    if (error) throw new Error(error.message);
}

export async function loadMetaToken(orgId: string): Promise<MetaTokenRow | null> {
    const svc = createServiceClient();
    const { data, error } = await svc.from("meta_tokens")
        .select("access_token_encrypted, fb_user_id, fb_user_name, scopes, expires_at, refreshed_at")
        .eq("org_id", orgId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
        access_token: decrypt(data.access_token_encrypted),
        fb_user_id: data.fb_user_id,
        fb_user_name: data.fb_user_name,
        scopes: data.scopes,
        expires_at: data.expires_at,
        refreshed_at: data.refreshed_at,
    };
}

export async function deleteMetaToken(orgId: string) {
    const svc = createServiceClient();
    await svc.from("meta_tokens").delete().eq("org_id", orgId);
}
