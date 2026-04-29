"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuth } from "@/stores/auth";
import { useLocale } from "@/stores/locale";
import { t } from "@/lib/i18n";
import { formatRelative, cn } from "@/lib/utils";
import {
  AgentIcon,
  HomeIcon,
  NexusLogo,
  PanelIcon,
  PlusIcon,
  SettingsIcon,
} from "@/components/icons";
import type { Agent, Conversation } from "@/types";

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const locale = useLocale((s) => s.locale);

  const agentsQ = useQuery({
    queryKey: ["agents", user?.id],
    queryFn: () => api.get<{ agents: Agent[] }>(`/agents?userId=${user?.id ?? ""}`),
    enabled: !!user,
  });
  const convQ = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: () => api.get<{ conversations: Conversation[] }>(`/conversations?userId=${user?.id ?? ""}`),
    enabled: !!user,
  });

  async function handleLogout() {
    await api.post<{ userId: string }, { ok: boolean }>("/auth/logout", {
      userId: user?.id ?? "",
    });
    signOut();
    router.push("/login");
  }

  function startNewChat() {
    qc.invalidateQueries({ queryKey: ["conversations"] });
    router.push("/");
  }

  const agents = agentsQ.data?.agents ?? [];
  const conversations = convQ.data?.conversations ?? [];
  const activeCid = search.get("cid");

  if (collapsed) {
    return (
      <aside
        className="theme-dark w-14 shrink-0 h-screen flex flex-col items-center py-3 border-r"
        style={{
          background: "var(--bg-default)",
          borderColor: "var(--border-default)",
          color: "var(--text-primary)",
        }}
      >
        <button
          onClick={onToggle}
          aria-label={t("expand", locale)}
          className="w-9 h-9 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
        >
          <PanelIcon />
        </button>
        <button
          onClick={startNewChat}
          aria-label={t("newChat", locale)}
          className="w-9 h-9 mt-2 rounded-md flex items-center justify-center"
          style={{ background: "var(--color-red-50)", color: "var(--color-gray-0)" }}
        >
          <PlusIcon />
        </button>
        <Link
          href="/"
          aria-label="Home"
          className={cn(
            "w-9 h-9 mt-2 rounded-md flex items-center justify-center",
            pathname === "/" || pathname === "/agents/a-ceo-chatbot"
              ? "bg-[var(--bg-muted)] text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
          )}
        >
          <HomeIcon size={18} />
        </Link>
        <div className="mt-2 flex flex-col items-center gap-2 flex-1 overflow-y-auto px-1">
          {agents.map((a) => {
            const active = pathname === `/agents/${a.id}`;
            return (
              <Link
                key={a.id}
                href={`/agents/${a.id}`}
                title={a.name}
                className={cn(
                  "rounded-md p-1 transition-colors",
                  active ? "ring-2 ring-[var(--color-red-50)]" : "hover:opacity-80"
                )}
              >
                <AgentIcon agent={a} size="sm" />
              </Link>
            );
          })}
        </div>
        {user?.role === "admin" && (
          <Link
            href="/admin"
            title={t("admin", locale)}
            className={cn(
              "w-9 h-9 mb-2 rounded-md flex items-center justify-center",
              pathname === "/admin"
                ? "bg-[var(--bg-muted)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
            )}
          >
            <SettingsIcon />
          </Link>
        )}
        <button
          onClick={handleLogout}
          title={user?.name ?? "User"}
          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: "var(--color-gray-80)", color: "var(--color-gray-0)" }}
        >
          {user?.name.slice(0, 1) ?? "?"}
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="theme-dark w-64 shrink-0 h-screen flex flex-col border-r"
      style={{
        background: "var(--bg-default)",
        borderColor: "var(--border-default)",
        color: "var(--text-primary)",
      }}
    >
      {/* Brand */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ color: "var(--color-red-50)" }}>
            <NexusLogo size={20} />
          </span>
          <span
            className="font-semibold tracking-tight text-[13px] truncate"
            style={{ fontFamily: "var(--font-brand)" }}
          >
            {t("appName", locale)}
          </span>
        </div>
        <button
          onClick={onToggle}
          aria-label={t("collapse", locale)}
          className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
        >
          <PanelIcon />
        </button>
      </div>

      {/* Section: ホーム / New chat */}
      <div className="px-2 pb-2">
        <div className="px-3 pt-1 pb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-medium">
          {t("home", locale)}
        </div>
        <button
          onClick={startNewChat}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 h-9 rounded-md text-sm transition-colors",
            "text-[var(--text-primary)] hover:bg-[var(--bg-muted)] font-medium"
          )}
        >
          <HomeIcon size={16} />
          <span>{t("home", locale)}</span>
        </button>
      </div>

      {/* Agents */}
      <div className="px-2 pt-1">
        <div className="px-3 pb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-medium">
          {t("agents", locale)}
        </div>
        <nav className="space-y-0.5">
          {agents.map((a) => {
            const active = pathname === `/agents/${a.id}` || pathname.startsWith(`/agents/${a.id}/`);
            return (
              <Link
                key={a.id}
                href={`/agents/${a.id}`}
                className={cn(
                  "flex items-center gap-2.5 px-3 h-10 rounded-md text-sm transition-colors group",
                  active
                    ? "bg-[var(--bg-muted)] text-[var(--text-primary)] font-medium border border-[var(--border-default)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                )}
                style={
                  active
                    ? { boxShadow: "inset 3px 0 0 var(--color-red-50)" }
                    : undefined
                }
              >
                <AgentIcon agent={a} size="sm" />
                <span className="truncate flex-1">{a.name}</span>
                {a.isVideoAgent && (
                  <span
                    className="text-[9px] uppercase font-bold px-1 py-0.5 rounded"
                    style={{
                      background: "var(--color-red-90)",
                      color: "var(--color-red-30)",
                    }}
                  >
                    VID
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Recent */}
      <div className="px-2 pt-4 flex-1 flex flex-col min-h-0">
        <div className="px-3 pb-1.5 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-medium shrink-0">
          {t("recentChats", locale)}
        </div>
        <div className="flex-1 overflow-y-auto pr-1 space-y-0.5">
          {conversations.length === 0 ? (
            <div className="px-3 py-1 text-xs text-[var(--text-tertiary)]">
              {t("noConversations", locale)}
            </div>
          ) : (
            conversations.map((c) => {
              const a = agents.find((x) => x.id === c.agentId);
              const active =
                pathname.startsWith(`/agents/${c.agentId}`) && activeCid === c.id;
              return (
                <Link
                  key={c.id}
                  href={`/agents/${c.agentId}?cid=${c.id}`}
                  className={cn(
                    "flex flex-col px-3 py-1.5 rounded-md text-sm transition-colors",
                    active
                      ? "bg-[var(--bg-muted)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <span className="truncate text-[13px]">{c.title}</span>
                  <span className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1.5">
                    <span className="truncate">{a?.name ?? "Agent"}</span>
                    <span>·</span>
                    <span>{formatRelative(c.updatedAt)}</span>
                  </span>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Admin link */}
      {user?.role === "admin" && (
        <Link
          href="/admin"
          className={cn(
            "mx-2 mb-2 flex items-center gap-2 px-3 h-9 rounded-md text-sm transition-colors",
            pathname === "/admin"
              ? "bg-[var(--bg-muted)] text-[var(--text-primary)] font-medium"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
          )}
        >
          <SettingsIcon size={14} />
          <span>{t("admin", locale)}</span>
        </Link>
      )}

      {/* Footer: user */}
      <div
        className="border-t px-2 py-2"
        style={{ borderColor: "var(--border-default)" }}
      >
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-[var(--bg-muted)] transition-colors text-left"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
            style={{ background: "var(--color-gray-80)", color: "var(--color-gray-0)" }}
          >
            {user?.name.slice(0, 1) ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium truncate text-[var(--text-primary)]">
              {user?.name}
            </div>
            <div className="text-[10px] text-[var(--text-tertiary)] truncate">
              {user?.department}
            </div>
          </div>
          <span className="text-[10px] text-[var(--text-tertiary)]">{t("logout", locale)}</span>
        </button>
      </div>
    </aside>
  );
}
