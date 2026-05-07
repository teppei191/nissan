"use client";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useLocale } from "@/stores/locale";
import { t } from "@/lib/i18n";
import type { Agent } from "@/types";

type Permission = "OWNER" | "VIEW";

export function ShareModal({
  agent,
  onClose,
}: {
  agent: Agent;
  onClose: () => void;
}) {
  const locale = useLocale((s) => s.locale);
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<Permission>("VIEW");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<
    | { kind: "ok"; userName: string }
    | { kind: "error"; message: string }
    | null
  >(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await api.post<
        { email: string; permission: Permission },
        { ok: boolean; userId: string; userName: string }
      >(`/agents/${agent.id}/share`, { email: email.trim(), permission });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["permissions", agent.id] });
      setFeedback({ kind: "ok", userName: res.userName });
      setEmail("");
    } catch (e) {
      setFeedback({
        kind: "error",
        message: e instanceof Error ? e.message : "Failed",
      });
    } finally {
      setSubmitting(false);
    }
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
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-2xs uppercase tracking-wider text-[var(--text-tertiary)] mb-0.5">
              {agent.name}
            </div>
            <h3 className="text-base font-bold" style={{ fontFamily: "var(--font-brand)" }}>
              {t("shareTitle", locale)}
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

        <p className="text-xs text-[var(--text-tertiary)] mb-4">
          {t("shareDescription", locale)}
        </p>

        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
          {t("email", locale)}
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          disabled={submitting}
          className="w-full h-9 px-2.5 rounded-md border text-sm bg-[var(--bg-default)] focus:outline-none focus:border-[var(--text-primary)] mb-3"
          style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
        />

        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
          {t("permissionLabel", locale)}
        </label>
        <select
          value={permission}
          onChange={(e) => setPermission(e.target.value as Permission)}
          disabled={submitting}
          className="w-full h-9 px-2 rounded-md border text-sm bg-[var(--bg-default)] mb-4"
          style={{ borderColor: "var(--border-default)" }}
        >
          <option value="VIEW">{t("permissionViewer", locale)}</option>
          <option value="OWNER">{t("permissionOwner", locale)}</option>
        </select>

        {feedback?.kind === "ok" && (
          <div
            className="mb-3 px-3 py-2 rounded-md border text-xs"
            style={{
              background: "var(--green-subtle)",
              borderColor: "var(--green-muted)",
              color: "var(--green-emphasized)",
            }}
          >
            ✓ {t("shareSuccess", locale)}: {feedback.userName}
          </div>
        )}
        {feedback?.kind === "error" && (
          <div
            className="mb-3 px-3 py-2 rounded-md border text-xs"
            style={{
              background: "var(--red-subtle)",
              borderColor: "var(--border-error)",
              color: "var(--text-error)",
            }}
          >
            {t("shareEmailNotFound", locale)}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 rounded-md text-sm border hover:bg-[var(--bg-muted)]"
            style={{ borderColor: "var(--border-default)" }}
          >
            {t("cancel", locale)}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!email.trim() || submitting}
            className="h-9 px-4 rounded-md text-sm font-medium text-[var(--text-contrast)] disabled:opacity-50"
            style={{ background: "var(--color-red-50)", fontFamily: "var(--font-brand)" }}
          >
            {submitting ? "..." : t("shareGrant", locale)}
          </button>
        </div>
      </div>
    </div>
  );
}
