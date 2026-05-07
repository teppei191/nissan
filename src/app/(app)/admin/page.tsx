"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuth } from "@/stores/auth";
import { useLocale } from "@/stores/locale";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ChevronIcon, PlusIcon, SparkleIcon } from "@/components/icons";
import { AgentMultiSelect } from "@/components/AgentMultiSelect";
import { AgentAccessSelector } from "@/components/AgentAccessSelector";
import type { Agent, FeedbackSummary, Role, User } from "@/types";

type Permission = "OWNER" | "VIEW";

const DEPARTMENTS = [
  "Executive",
  "Sales",
  "Marketing",
  "Finance",
  "Engineering",
  "MarketIntelligence",
  "Legal",
  "HR",
];


type Tab = "users" | "feedback";

export default function AdminPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const locale = useLocale((s) => s.locale);
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>("users");
  const [showAddUser, setShowAddUser] = useState(false);

  useEffect(() => {
    if (user && user.role !== "admin") router.replace("/");
  }, [user, router]);

  const usersQ = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.get<{ users: User[] }>("/users"),
  });
  const agentsQ = useQuery({
    queryKey: ["all-agents"],
    queryFn: () => api.get<{ agents: Agent[] }>("/agents"),
  });
  const feedbackQ = useQuery({
    queryKey: ["admin-feedback"],
    queryFn: () => api.get<{ summaries: FeedbackSummary[] }>("/admin/feedback"),
    enabled: tab === "feedback",
    refetchInterval: 60_000,
  });

  async function handleUpdateUser(u: User, patch: Partial<User>) {
    await api.put<Partial<User>, User>(`/users/${u.id}`, patch);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["agents"] });
  }

  async function handleAddUser(form: Omit<User, "id">) {
    await api.post<Omit<User, "id">, User>("/users", form);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    setShowAddUser(false);
  }

  async function handleSetUserAccess(
    userId: string,
    access: Record<string, Permission>
  ) {
    await api.put<{ access: Record<string, Permission> }, User>(
      `/users/${userId}/agent-access`,
      { access }
    );
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["agents"] });
  }

  async function handleBulkGrant(department: string, agentIds: string[]) {
    await api.post<
      { department: string; agentIds: string[]; permission: Permission },
      { ok: boolean; granted: number }
    >("/admin/bulk-grant", {
      department,
      agentIds,
      permission: "VIEW",
    });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["agents"] });
  }

  const users = usersQ.data?.users ?? [];
  const agents = agentsQ.data?.agents ?? [];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-brand)" }}>
          {t("admin", locale)}
        </h1>
        <p className="text-sm text-[var(--text-tertiary)]">
          {locale === "ja"
            ? "ユーザー管理とフィードバック確認。"
            : "User management and feedback review."}
        </p>
      </header>

      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: "var(--border-default)" }}>
        {(
          [
            { id: "users", label: t("userManagement", locale) },
            { id: "feedback", label: t("feedback", locale) },
          ] as const
        ).map((tt) => (
          <button
            key={tt.id}
            onClick={() => setTab(tt.id)}
            className={cn(
              "px-3 h-10 text-sm font-medium border-b-2 -mb-[1px] transition-colors",
              tab === tt.id
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border-transparent"
            )}
            style={
              tab === tt.id
                ? { borderColor: "var(--color-red-50)" }
                : { borderColor: "transparent" }
            }
          >
            {tt.label}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <section>
          {agents.length > 0 && (
            <BulkGrantBar agents={agents} onApply={handleBulkGrant} />
          )}

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold" style={{ fontFamily: "var(--font-brand)" }}>
              {t("userManagement", locale)} ({users.length})
            </h2>
            <button
              onClick={() => setShowAddUser(true)}
              className="h-9 px-3 rounded-md text-sm font-medium text-[var(--text-contrast)] inline-flex items-center gap-1.5"
              style={{ background: "var(--color-red-50)", fontFamily: "var(--font-brand)" }}
            >
              <PlusIcon size={14} />
              {t("addUser", locale)}
            </button>
          </div>

          <div
            className="border rounded-lg overflow-hidden"
            style={{ borderColor: "var(--border-default)" }}
          >
            <table className="w-full text-sm">
              <thead style={{ background: "var(--bg-subtle)" }}>
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium text-[var(--text-secondary)]">
                    {t("name", locale)}
                  </th>
                  <th className="px-3 py-2 font-medium text-[var(--text-secondary)] w-40">
                    {t("role", locale)}
                  </th>
                  <th className="px-3 py-2 font-medium text-[var(--text-secondary)] w-44">
                    {t("department", locale)}
                  </th>
                  <th className="px-3 py-2 font-medium text-[var(--text-secondary)]">
                    {t("agentsColumn", locale)}
                  </th>
                  <th className="px-3 py-2 font-medium text-[var(--text-secondary)] w-28">
                    {t("status", locale)}
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr
                    key={u.id}
                    className={i > 0 ? "border-t" : ""}
                    style={{ borderColor: "var(--border-light)" }}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-[var(--text-tertiary)]">{u.email}</div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={u.role}
                        disabled={u.id === user?.id}
                        onChange={(e) =>
                          handleUpdateUser(u, { role: e.target.value as Role })
                        }
                        className="h-9 w-full px-2 rounded-md border text-sm bg-[var(--bg-default)]"
                        style={{
                          borderColor: "var(--border-default)",
                          color: "var(--text-primary)",
                        }}
                      >
                        <option value="admin">admin</option>
                        <option value="user">user</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={u.department}
                        onChange={(e) =>
                          handleUpdateUser(u, { department: e.target.value })
                        }
                        className="h-9 w-full px-2 rounded-md border text-sm bg-[var(--bg-default)]"
                        style={{
                          borderColor: "var(--border-default)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <AgentAccessCell
                        user={u}
                        agents={agents}
                        onChange={(ids) => handleSetUserAccess(u.id, ids)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() =>
                          handleUpdateUser(u, { disabled: !u.disabled })
                        }
                        disabled={u.id === user?.id}
                        className="text-2xs uppercase font-bold px-2 py-1 rounded disabled:opacity-50"
                        style={
                          u.disabled
                            ? {
                                background: "var(--bg-emphasized)",
                                color: "var(--text-secondary)",
                              }
                            : {
                                background: "var(--green-subtle)",
                                color: "var(--green-emphasized)",
                              }
                        }
                        title={u.disabled ? t("activate", locale) : t("inactivate", locale)}
                      >
                        {u.disabled ? t("inactive", locale) : t("active", locale)}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showAddUser && (
            <AddUserModal
              onClose={() => setShowAddUser(false)}
              onSubmit={handleAddUser}
            />
          )}
        </section>
      )}

      {tab === "feedback" && (
        <FeedbackPanel
          summaries={feedbackQ.data?.summaries ?? []}
          loading={feedbackQ.isLoading}
        />
      )}
      </div>
    </div>
  );
}

