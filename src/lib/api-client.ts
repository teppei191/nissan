import { useLocale } from "@/stores/locale";

const BASE = "/api/v1";

function localeHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  return { "Accept-Language": useLocale.getState().locale };
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) =>
    fetch(`${BASE}${path}`, { headers: localeHeader() }).then((r) => handle<T>(r)),
  post: <TReq, TRes>(path: string, body: TReq) =>
    fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...localeHeader() },
      body: JSON.stringify(body),
    }).then((r) => handle<TRes>(r)),
  put: <TReq, TRes>(path: string, body: TReq) =>
    fetch(`${BASE}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...localeHeader() },
      body: JSON.stringify(body),
    }).then((r) => handle<TRes>(r)),
  del: <T>(path: string) =>
    fetch(`${BASE}${path}`, { method: "DELETE", headers: localeHeader() }).then((r) =>
      handle<T>(r)
    ),
};

export const apiBase = BASE;
