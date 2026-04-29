import type { SystemHealth, LoginEvent, KnowledgeDoc } from "@/types";

export function generateHealth(): SystemHealth {
  const now = Date.now();
  const series = Array.from({ length: 24 }, (_, i) => {
    const ts = new Date(now - (23 - i) * 3600_000).toISOString();
    const latencyMs = 180 + Math.round(Math.sin(i / 3) * 30 + Math.random() * 40);
    const errors = i === 17 ? 6 : i === 19 ? 2 : Math.random() > 0.85 ? 1 : 0;
    return { ts, latencyMs, errors };
  });
  const errorCount24h = series.reduce((acc, p) => acc + p.errors, 0);
  return {
    uptimePercent: 99.94,
    errorCount24h,
    alertsActive: errorCount24h > 5 ? 1 : 0,
    apiLatencyMs: series[series.length - 1].latencyMs,
    status: errorCount24h > 5 ? "degraded" : "healthy",
    series,
  };
}

const now = Date.now();
const min = (n: number) => new Date(now - n * 60_000).toISOString();
const hr = (n: number) => new Date(now - n * 3600_000).toISOString();

export const initialLoginEvents: LoginEvent[] = [
  { id: "le-1", userId: "u-admin", email: "admin@example.com", event: "login", ip: "10.0.12.4", ts: min(5) },
  { id: "le-2", userId: "u-user1", email: "user1@example.com", event: "login", ip: "10.0.18.22", ts: min(45) },
  { id: "le-3", userId: "u-owner1", email: "owner1@example.com", event: "login", ip: "10.0.18.30", ts: hr(2) },
  { id: "le-4", userId: "u-user1", email: "user1@example.com", event: "logout", ip: "10.0.18.22", ts: hr(3) },
  { id: "le-5", userId: "u-unknown", email: "intruder@example.com", event: "login_failed", ip: "203.0.113.7", ts: hr(6) },
];

function makeDoc(
  id: string,
  name: string,
  size: number,
  uploadedDaysAgo: number,
  retentionMonths = 12
): KnowledgeDoc {
  const uploadedAt = new Date(now - uploadedDaysAgo * 86400_000);
  const expiresAt = new Date(uploadedAt.getTime() + retentionMonths * 30 * 86400_000);
  return {
    id,
    name,
    size,
    uploadedAt: uploadedAt.toISOString(),
    retentionMonths,
    expiresAt: expiresAt.toISOString(),
  };
}

export const initialKBDocs: Record<string, KnowledgeDoc[]> = {
  "a-ceo-chatbot": [
    makeDoc("kb-1", "中期経営計画2026.pdf", 2_348_512, 30),
    makeDoc("kb-2", "Q4_経営会議議事録.docx", 487_233, 12),
    makeDoc("kb-3", "ESG_KPI一覧.pdf", 198_812, 3),
  ],
};
