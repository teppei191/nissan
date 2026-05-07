import { http, HttpResponse, delay } from "msw";
import {
  agents,
  initialAgentAccess,
  departmentAccess,
  AVATARS,
  initialAvatarPermissions,
  resolveAgents,
} from "./fixtures/agents";
import {
  initialConversations,
  initialConversationsI18n,
} from "./fixtures/conversations";
import { users, credentials } from "./fixtures/users";
import { generateHealth, initialLoginEvents, initialKBDocs } from "./fixtures/system";
import type {
  Conversation,
  Locale,
  Message,
  KnowledgeDoc,
  AgentPermission,
  User,
  AvatarPermissions,
  FeedbackSummary,
  FeedbackEntry,
  FeedbackMonthly,
} from "@/types";

function pickLocale(req: Request): Locale {
  const h = req.headers.get("Accept-Language") ?? "";
  return h === "en" ? "en" : "ja";
}

// Lookups for resolving seed conversations/messages back to their i18n source
const SEED_CONVERSATION_TITLES: Record<string, { ja: string; en: string }> = {};
const SEED_MESSAGE_CONTENT: Record<string, { ja: string; en: string }> = {};
for (const c of initialConversationsI18n) {
  SEED_CONVERSATION_TITLES[c.id] = c.title;
  for (const m of c.messages) SEED_MESSAGE_CONTENT[m.id] = m.content;
}

function resolveConversationLocale(c: Conversation, locale: Locale): Conversation {
  const titleI18n = SEED_CONVERSATION_TITLES[c.id];
  return {
    ...c,
    title: titleI18n ? titleI18n[locale] : c.title,
    messages: c.messages.map((m) => {
      const ci18n = SEED_MESSAGE_CONTENT[m.id];
      return ci18n ? { ...m, content: ci18n[locale] } : m;
    }),
  };
}

const state = {
  users: [...users] as User[],
  conversations: [...initialConversations] as Conversation[],
  loginEvents: [...initialLoginEvents],
  kbDocs: { ...initialKBDocs } as Record<string, KnowledgeDoc[]>,
  access: structuredClone(initialAgentAccess) as Record<string, Record<string, AgentPermission>>,
  deptAccess: structuredClone(departmentAccess) as Record<string, string[]>,
  avatarPermissions: structuredClone(initialAvatarPermissions) as AvatarPermissions,
};

// ---- localStorage persistence (acts as the "backend" between reloads) ----
const STORAGE_KEY = "dt-hub-msw-state-v2";

(function hydrate() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const persisted = JSON.parse(raw) as Partial<typeof state>;
    if (persisted.users) state.users = persisted.users;
    if (persisted.conversations) state.conversations = persisted.conversations;
    if (persisted.loginEvents) state.loginEvents = persisted.loginEvents;
    if (persisted.kbDocs) state.kbDocs = persisted.kbDocs;
    if (persisted.access) state.access = persisted.access;
    if (persisted.deptAccess) state.deptAccess = persisted.deptAccess;
    if (persisted.avatarPermissions) state.avatarPermissions = persisted.avatarPermissions;
  } catch {
    /* ignore */
  }
})();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota or serialization issues — silently ignore */
  }
}

if (typeof window !== "undefined") {
  // Periodic save (catches all mutations) + on unload
  setInterval(persist, 1000);
  window.addEventListener("beforeunload", persist);
}

// Expose a reset for development convenience
if (typeof window !== "undefined") {
  (window as unknown as { __dthubReset: () => void }).__dthubReset = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };
}

const uid = (p = "") => `${p}${Math.random().toString(36).slice(2, 10)}`;

function withAgentAccess(u: User): User {
  if (u.role === "admin") return { ...u, agentAccess: {} };
  const access: Record<string, "OWNER" | "VIEW"> = {};
  for (const [agentId, perUser] of Object.entries(state.access)) {
    const a = agents.find((x) => x.id === agentId);
    if (!a || a.hidden) continue;
    const p = perUser[u.id];
    if (p === "OWNER" || p === "VIEW") access[agentId] = p;
  }
  return { ...u, agentAccess: access };
}

