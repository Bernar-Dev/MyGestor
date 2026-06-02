"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";

type HealthResponse = { ok: boolean; ts: string };
type WhoamiResponse = { user: { id: string; email: string }; session: unknown };

interface Result<T> {
  status: "loading" | "ok" | "error";
  data?: T;
  error?: string;
}

function call<T>(setter: (r: Result<T>) => void, path: string) {
  setter({ status: "loading" });
  apiFetch<T>(path)
    .then((data) => setter({ status: "ok", data }))
    .catch((e: unknown) => {
      if (e instanceof ApiError) setter({ status: "error", error: `${e.status} — ${e.message}` });
      else if (e instanceof Error) setter({ status: "error", error: e.message });
      else setter({ status: "error", error: String(e) });
    });
}

export default function TestPage() {
  const [health, setHealth] = useState<Result<HealthResponse>>({ status: "loading" });
  const [whoami, setWhoami] = useState<Result<WhoamiResponse>>({ status: "loading" });

  useEffect(() => {
    call(setHealth, "/health");
    call(setWhoami, "/whoami");
  }, []);

  return (
    <main
      style={{
        padding: 32,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        maxWidth: 880,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>Smoke test — Next ↔ Nest</h1>

      <Block title="GET /api/health (público)" result={health} />
      <Block title="GET /api/whoami (autenticado)" result={whoami} />

      <p style={{ marginTop: 24, color: "#666", fontSize: 13 }}>
        Se <code>/whoami</code> der 401, vá pra <a href="/login">/login</a>, autentique, e volte aqui.
      </p>
    </main>
  );
}

function Block<T>({ title, result }: { title: string; result: Result<T> }) {
  const palette =
    result.status === "ok"
      ? { bg: "#efe", color: "#060" }
      : result.status === "error"
        ? { bg: "#fee", color: "#900" }
        : { bg: "#f4f4f4", color: "#444" };

  return (
    <section style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 14, marginBottom: 8, color: "#444" }}>{title}</h2>
      <pre
        style={{
          background: palette.bg,
          color: palette.color,
          padding: 16,
          borderRadius: 8,
          whiteSpace: "pre-wrap",
          margin: 0,
        }}
      >
        {result.status === "loading" && "Loading…"}
        {result.status === "error" && `ERROR: ${result.error}`}
        {result.status === "ok" && JSON.stringify(result.data, null, 2)}
      </pre>
    </section>
  );
}