function AgentAccessCell({
  user,
  agents,
  onChange,
}: {
  user: User;
  agents: Agent[];
  onChange: (access: Record<string, "OWNER" | "VIEW">) => void;
}) {
  const locale = useLocale((s) => s.locale);
  if (user.role === "admin") {
    return (
      <span
        className="inline-block text-2xs uppercase font-bold px-2 py-1 rounded"
        style={{
          background: "var(--bg-emphasized)",
          color: "var(--text-secondary)",
        }}
        title={
          locale === "ja"
            ? "管理者は全エージェントへ自動アクセス"
            : "Admin has implicit access to all"
        }
      >
        {t("allAgents", locale)}
      </span>
    );
  }
  const access = user.agentAccess ?? {};
  return (
    <AgentAccessSelector
      agents={agents}
      value={access}
      onChange={onChange}
      size="sm"
    />
  );
}

function BulkGrantBar({
  agents,
  onApply,
}: {
  agents: Agent[];
  onApply: (department: string, agentIds: string[]) => Promise<void>;
}) {
  const locale = useLocale((s) => s.locale);
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [agentIds, setAgentIds] = useState<string[]>(() => agents.map((a) => a.id));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    setAgentIds((prev) => (prev.length === 0 ? agents.map((a) => a.id) : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents.length]);

  async function apply() {
    if (agentIds.length === 0) return;
    setBusy(true);
    setDone(null);
    try {
      await onApply(department, agentIds);
      setDone(Date.now());
      setTimeout(() => setDone(null), 2200);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="mb-5 p-3 rounded-lg border"
      style={{
        background: "var(--bg-subtle)",
        borderColor: "var(--border-default)",
      }}
    >
      <div className="text-2xs uppercase tracking-wide text-[var(--text-tertiary)] mb-2 font-medium">
        {t("bulkGrantSimple", locale)}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t("department", locale)}>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="h-9 px-2 rounded-md border text-sm bg-[var(--bg-default)]"
            style={{ borderColor: "var(--border-default)" }}
          >
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>
        <span className="text-[var(--text-tertiary)] text-sm pb-2">×</span>
        <Field label={t("agentsColumn", locale)}>
          <AgentMultiSelect
            agents={agents}
            selected={agentIds}
            onChange={setAgentIds}
            emptyLabel={locale === "ja" ? "未選択" : "None"}
          />
        </Field>
        <button
          onClick={apply}
          disabled={busy || agentIds.length === 0}
          className="h-9 px-4 rounded-md text-sm font-medium text-[var(--text-contrast)] disabled:opacity-50"
          style={{ background: "var(--color-red-50)", fontFamily: "var(--font-brand)" }}
        >
          {busy ? "..." : t("applyBulk", locale)}
        </button>
        {done && (
          <span className="text-xs pb-2" style={{ color: "var(--green-emphasized)" }}>
            ✓ {t("saved", locale)}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-[var(--text-tertiary)]">
        {t("bulkGrantViewerNote", locale)}
      </p>
    </div>
  );
}

const DEFAULT_FEEDBACK_AGENT_ID = "a-ceo-chatbot";
type MonthRange = 3 | 6 | 12;

function FeedbackPanel({
  summaries,
  loading,
}: {
  summaries: FeedbackSummary[];
  loading: boolean;
}) {
  const locale = useLocale((s) => s.locale);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [monthRange, setMonthRange] = useState<MonthRange>(6);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(DEFAULT_FEEDBACK_AGENT_ID);

  // Reset selection if the agent disappears from summaries
  useEffect(() => {
    if (
      summaries.length > 0 &&
      !summaries.some((s) => s.agentId === selectedAgentId)
    ) {
      setSelectedAgentId(summaries[0].agentId);
    }
  }, [summaries, selectedAgentId]);

  const summary = summaries.find((s) => s.agentId === selectedAgentId);

  if (loading) return <div className="text-sm text-[var(--text-tertiary)]">...</div>;
  if (!summary) {
    return (
      <div className="text-sm text-[var(--text-tertiary)]">{t("noFeedbackYet", locale)}</div>
    );
  }

  const monthly = summary.monthly.slice(-monthRange);
  const total = summary.likeCount + summary.dislikeCount;
  const positivePct = total === 0 ? 0 : Math.round((summary.likeCount * 100) / total);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-bold" style={{ fontFamily: "var(--font-brand)" }}>
            {summary.agentName}
            <span className="text-[var(--text-tertiary)] ml-1 font-normal">
              · {t("feedback", locale)}
            </span>
          </h2>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            {t("feedbackSummary", locale)}
          </p>
        </div>
        {summaries.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-2xs uppercase tracking-wide text-[var(--text-tertiary)]">
              {t("filterByAgent", locale)}
            </span>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="h-9 px-2.5 rounded-md border text-sm bg-[var(--bg-default)]"
              style={{ borderColor: "var(--border-default)" }}
            >
              {summaries.map((s) => (
                <option key={s.agentId} value={s.agentId}>
                  {s.agentName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Trend chart with month-range pill */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-bold" style={{ fontFamily: "var(--font-brand)" }}>
            {t("feedbackTrend", locale)}
          </div>
          <MonthRangePill value={monthRange} onChange={setMonthRange} />
        </div>
        <div
          className="border rounded-lg p-4"
          style={{ borderColor: "var(--border-default)", background: "var(--bg-default)" }}
        >
          <TrendChart data={monthly} />
        </div>
      </section>

      {/* Summary tiles */}
      <section>
        <div className="text-sm font-bold mb-2" style={{ fontFamily: "var(--font-brand)" }}>
          {t("feedbackSummary", locale)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <CountTile label={t("feedbackLike", locale)} value={summary.likeCount} tone="green" />
          <CountTile label={t("feedbackDislike", locale)} value={summary.dislikeCount} tone="orange" />
          <CountTile label={t("totalCount", locale)} value={total} tone="green" />
          <CountTile
            label={locale === "ja" ? "ポジ率 (%)" : "Positive %"}
            value={positivePct}
            tone="green"
          />
        </div>
      </section>

      {/* AI summary card (above dislike list) */}
      <AiSummaryCard items={summary.recent.filter((r) => r.type === "dislike")} />

      {/* Dislike list (paginated, with inline-expand detail) */}
      <DislikeFeedbackList
        items={summary.recent.filter((r) => r.type === "dislike")}
        expandedId={expandedId}
        onToggle={(id) => setExpandedId((prev) => (prev === id ? null : id))}
      />
    </div>
  );
}

const DISLIKE_THEMES: {
  key: "themeSource" | "themeUnits" | "themeFreshness" | "themeFormat" | "themeLength";
  patterns: RegExp[];
}[] = [
  { key: "themeSource", patterns: [/出典|参照|page|ソース|議事録|引/i] },
  { key: "themeUnits", patterns: [/数値|単位|億|百万|円|%/i] },
  { key: "themeFreshness", patterns: [/古い|最新|前年|更新|stale/i] },
  { key: "themeFormat", patterns: [/excel|形式|フォーマット|出力|csv/i] },
  { key: "themeLength", patterns: [/長すぎ|長い|要点|短い|具体|抽象/i] },
];

type ThemeBucket = {
  key: string;
  count: number;
  example: FeedbackSummary["recent"][number];
};

function deriveDislikeThemes(items: FeedbackSummary["recent"]) {
  const dislikes = items.filter((e) => e.type === "dislike" && e.comment);
  const buckets = new Map<string, ThemeBucket>();
  let othersCount = 0;
  let othersExample: FeedbackSummary["recent"][number] | null = null;
  for (const e of dislikes) {
    let matched = false;
    for (const t of DISLIKE_THEMES) {
      if (t.patterns.some((p) => p.test(e.comment ?? ""))) {
        const cur = buckets.get(t.key);
        if (!cur) buckets.set(t.key, { key: t.key, count: 1, example: e });
        else cur.count += 1;
        matched = true;
      }
    }
    if (!matched) {
      othersCount += 1;
      if (!othersExample) othersExample = e;
    }
  }
  const sorted = Array.from(buckets.values()).sort((a, b) => b.count - a.count);
  return { sorted, othersCount, othersExample, total: dislikes.length };
}

function AiSummaryCard({ items }: { items: FeedbackSummary["recent"] }) {
  const locale = useLocale((s) => s.locale);
  const { sorted, othersCount, othersExample, total } = deriveDislikeThemes(items);
  const [popupEntry, setPopupEntry] = useState<FeedbackSummary["recent"][number] | null>(null);

  return (
    <>
      <section>
        <div className="text-sm font-bold mb-2" style={{ fontFamily: "var(--font-brand)" }}>
          {t("aiSummaryHeader", locale)}
        </div>
        <div
          className="rounded-lg border p-4"
          style={{
            background: "var(--blue-subtle)",
            borderColor: "var(--blue-muted)",
            color: "var(--text-primary)",
          }}
        >
          <div className="flex items-center gap-1.5 mb-3">
            <span style={{ color: "var(--blue-emphasized)" }}>
              <SparkleIcon size={14} />
            </span>
            <span
              className="text-2xs uppercase tracking-wider font-bold"
              style={{ color: "var(--blue-emphasized)" }}
            >
              {t("aiSummaryBadge", locale)}
            </span>
          </div>
          {total === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">
              {t("aiSummaryEmpty", locale)}
            </p>
          ) : (
            <>
              <p className="text-sm text-[var(--text-secondary)] mb-3">
                {total}
                {t("aiSummaryItemCount", locale)}
                {t("aiSummaryIntro", locale)}
              </p>
              <ul className="text-sm space-y-2">
                {sorted.map((b) => (
                  <ThemeBulletRow
                    key={b.key}
                    label={t(b.key as Parameters<typeof t>[0], locale)}
                    count={b.count}
                    example={b.example}
                    onOpen={() => setPopupEntry(b.example)}
                    bulletColor="var(--blue-emphasized)"
                  />
                ))}
                {othersCount > 0 && (
                  <ThemeBulletRow
                    label={t("themeOther", locale)}
                    count={othersCount}
                    example={othersExample ?? null}
                    onOpen={() => othersExample && setPopupEntry(othersExample)}
                    bulletColor="var(--text-tertiary)"
                    muted
                  />
                )}
              </ul>
            </>
          )}
        </div>
      </section>
      {popupEntry && (
        <CommentPopup entry={popupEntry} onClose={() => setPopupEntry(null)} />
      )}
    </>
  );
}

function ThemeBulletRow({
  label,
  count,
  example,
  onOpen,
  bulletColor,
  muted,
}: {
  label: string;
  count: number;
  example: FeedbackSummary["recent"][number] | null;
  onOpen: () => void;
  bulletColor: string;
  muted?: boolean;
}) {
  const locale = useLocale((s) => s.locale);
  const exampleLabel = locale === "ja" ? "例を見る" : "View example";
  return (
    <li
      className={cn(
        "flex items-start gap-2",
        muted ? "text-[var(--text-tertiary)]" : ""
      )}
    >
      <span
        className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: bulletColor }}
      />
      <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span>{label}</span>
        <span className="text-[var(--text-tertiary)] text-xs">
          ({count}
          {t("aiSummaryItemCount", locale)})
        </span>
        {example && (
          <button
            type="button"
            onClick={onOpen}
            className="text-xs underline decoration-dotted underline-offset-2 hover:decoration-solid"
            style={{ color: "var(--blue-emphasized)" }}
          >
            {exampleLabel} →
          </button>
        )}
      </div>
    </li>
  );
}

function CommentPopup({
  entry,
  onClose,
}: {
  entry: FeedbackSummary["recent"][number];
  onClose: () => void;
}) {
  const locale = useLocale((s) => s.locale);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-default)] rounded-lg p-5 w-full max-w-lg border shadow-lg"
        style={{ borderColor: "var(--border-default)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-[var(--text-tertiary)] mb-0.5">
              {t("feedbackDetail", locale)}
            </div>
            <h3 className="text-base font-bold" style={{ fontFamily: "var(--font-brand)" }}>
              {locale === "ja" ? "改善要望コメント" : "Improvement request"}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label={t("closeModal", locale)}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] text-lg leading-none"
          >
            ×
          </button>
        </div>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-[88px_1fr] gap-3">
            <div className="text-2xs uppercase tracking-wider text-[var(--text-tertiary)] pt-0.5">
              {t("comment", locale)}
            </div>
            <div
              className="rounded-md border p-3 whitespace-pre-wrap"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--bg-subtle)",
                color: "var(--text-primary)",
              }}
            >
              {entry.comment ?? (
                <span className="text-[var(--text-tertiary)]">
                  {t("noComment", locale)}
                </span>
              )}
            </div>
          </div>
          {entry.userPreview && (
            <div className="grid grid-cols-[88px_1fr] gap-3">
              <div className="text-2xs uppercase tracking-wider text-[var(--text-tertiary)] pt-0.5">
                {locale === "ja" ? "対象の質問" : "User prompt"}
              </div>
              <div className="text-[var(--text-secondary)] text-xs">
                {entry.userPreview}
              </div>
            </div>
          )}
          <div className="grid grid-cols-[88px_1fr] gap-3">
            <div className="text-2xs uppercase tracking-wider text-[var(--text-tertiary)] pt-0.5">
              {t("submittedAt", locale)}
            </div>
            <div className="text-[var(--text-secondary)] text-xs">
              {new Date(entry.createdAt).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 10;

function DislikeFeedbackList({
  items,
  expandedId,
  onToggle,
}: {
  items: FeedbackSummary["recent"];
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  const locale = useLocale((s) => s.locale);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));

  // Clamp page when items shrink
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (items.length === 0) {
    return (
      <section>
        <div className="text-sm font-bold mb-2" style={{ fontFamily: "var(--font-brand)" }}>
          {t("dislikeFeedbackList", locale)}
        </div>
        <div className="text-sm text-[var(--text-tertiary)]">{t("noFeedbackYet", locale)}</div>
      </section>
    );
  }

  const start = (page - 1) * PAGE_SIZE;
  const pageItems = items.slice(start, start + PAGE_SIZE);

  return (
    <section>
      <div className="text-sm font-bold mb-2" style={{ fontFamily: "var(--font-brand)" }}>
        {t("dislikeFeedbackList", locale)} ({items.length})
      </div>
      <div
        className="border rounded-lg overflow-hidden"
        style={{ borderColor: "var(--border-default)" }}
      >
        <table className="w-full text-sm">
          <thead style={{ background: "var(--bg-subtle)" }}>
            <tr className="text-left">
              <th className="px-3 py-2 font-medium text-[var(--text-secondary)] w-8"></th>
              <th className="px-3 py-2 font-medium text-[var(--text-secondary)]">
                {t("comment", locale)}
              </th>
              <th className="px-3 py-2 font-medium text-[var(--text-secondary)] w-40">
                {t("submittedAt", locale)}
              </th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((r) => {
              const open = expandedId === r.messageId;
              return (
                <FeedbackRow
                  key={r.messageId}
                  item={r}
                  open={open}
                  onToggle={() => onToggle(r.messageId)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      )}
    </section>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (next: number) => void;
}) {
  const locale = useLocale((s) => s.locale);
  // For small counts show all pages; for larger counts, show a windowed range
  const pages: (number | "ellipsis")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("ellipsis");
    const from = Math.max(2, page - 1);
    const to = Math.min(totalPages - 1, page + 1);
    for (let i = from; i <= to; i++) pages.push(i);
    if (page < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
  }

  return (
    <div className="mt-3 flex items-center justify-end gap-1">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="h-8 px-2.5 rounded-md border text-xs hover:bg-[var(--bg-muted)] disabled:opacity-40"
        style={{ borderColor: "var(--border-default)" }}
      >
        ‹ {t("prevPage", locale)}
      </button>
      {pages.map((p, i) =>
        p === "ellipsis" ? (
          <span key={`e-${i}`} className="px-1 text-[var(--text-tertiary)] text-xs">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={cn(
              "h-8 min-w-[32px] px-2 rounded-md border text-xs transition-colors",
              p === page
                ? "text-[var(--text-contrast)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
            )}
            style={{
              borderColor: p === page ? "var(--color-red-50)" : "var(--border-default)",
              background: p === page ? "var(--color-red-50)" : "var(--bg-default)",
            }}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="h-8 px-2.5 rounded-md border text-xs hover:bg-[var(--bg-muted)] disabled:opacity-40"
        style={{ borderColor: "var(--border-default)" }}
      >
        {t("nextPage", locale)} ›
      </button>
    </div>
  );
}

function FeedbackRow({
  item,
  open,
  onToggle,
}: {
  item: FeedbackSummary["recent"][number];
  open: boolean;
  onToggle: () => void;
}) {
  const locale = useLocale((s) => s.locale);
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-t hover:bg-[var(--bg-muted)]"
        style={{ borderColor: "var(--border-light)" }}
      >
        <td className="px-3 py-2 text-[var(--text-tertiary)]">
          <ChevronIcon direction={open ? "down" : "right"} size={12} />
        </td>
        <td className="px-3 py-2 truncate max-w-[560px]">
          {item.comment ?? (
            <span className="text-[var(--text-tertiary)]">{t("noComment", locale)}</span>
          )}
        </td>
        <td className="px-3 py-2 text-[var(--text-tertiary)] text-xs">
          {new Date(item.createdAt).toLocaleString()}
        </td>
      </tr>
      {open && (
        <tr
          className="border-t"
          style={{ borderColor: "var(--border-light)", background: "var(--bg-subtle)" }}
        >
          <td></td>
          <td colSpan={2} className="px-3 py-3">
            <div className="space-y-2 text-xs">
              <DetailRow label={t("comment", locale)}>
                <div
                  className="rounded-md border p-3 whitespace-pre-wrap text-sm"
                  style={{
                    borderColor: "var(--border-default)",
                    background: "var(--bg-default)",
                    color: "var(--text-primary)",
                  }}
                >
                  {item.comment ?? (
                    <span className="text-[var(--text-tertiary)]">
                      {t("noComment", locale)}
                    </span>
                  )}
                </div>
              </DetailRow>
              {item.userPreview && (
                <DetailRow label={locale === "ja" ? "対象の質問" : "User prompt"}>
                  <div className="text-[var(--text-secondary)]">{item.userPreview}</div>
                </DetailRow>
              )}
              <DetailRow label={t("submittedAt", locale)}>
                <span className="text-[var(--text-secondary)]">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </DetailRow>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3 items-start">
      <div className="text-2xs uppercase tracking-wider text-[var(--text-tertiary)] pt-0.5">
        {label}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function MonthRangePill({
  value,
  onChange,
}: {
  value: MonthRange;
  onChange: (next: MonthRange) => void;
}) {
  const locale = useLocale((s) => s.locale);
  const options: { v: MonthRange; label: string }[] = [
    { v: 3, label: t("last3Months", locale) },
    { v: 6, label: t("last6Months", locale) },
    { v: 12, label: t("last12Months", locale) },
  ];
  return (
    <div
      className="inline-flex rounded-md border overflow-hidden text-xs"
      style={{ borderColor: "var(--border-default)" }}
    >
      {options.map((o, i) => {
        const active = o.v === value;
        return (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={cn(
              "h-8 px-3 transition-colors",
              i > 0 && "border-l",
              active
                ? "text-[var(--text-contrast)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
            )}
            style={{
              borderColor: "var(--border-default)",
              background: active ? "var(--color-red-50)" : "var(--bg-default)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function TrendChart({
  data,
}: {
  data: { month: string; like: number; dislike: number }[];
}) {
  const locale = useLocale((s) => s.locale);
  if (data.length === 0)
    return (
      <div className="h-40 flex items-center justify-center text-xs text-[var(--text-tertiary)]">
        {t("noFeedbackYet", locale)}
      </div>
    );

  const max = Math.max(1, ...data.map((d) => Math.max(d.like, d.dislike)));
  // SVG chart dimensions
  const W = 720;
  const H = 200;
  const PAD_L = 32;
  const PAD_B = 28;
  const PAD_T = 12;
  const PAD_R = 16;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const groupW = innerW / data.length;
  const barW = Math.min(18, (groupW - 8) / 2);

  function y(v: number) {
    return PAD_T + innerH - (v / max) * innerH;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: "var(--green-emphasized)" }}
          />
          {t("feedbackLike", locale)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: "var(--orange-emphasized)" }}
          />
          {t("feedbackDislike", locale)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
        {/* Y axis grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
          const yy = PAD_T + innerH * (1 - p);
          const v = Math.round(max * p);
          return (
            <g key={i}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={yy}
                y2={yy}
                stroke="var(--border-light)"
                strokeDasharray={i === 0 ? "0" : "2 3"}
              />
              <text
                x={PAD_L - 6}
                y={yy + 3}
                textAnchor="end"
                fontSize="10"
                fill="var(--text-tertiary)"
              >
                {v}
              </text>
            </g>
          );
        })}
        {/* Bars */}
        {data.map((d, i) => {
          const cx = PAD_L + groupW * i + groupW / 2;
          const xLike = cx - barW - 1;
          const xDis = cx + 1;
          return (
            <g key={d.month}>
              <rect
                x={xLike}
                y={y(d.like)}
                width={barW}
                height={Math.max(0, PAD_T + innerH - y(d.like))}
                fill="var(--green-emphasized)"
                rx={2}
              />
              <rect
                x={xDis}
                y={y(d.dislike)}
                width={barW}
                height={Math.max(0, PAD_T + innerH - y(d.dislike))}
                fill="var(--orange-emphasized)"
                rx={2}
              />
              <text
                x={cx}
                y={H - PAD_B + 14}
                textAnchor="middle"
                fontSize="10"
                fill="var(--text-tertiary)"
              >
                {d.month.slice(2)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function CountTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "orange";
}) {
  const styles = useMemo(
    () =>
      ({
        green: {
          bg: "var(--green-subtle)",
          border: "var(--green-muted)",
          color: "var(--green-emphasized)",
        },
        orange: {
          bg: "var(--orange-subtle)",
          border: "var(--orange-muted)",
          color: "var(--orange-emphasized)",
        },
      } as const)[tone],
    [tone]
  );
  return (
    <div
      className="border rounded-lg px-3 py-2"
      style={{ background: styles.bg, borderColor: styles.border }}
    >
      <div className="text-2xs uppercase tracking-wide text-[var(--text-tertiary)] mb-0.5">
        {label}
      </div>
      <div
        className="text-2xl font-bold"
        style={{ color: styles.color, fontFamily: "var(--font-brand)" }}
      >
        {value}
      </div>
    </div>
  );
}

function AddUserModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (u: Omit<User, "id">) => void;
}) {
  const locale = useLocale((s) => s.locale);
  const [form, setForm] = useState<Omit<User, "id">>({
    email: "",
    name: "",
    role: "user",
    department: "Sales",
    disabled: false,
  });

  function changeDepartment(d: string) {
    setForm((f) => ({ ...f, department: d }));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-default)] rounded-lg p-5 w-full max-w-md border shadow-lg"
        style={{ borderColor: "var(--border-default)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-4" style={{ fontFamily: "var(--font-brand)" }}>
          {t("addUser", locale)}
        </h3>
        <div className="space-y-3">
          <Field label={t("name", locale)}>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full h-9 px-3 rounded-md border text-sm focus:outline-none focus:border-[var(--text-primary)]"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--bg-default)",
                color: "var(--text-primary)",
              }}
            />
          </Field>
          <Field label={t("email", locale)}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full h-9 px-3 rounded-md border text-sm focus:outline-none focus:border-[var(--text-primary)]"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--bg-default)",
                color: "var(--text-primary)",
              }}
            />
          </Field>
          <Field label={t("department", locale)}>
            <select
              value={form.department}
              onChange={(e) => changeDepartment(e.target.value)}
              className="w-full h-9 px-2 rounded-md border text-sm bg-[var(--bg-default)]"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={`${t("role", locale)} ${t("defaultRoleHint", locale)}`}
          >
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              className="w-full h-9 px-2 rounded-md border text-sm bg-[var(--bg-default)]"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <option value="admin">admin</option>
              <option value="user">user</option>
            </select>
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-9 px-3 rounded-md text-sm border hover:bg-[var(--bg-muted)]"
            style={{ borderColor: "var(--border-default)" }}
          >
            {t("cancel", locale)}
          </button>
          <button
            onClick={() => onSubmit(form)}
            disabled={!form.name || !form.email}
            className="h-9 px-4 rounded-md text-sm font-medium text-[var(--text-contrast)] disabled:opacity-50"
            style={{ background: "var(--color-red-50)", fontFamily: "var(--font-brand)" }}
          >
            {t("add", locale)}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-[var(--text-secondary)] mb-1">{label}</label>
      {children}
    </div>
  );
}