function streamResponse(message: string) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      // Initial "thinking" delay before any token
      await delay(700);
      const tokens = message.match(/.{1,8}/g) ?? [message];
      for (const tok of tokens) {
        await delay(50 + Math.random() * 40);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: tok })}\n\n`));
      }
      controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      controller.close();
    },
  });
  return new HttpResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ---- Synthetic feedback dataset for dashboard demo ----
type I18n = { ja: string; en: string };
type SyntheticEntry = {
  agentId: string;
  type: "like" | "dislike";
  comment?: I18n;
  userPreview: I18n;
  daysAgo: number;
};

const SYNTHETIC_FEEDBACK: SyntheticEntry[] = [
  { agentId: "a-ceo-chatbot", type: "like",
    userPreview: { ja: "Q1 ROI レビューの要点を教えてください", en: "Summarize Q1 ROI review highlights" }, daysAgo: 1 },
  { agentId: "a-ceo-chatbot", type: "like",
    userPreview: { ja: "中期計画の主要 KPI を整理してほしい", en: "Organize the key KPIs of the mid-term plan" }, daysAgo: 3 },
  { agentId: "a-ceo-chatbot", type: "dislike",
    comment: { ja: "回答が抽象的で、具体的な数値根拠が欲しい。", en: "The answer was too abstract — please cite concrete numbers." },
    userPreview: { ja: "為替リスクの感度を教えて", en: "Explain FX risk sensitivity" }, daysAgo: 4 },
  { agentId: "a-ceo-chatbot", type: "like",
    userPreview: { ja: "Q4 議事録の要約をお願いします", en: "Summarize Q4 board meeting notes" }, daysAgo: 8 },
  { agentId: "a-ceo-chatbot", type: "like",
    userPreview: { ja: "新規投資の優先度を比較したい", en: "Compare priorities across new investments" }, daysAgo: 12 },
  { agentId: "a-ceo-chatbot", type: "dislike",
    comment: { ja: "古い議事録を引いていたので、参照ソースを最新版に更新してほしい。", en: "Cited old meeting notes — please refresh the references to the latest version." },
    userPreview: { ja: "経営会議の論点を整理", en: "Organize board meeting talking points" }, daysAgo: 18 },
  { agentId: "a-ceo-chatbot", type: "like",
    userPreview: { ja: "ESG 戦略の社内向け要約", en: "Internal summary of ESG strategy" }, daysAgo: 26 },
  { agentId: "a-ceo-chatbot", type: "like",
    userPreview: { ja: "競合 EV ラインナップの要約", en: "Summary of competitor EV lineup" }, daysAgo: 35 },
  { agentId: "a-ceo-chatbot", type: "like",
    userPreview: { ja: "Q3 業績ハイライトをまとめて", en: "Summarize Q3 performance highlights" }, daysAgo: 42 },
  { agentId: "a-ceo-chatbot", type: "dislike",
    comment: { ja: "数値の単位（億 / 百万）が混在していて読みにくい。", en: "Numeric units (¥100M / million) were mixed and hard to read." },
    userPreview: { ja: "売上推移を要約", en: "Summarize the revenue trend" }, daysAgo: 48 },
  { agentId: "a-ceo-chatbot", type: "like",
    userPreview: { ja: "中計2026 の主要施策", en: "Key initiatives of Mid-term Plan 2026" }, daysAgo: 60 },
  { agentId: "a-ceo-chatbot", type: "like",
    userPreview: { ja: "決算メッセージのドラフト", en: "Draft of the earnings message" }, daysAgo: 70 },
  { agentId: "a-ceo-chatbot", type: "like",
    userPreview: { ja: "Q2 業績ハイライト", en: "Q2 performance highlights" }, daysAgo: 88 },
  { agentId: "a-ceo-chatbot", type: "dislike",
    comment: { ja: "出典の Page 番号が誤っていた。", en: "The cited page number was incorrect." },
    userPreview: { ja: "ROIC のロジックツリー", en: "ROIC logic tree" }, daysAgo: 95 },
  { agentId: "a-ceo-chatbot", type: "like",
    userPreview: { ja: "原材料費高騰の影響まとめ", en: "Impact summary of rising raw material costs" }, daysAgo: 110 },
  { agentId: "a-ceo-chatbot", type: "like",
    userPreview: { ja: "中期計画の進捗レビュー", en: "Progress review of the mid-term plan" }, daysAgo: 130 },
  { agentId: "a-ceo-chatbot", type: "like",
    userPreview: { ja: "FY24 ハイライト", en: "FY24 highlights" }, daysAgo: 150 },
  { agentId: "a-ceo-chatbot", type: "dislike",
    comment: { ja: "回答が長すぎて要点が掴みづらい。", en: "The answer was too long — hard to grasp the key points." },
    userPreview: { ja: "EV ロードマップ要約", en: "EV roadmap summary" }, daysAgo: 165 },
  // 6–12 months ago
  { agentId: "a-ceo-chatbot", type: "like",
    userPreview: { ja: "FY24 中間決算ハイライト", en: "FY24 interim earnings highlights" }, daysAgo: 195 },
  { agentId: "a-ceo-chatbot", type: "dislike",
    comment: { ja: "Excel 形式で出力してほしい。", en: "Please output in Excel format." },
    userPreview: { ja: "営業利益の四半期推移", en: "Quarterly trend of operating profit" }, daysAgo: 215 },
  { agentId: "a-ceo-chatbot", type: "like",
    userPreview: { ja: "投資家向け Q&A 集の要点", en: "Key points from the investor Q&A pack" }, daysAgo: 245 },
  { agentId: "a-ceo-chatbot", type: "like",
    userPreview: { ja: "競合の Q3 決算サマリー", en: "Competitors' Q3 earnings summary" }, daysAgo: 270 },
  { agentId: "a-ceo-chatbot", type: "dislike",
    comment: { ja: "数値が古かった（前年データ参照）", en: "Figures were stale (referencing prior-year data)." },
    userPreview: { ja: "粗利率の推移", en: "Gross margin trend" }, daysAgo: 295 },
  { agentId: "a-ceo-chatbot", type: "like",
    userPreview: { ja: "新中計策定の論点整理", en: "Organizing topics for the new mid-term plan" }, daysAgo: 315 },
  { agentId: "a-ceo-chatbot", type: "like",
    userPreview: { ja: "原価構造の概要", en: "Overview of the cost structure" }, daysAgo: 340 },
  { agentId: "a-ceo-chatbot", type: "like",
    userPreview: { ja: "FY23 決算メッセージ", en: "FY23 earnings message" }, daysAgo: 360 },

  // CEO Video — focused on script/voice/lip-sync quality
  { agentId: "a-ceo-video", type: "like",
    userPreview: { ja: "Q1 決算メッセージ動画 (日本語)", en: "Q1 earnings message video (Japanese)" }, daysAgo: 2 },
  { agentId: "a-ceo-video", type: "like",
    userPreview: { ja: "ESG レポート動画版", en: "ESG report (video version)" }, daysAgo: 6 },
  { agentId: "a-ceo-video", type: "dislike",
    comment: { ja: "アバターのリップシンクが台本後半でずれていた。", en: "Avatar lip-sync drifted toward the end of the script." },
    userPreview: { ja: "Q1 決算メッセージ動画 (英語)", en: "Q1 earnings message video (English)" }, daysAgo: 9 },
  { agentId: "a-ceo-video", type: "like",
    userPreview: { ja: "新車種ローンチ社内告知", en: "Internal announcement for new model launch" }, daysAgo: 14 },
  { agentId: "a-ceo-video", type: "dislike",
    comment: { ja: "音声のトーンが想定より明るすぎた。落ち着いたトーンを選択肢に。", en: "Voice tone was too upbeat. Please add a calmer option." },
    userPreview: { ja: "リコール対応の社内向け動画", en: "Internal video on recall response" }, daysAgo: 30 },
  { agentId: "a-ceo-video", type: "like",
    userPreview: { ja: "Investor Day オープニング", en: "Investor Day opening" }, daysAgo: 38 },
  { agentId: "a-ceo-video", type: "dislike",
    comment: { ja: "英語版の発音に違和感があり、ネイティブチェックが必要。", en: "English pronunciation was off; needs native review." },
    userPreview: { ja: "ESG レポート動画 (英語)", en: "ESG report video (English)" }, daysAgo: 65 },
  { agentId: "a-ceo-video", type: "like",
    userPreview: { ja: "新中計発表動画", en: "New mid-term plan announcement video" }, daysAgo: 78 },
  { agentId: "a-ceo-video", type: "dislike",
    comment: { ja: "動画長が指定よりも短くなった。", en: "Output duration was shorter than specified." },
    userPreview: { ja: "Q2 業績動画", en: "Q2 performance video" }, daysAgo: 122 },
  { agentId: "a-ceo-video", type: "like",
    userPreview: { ja: "EV 戦略動画版", en: "EV strategy (video version)" }, daysAgo: 145 },
];

function ymKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function buildAgentFeedbackSummary(
  agentId: string,
  agentName: string,
  locale: Locale
): FeedbackSummary {
  const entries: FeedbackEntry[] = [];

  // Synthetic entries
  for (let i = 0; i < SYNTHETIC_FEEDBACK.length; i++) {
    const s = SYNTHETIC_FEEDBACK[i];
    if (s.agentId !== agentId) continue;
    const d = new Date(Date.now() - s.daysAgo * 86_400_000);
    entries.push({
      messageId: `syn-${agentId}-${i}`,
      conversationId: `syn-c-${agentId}-${i}`,
      type: s.type,
      comment: s.comment ? s.comment[locale] : undefined,
      createdAt: d.toISOString(),
      userPreview: s.userPreview[locale],
    });
  }

  // Real (in-session) feedback wins on top
  for (const c of state.conversations) {
    if (c.agentId !== agentId) continue;
    for (const m of c.messages) {
      if (!m.feedback) continue;
      const idx = c.messages.indexOf(m);
      const prevUser = [...c.messages.slice(0, idx)].reverse().find((x) => x.role === "user");
      entries.push({
        messageId: m.id,
        conversationId: c.id,
        type: m.feedback.type,
        comment: m.feedback.comment,
        createdAt: m.feedback.createdAt,
        userPreview: prevUser?.content.slice(0, 60) ?? "",
      });
    }
  }

  entries.sort((x, y) => (y.createdAt > x.createdAt ? 1 : -1));

  // Build last 12 months (oldest → newest). UI may slice to a smaller window.
  const monthlyMap = new Map<string, { like: number; dislike: number }>();
  const now = new Date();
  const months: string[] = [];
  for (let k = 11; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const key = ymKey(d);
    months.push(key);
    monthlyMap.set(key, { like: 0, dislike: 0 });
  }

  let likeCount = 0;
  let dislikeCount = 0;
  for (const e of entries) {
    if (e.type === "like") likeCount++;
    else dislikeCount++;
    const key = ymKey(new Date(e.createdAt));
    const cell = monthlyMap.get(key);
    if (cell) {
      if (e.type === "like") cell.like++;
      else cell.dislike++;
    }
  }

  const monthly: FeedbackMonthly[] = months.map((m) => ({
    month: m,
    like: monthlyMap.get(m)!.like,
    dislike: monthlyMap.get(m)!.dislike,
  }));

  return {
    agentId,
    agentName,
    likeCount,
    dislikeCount,
    monthly,
    recent: entries,
  };
}

function generateAgentReply(agentId: string, prompt: string, locale: Locale): string {
  const a = agents.find((x) => x.id === agentId);
  if (!a) {
    return locale === "en"
      ? "(Mock) Sorry, agent not found."
      : "（モック）すみません、エージェントが見つかりませんでした。";
  }
  const snip = prompt.slice(0, locale === "en" ? 50 : 30);
  if (a.kind === "ceo_chatbot") {
    return locale === "en"
      ? `Regarding "${snip}" — let me organize this.\n\nReferring to the mid-term plan and past board meeting notes, the key points are:\n\n1. Strategic impact — alignment with the corporate mid-term plan\n2. Key risks — short-term / mid-term separately\n3. Recommended actions — 3 options with priority\n\nReferences: "Mid-term Plan 2026", "Q4 Board Meeting Notes"`
      : `「${snip}」についてのご質問ですね。\n\n中期経営計画と過去の議事録を参照して整理すると以下の論点になります:\n\n1. 戦略的インパクト — 全社中期計画との整合\n2. 主要リスク — 短期 / 中期それぞれ\n3. 推奨アクション — 3つの選択肢と優先度\n\n参照ナレッジ: 「中期経営計画2026」「Q4 経営会議議事録」`;
  }
  if (a.kind === "general") {
    return locale === "en"
      ? `Regarding "${snip}" — I'll answer as a general-purpose assistant.\n\nKey points:\n• Clarify the assumptions\n• Hints to relevant internal resources / data sources\n• 2–3 likely next actions\n\nFor more specifics, please share the target department, period, or KPI.`
      : `「${snip}」について、汎用アシスタントとしてお答えします。\n\n要点:\n• 前提条件の整理\n• 関連する社内リソース・データソースへの示唆\n• 想定される次のアクション 2〜3件\n\nさらに具体化したい場合は、対象の部門・期間・KPI などを教えてください。`;
  }
  return locale === "en"
    ? `To generate a video, use the "CEO Video Generator" form on the left to specify the script, language, and avatar. You can refine via chat once it's generated.`
    : `動画生成は左の「CEO 動画生成」フォームから台本・言語・アバターを指定して開始してください。生成後はチャットで微調整できます。`;
}

