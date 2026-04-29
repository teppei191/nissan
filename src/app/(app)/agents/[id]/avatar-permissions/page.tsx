"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuth } from "@/stores/auth";
import { useLocale } from "@/stores/locale";
import { t } from "@/lib/i18n";
import { AgentIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { Agent, AgentPermission, AvatarOption, AvatarPermissions, User } from "@/types";

type PermResponse = {
  perUser: Record<string, AgentPermission>;
  byDepartment: string[];
  avatarPermissions: AvatarPermissions | null;
  avatars: AvatarOption[] | null;
  users: User[];
};

export default function AvatarPermissionsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const locale = useLocale((s) => s.locale);
  const qc = useQueryClient();

  const agentQ = useQuery({
    queryKey: ["agent", params.id],
    queryFn: () => api.get<Agent>(`/agents/${params.id}`),
  });
  const permQ = useQuery({
    queryKey: ["permissions", params.id],
    queryFn: () => api.get<PermResponse>(`/agents/${params.id}/permissions`),
  });

  const [avatarPerms, setAvatarPerms] = useState<AvatarPermissions>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (permQ.data) {
      setAvatarPerms(permQ.data.avatarPermissions ?? {});
      setSavedAt(null);
    }
  }, [permQ.data]);

  // Access guard: owner/admin only AND must be a video agent
  useEffect(() => {
    if (agentQ.data && user) {
      const isOwnerOrAdmin =
        user.role === "admin" || agentQ.data.ownerUserId === user.id;
      if (!isOwnerOrAdmin || !agentQ.data.isVideoAgent) {
        router.replace(`/agents/${params.id}`);
      }
    }
  }, [agentQ.data, user, router, params.id]);

  if (!agentQ.data || !permQ.data) return null;
  const agent = agentQ.data;
  const allUsers = permQ.data.users;
  const avatars = permQ.data.avatars ?? [];

  const toggleAvatar = (uid: string, avId: string) => {
    setAvatarPerms((s) => {
      const cur = s[uid] ?? [];
      const next = cur.includes(avId) ? cur.filter((x) => x !== avId) : [...cur, avId];
      return { ...s, [uid]: next };
    });
  };

  async function save() {
    setSaving(true);
    try {
      await api.put<
        { avatarPermissions: AvatarPermissions },
        { ok: boolean }
      >(`/agents/${params.id}/permissions`, { avatarPermissions: avatarPerms });
      qc.invalidateQueries({ queryKey: ["permissions", params.id] });
      qc.invalidateQueries({ queryKey: ["avatars"] });
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-8">
      <nav className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] mb-4">
        <Link
          href={`/agents/${agent.id}`}
          className="hover:text-[var(--text-secondary)] flex items-center gap-1.5"
        >
          <AgentIcon agent={agent} size="sm" />
          {agent.name}
        </Link>
        <span>›</span>
        <span className="text-[var(--text-secondary)]">
          {t("avatarPermissions", locale)}
        </span>
      </nav>

      <header className="mb-2">
        <h1 className="text-xl font-bold mb-1" style={{ fontFamily: "var(--font-brand)" }}>
          {t("avatarPermissions", locale)}
        </h1>
        <p className="text-sm text-[var(--text-tertiary)]">
          {t("avatarPermissionsDesc", locale)}
        </p>
      </header>

      <div
        className="mb-5 px-3 py-2 rounded-md border text-xs flex items-start gap-2"
        style={{
          background: "var(--blue-subtle)",
          borderColor: "var(--blue-muted)",
          color: "var(--blue-emphasized)",
        }}
      >
        <span aria-hidden>🔒</span>
        <span>{t("avatarPermissionsOwnerOnly", locale)}</span>
      </div>

      {avatars.length === 0 ? (
        <div className="text-sm text-[var(--text-tertiary)]">
          {locale === "ja" ? "アバターが登録されていません。" : "No avatars configured."}
        </div>
      ) : (
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
                {avatars.map((a) => (
                  <th
                    key={a.id}
                    className="px-3 py-2 font-medium text-[var(--text-secondary)] text-center"
                  >
                    {a.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allUsers.map((u, i) => {
                const allowed = avatarPerms[u.id] ?? [];
                return (
                  <tr
                    key={u.id}
                    className={cn(i > 0 && "border-t")}
                    style={{ borderColor: "var(--border-light)" }}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-[var(--text-tertiary)]">
                        {u.role === "admin"
                          ? locale === "ja"
                            ? "管理者（全アバター利用可）"
                            : "admin (all avatars)"
                          : u.email}
                      </div>
                    </td>
                    {avatars.map((a) => {
                      const on = u.role === "admin" || allowed.includes(a.id);
                      return (
                        <td key={a.id} className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={u.role === "admin"}
                            onChange={() => toggleAvatar(u.id, a.id)}
                            aria-label={`${u.name} - ${a.label}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="h-10 px-5 rounded-md text-sm font-medium text-[var(--text-contrast)] disabled:opacity-50"
          style={{ background: "var(--color-red-50)", fontFamily: "var(--font-brand)" }}
        >
          {saving ? "..." : t("saveChanges", locale)}
        </button>
        {savedAt && (
          <span className="text-xs text-[var(--text-tertiary)]">{t("saved", locale)}</span>
        )}
      </div>
      </div>
    </div>
  );
}