export const handlers = [
  // Auth
  http.post("/api/v1/auth/login", async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    await delay(300);
    const u = state.users.find((x) => x.email === body.email && !x.disabled);
    const ok = u && credentials[body.email] === body.password;
    if (!ok) {
      state.loginEvents.unshift({
        id: uid("le-"),
        userId: "u-unknown",
        email: body.email,
        event: "login_failed",
        ip: "10.0.0.99",
        ts: new Date().toISOString(),
      });
      return new HttpResponse(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
    }
    state.loginEvents.unshift({
      id: uid("le-"),
      userId: u!.id,
      email: u!.email,
      event: "login",
      ip: "10.0.0.42",
      ts: new Date().toISOString(),
    });
    return HttpResponse.json({ user: u });
  }),

  http.post("/api/v1/auth/logout", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { userId?: string };
    await delay(100);
    if (body.userId) {
      const u = state.users.find((x) => x.id === body.userId);
      if (u) {
        state.loginEvents.unshift({
          id: uid("le-"),
          userId: u.id,
          email: u.email,
          event: "logout",
          ip: "10.0.0.42",
          ts: new Date().toISOString(),
        });
      }
    }
    return HttpResponse.json({ ok: true });
  }),

  // Agents
  http.get("/api/v1/agents", async ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    const q = url.searchParams.get("q") ?? "";
    const includeHidden = url.searchParams.get("includeHidden") === "1";
    const locale = pickLocale(request);
    await delay(120);
    const localized = resolveAgents(locale);
    const filtered = localized.filter((a) => {
      if (a.hidden && !includeHidden) return false;
      const matchesQ =
        !q ||
        a.name.toLowerCase().includes(q.toLowerCase()) ||
        a.description.toLowerCase().includes(q.toLowerCase());
      if (!matchesQ) return false;
      if (!userId) return true;
      const u = state.users.find((x) => x.id === userId);
      if (!u) return false;
      if (u.role === "admin") return true;
      const p = state.access[a.id]?.[u.id];
      const deptOK = state.deptAccess[a.id]?.includes(u.department);
      return Boolean(p) || Boolean(deptOK);
    });
    return HttpResponse.json({ agents: filtered });
  }),

  http.get("/api/v1/agents/:id", async ({ params, request }) => {
    await delay(100);
    const locale = pickLocale(request);
    const a = resolveAgents(locale).find((x) => x.id === params.id);
    if (!a) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(a);
  }),

  // Permissions
  http.get("/api/v1/agents/:id/permissions", async ({ params }) => {
    await delay(120);
    const id = String(params.id);
    return HttpResponse.json({
      perUser: state.access[id] ?? {},
      byDepartment: state.deptAccess[id] ?? [],
      avatarPermissions: id === "a-ceo-video" ? state.avatarPermissions : null,
      avatars: id === "a-ceo-video" ? AVATARS : null,
      users: state.users,
    });
  }),

  // Share an agent with an existing user by email (admin-only flow in Q1)
  http.post("/api/v1/agents/:id/share", async ({ request, params }) => {
    const id = String(params.id);
    const body = (await request.json()) as { email: string; permission: AgentPermission };
    await delay(180);
    const u = state.users.find(
      (x) => x.email.toLowerCase() === body.email.trim().toLowerCase() && !x.disabled
    );
    if (!u) {
      return new HttpResponse(JSON.stringify({ error: "User not found" }), { status: 404 });
    }
    if (u.role === "admin") {
      // Admin already has implicit access
      return HttpResponse.json({ ok: true, userId: u.id, userName: u.name });
    }
    const grant: AgentPermission = body.permission === "OWNER" ? "OWNER" : "VIEW";
    if (!state.access[id]) state.access[id] = {};
    state.access[id][u.id] = grant;
    return HttpResponse.json({ ok: true, userId: u.id, userName: u.name });
  }),

  http.put("/api/v1/agents/:id/permissions", async ({ request, params }) => {
    const id = String(params.id);
    const body = (await request.json()) as {
      perUser?: Record<string, AgentPermission>;
      byDepartment?: string[];
      avatarPermissions?: AvatarPermissions;
    };
    await delay(180);
    if (body.perUser) state.access[id] = body.perUser;
    if (body.byDepartment) state.deptAccess[id] = body.byDepartment;
    if (body.avatarPermissions && id === "a-ceo-video") state.avatarPermissions = body.avatarPermissions;
    return HttpResponse.json({ ok: true });
  }),

  // Avatar permissions for current user (CEO Video) — used by VideoGenForm
  http.get("/api/v1/agents/a-ceo-video/avatars", async ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") ?? "";
    await delay(80);
    const u = state.users.find((x) => x.id === userId);
    if (!u) return HttpResponse.json({ avatars: [] });
    if (u.role === "admin") return HttpResponse.json({ avatars: AVATARS });
    const allowed = state.avatarPermissions[userId] ?? [];
    return HttpResponse.json({ avatars: AVATARS.filter((a) => allowed.includes(a.id)) });
  }),

  // Conversations
  http.get("/api/v1/conversations", async ({ request }) => {
    await delay(100);
    const locale = pickLocale(request);
    const sorted = [...state.conversations]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((c) => resolveConversationLocale(c, locale));
    return HttpResponse.json({ conversations: sorted });
  }),

  http.get("/api/v1/conversations/:id", async ({ params, request }) => {
    await delay(100);
    const locale = pickLocale(request);
    const c = state.conversations.find((x) => x.id === params.id);
    if (!c) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(resolveConversationLocale(c, locale));
  }),

  http.post("/api/v1/conversations", async ({ request }) => {
    const body = (await request.json()) as { agentId: string; title?: string };
    const locale = pickLocale(request);
    await delay(100);
    const defaultTitle = locale === "en" ? "New chat" : "新しいチャット";
    const c: Conversation = {
      id: uid("c-"),
      agentId: body.agentId,
      title: body.title ?? defaultTitle,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    state.conversations.unshift(c);
    return HttpResponse.json(c, { status: 201 });
  }),

  http.delete("/api/v1/conversations/:id", async ({ params }) => {
    await delay(100);
    state.conversations = state.conversations.filter((x) => x.id !== params.id);
    return HttpResponse.json({ ok: true });
  }),

  http.post("/api/v1/conversations/:id/messages", async ({ request, params }) => {
    const cid = String(params.id);
    const body = (await request.json()) as Partial<Message>;
    const locale = pickLocale(request);
    await delay(60);
    const c = state.conversations.find((x) => x.id === cid);
    if (!c) return new HttpResponse(null, { status: 404 });
    const m: Message = {
      id: uid("m-"),
      role: body.role ?? "user",
      content: body.content ?? "",
      attachments: body.attachments,
      createdAt: new Date().toISOString(),
      status: body.status,
      videoOutput: body.videoOutput,
    };
    c.messages.push(m);
    c.updatedAt = m.createdAt;
    if (c.messages.length === 1 && body.role === "user") {
      const fallback = locale === "en" ? "New chat" : "新しいチャット";
      c.title = (body.content ?? "").slice(0, 30) || fallback;
    }
    return HttpResponse.json(m, { status: 201 });
  }),

  // SSE Streaming
  http.post("/api/v1/agents/:agentId/respond", async ({ request, params }) => {
    const body = (await request.json()) as { conversationId: string; prompt: string };
    const aid = String(params.agentId);
    const locale = pickLocale(request);
    const reply = generateAgentReply(aid, body.prompt, locale);
    return streamResponse(reply);
  }),

  // CEO Video generation
  http.post("/api/v1/agents/a-ceo-video/video", async ({ request }) => {
    const body = (await request.json()) as {
      conversationId: string;
      script: string;
      language: "ja" | "en";
      avatar: string;
    };
    const locale = pickLocale(request);
    await delay(2200);
    const c = state.conversations.find((x) => x.id === body.conversationId);
    const langLabel =
      locale === "en"
        ? body.language === "ja"
          ? "Japanese"
          : "English"
        : body.language === "ja"
        ? "日本語"
        : "English";
    const content =
      locale === "en"
        ? `Video generated (Language: ${langLabel} / Avatar: ${body.avatar}). You can refine or regenerate via chat.`
        : `動画を生成しました（言語: ${langLabel} / アバター: ${body.avatar}）。チャットで微調整・再生成の指示を出せます。`;
    const m: Message = {
      id: uid("m-"),
      role: "assistant",
      content,
      createdAt: new Date().toISOString(),
      status: "complete",
      videoOutput: {
        url: "/mock-video.mp4",
        thumbnailUrl: "",
        durationSec: Math.max(20, Math.min(120, body.script.length / 4)),
        language: body.language,
        avatar: body.avatar,
      },
    };
    if (c) {
      c.messages.push(m);
      c.updatedAt = m.createdAt;
    }
    return HttpResponse.json(m, { status: 201 });
  }),

  // Knowledge Base
  http.get("/api/v1/agents/:id/knowledge", async ({ params }) => {
    await delay(100);
    return HttpResponse.json({ docs: state.kbDocs[String(params.id)] ?? [] });
  }),

  http.post("/api/v1/agents/:id/knowledge", async ({ request, params }) => {
    const id = String(params.id);
    const body = (await request.json()) as {
      name: string;
      size: number;
      retentionMonths?: number;
    };
    await delay(400);
    if (body.size > 50 * 1024 * 1024) {
      return new HttpResponse(JSON.stringify({ error: "File too large" }), { status: 413 });
    }
    const retentionMonths = Math.max(1, Math.min(36, body.retentionMonths ?? 12));
    const uploadedAt = new Date();
    const expiresAt = new Date(uploadedAt.getTime() + retentionMonths * 30 * 86400_000);
    const doc: KnowledgeDoc = {
      id: uid("kb-"),
      name: body.name,
      size: body.size,
      uploadedAt: uploadedAt.toISOString(),
      retentionMonths,
      expiresAt: expiresAt.toISOString(),
    };
    state.kbDocs[id] = [doc, ...(state.kbDocs[id] ?? [])];
    return HttpResponse.json(doc, { status: 201 });
  }),

  http.delete("/api/v1/agents/:id/knowledge/:docId", async ({ params }) => {
    const id = String(params.id);
    const docId = String(params.docId);
    await delay(120);
    state.kbDocs[id] = (state.kbDocs[id] ?? []).filter((d) => d.id !== docId);
    return HttpResponse.json({ ok: true });
  }),

  // Admin
  http.get("/api/v1/admin/system-health", async () => {
    await delay(150);
    return HttpResponse.json(generateHealth());
  }),

  http.get("/api/v1/admin/login-events", async () => {
    await delay(120);
    return HttpResponse.json({ events: state.loginEvents.slice(0, 30) });
  }),

  // Feedback (user submits like/dislike on a specific assistant message)
  http.post(
    "/api/v1/conversations/:cid/messages/:mid/feedback",
    async ({ request, params }) => {
      const cid = String(params.cid);
      const mid = String(params.mid);
      const body = (await request.json()) as { type: "like" | "dislike"; comment?: string };
      await delay(120);
      const c = state.conversations.find((x) => x.id === cid);
      if (!c) return new HttpResponse(null, { status: 404 });
      const m = c.messages.find((x) => x.id === mid);
      if (!m) return new HttpResponse(null, { status: 404 });
      m.feedback = {
        type: body.type,
        comment: body.comment,
        createdAt: new Date().toISOString(),
      };
      return HttpResponse.json(m);
    }
  ),

  // Users (admin CRUD)
  http.get("/api/v1/users", async () => {
    await delay(100);
    return HttpResponse.json({ users: state.users.map(withAgentAccess) });
  }),

  // Update a user's agent-access map (Record<agentId, "OWNER" | "VIEW">).
  http.put("/api/v1/users/:id/agent-access", async ({ request, params }) => {
    const id = String(params.id);
    const body = (await request.json()) as {
      access: Record<string, "OWNER" | "VIEW">;
    };
    await delay(120);
    const u = state.users.find((x) => x.id === id);
    if (!u) return new HttpResponse(null, { status: 404 });
    if (u.role === "admin") {
      return HttpResponse.json(withAgentAccess(u));
    }
    // Reset this user's grants across all visible agents, then re-add per body
    for (const agentId of Object.keys(state.access)) {
      const a = agents.find((x) => x.id === agentId);
      if (!a || a.hidden) continue;
      if (state.access[agentId][id]) delete state.access[agentId][id];
    }
    for (const [agentId, perm] of Object.entries(body.access ?? {})) {
      if (perm !== "OWNER" && perm !== "VIEW") continue;
      if (!state.access[agentId]) state.access[agentId] = {};
      state.access[agentId][id] = perm;
    }
    return HttpResponse.json(withAgentAccess(u));
  }),

  // Bulk grant by department: applies the same permission to N agents for all
  // matching users. Optionally also updates global role.
  http.post("/api/v1/admin/bulk-grant", async ({ request }) => {
    const body = (await request.json()) as {
      department: string;
      agentIds?: string[];
      permission?: "OWNER" | "VIEW";
      role?: User["role"];
    };
    await delay(180);
    const targets = state.users.filter((u) => u.department === body.department);
    if (body.role) {
      for (const u of targets) {
        if (u.id === "u-admin" && body.role !== "admin") continue;
        u.role = body.role;
      }
    }
    const targetAgentIds =
      body.agentIds && body.agentIds.length > 0
        ? body.agentIds
        : agents.filter((a) => !a.hidden).map((a) => a.id);
    const grant: "OWNER" | "VIEW" = body.permission ?? "VIEW";
    for (const agentId of targetAgentIds) {
      if (!state.access[agentId]) state.access[agentId] = {};
      for (const u of targets) {
        if (u.role === "admin") continue;
        state.access[agentId][u.id] = grant;
      }
    }
    return HttpResponse.json({ ok: true, granted: targets.length });
  }),

  // Aggregated feedback summary across all agents
  http.get("/api/v1/admin/feedback", async ({ request }) => {
    await delay(150);
    const locale = pickLocale(request);
    const localizedAgents = resolveAgents(locale);
    const summaries: FeedbackSummary[] = localizedAgents
      .filter((a) => !a.hidden)
      .map((a) => buildAgentFeedbackSummary(a.id, a.name, locale));
    return HttpResponse.json({ summaries });
  }),

  http.post("/api/v1/users", async ({ request }) => {
    const body = (await request.json()) as Omit<User, "id">;
    await delay(180);
    const u: User = { id: uid("u-"), ...body };
    state.users.push(u);
    return HttpResponse.json(u, { status: 201 });
  }),

  http.put("/api/v1/users/:id", async ({ request, params }) => {
    const id = String(params.id);
    const body = (await request.json()) as Partial<User>;
    await delay(150);
    state.users = state.users.map((u) => (u.id === id ? { ...u, ...body, id } : u));
    return HttpResponse.json(state.users.find((u) => u.id === id));
  }),

  http.delete("/api/v1/users/:id", async ({ params }) => {
    await delay(120);
    state.users = state.users.filter((u) => u.id !== String(params.id));
    return HttpResponse.json({ ok: true });
  }),
];
