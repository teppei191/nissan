"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useLocale } from "@/stores/locale";
import { t } from "@/lib/i18n";
import type { Agent, User } from "@/types";

type Permission = "OWNER" | "VIEW";

type ShareResponse = {
  ok: boolean;
  granted: { userId: string; userName: string; email: string }[];
  notFound: string[];
};

export function ShareModal({
  agent,
  onClose,
}: {
  agent: Agent;
  onClose: () => void;
}) {
  const locale = useLocale((s) => s.locale);
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState<User[]>([]);
  const [permission, setPermission] = useState<Permission>("VIEW");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<
    | { kind: "ok"; granted: ShareResponse["granted"]; notFound: string[] }
    | { kind: "error"; message: string }
    | null
  >(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const usersQ = useQuery({
    queryKey: ["share-users"],
    queryFn: () => api.get<{ users: User[] }>("/users"),
  });
  const allUsers = usersQ.data?.users ?? [];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Close suggestions on outside click within the modal
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Strip leading "@" from input for matching, but keep the trigger UX
  const query = input.replace(/^@+/, "").trim().toLowerCase();

  const suggestions = useMemo(() => {
    const selectedIds = new Set(selected.map((u) => u.id));
    return allUsers
      .filter((u) => !selectedIds.has(u.id))
      .filter((u) => !u.disabled)
      .filter((u) => u.role !== "admin") // admin already has implicit access
      .filter((u) => {
        if (!query) return true;
        return (
          u.name.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query)
        );
      })
      .slice(0, 8);
  }, [allUsers, selected, query]);

  function addUser(u: User) {
    setSelected((arr) => [...arr, u]);
    setInput("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  }

  function removeUser(id: string) {
    setSelected((arr) => arr.filter((u) => u.id !== id));
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && input === "" && selected.length > 0) {
      e.preventDefault();
      setSelected((arr) => arr.slice(0, -1));
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      // Pick first suggestion
      if (suggestions.length > 0) {
        e.preventDefault();
        addUser(suggestions[0]);
      }
    }
  }

  async function submit() {
    if (selected.length === 0 || submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await api.post<
        { emails: string[]; permission: Permission },
        ShareResponse
      >(`/agents/${agent.id}/share`, {
        emails: selected.map((u) => u.email),
        permission,
      });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["permissions", agent.id] });
      setFeedback({ kind: "ok", granted: res.granted, notFound: res.notFound });
      setSelected([]);
      setInput("");
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
          {t("shareDescriptionMulti", locale)}
        </p>

        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
          {t("shareRecipients", locale)}
        </label>
        <div ref={wrapRef} className="relative">
          <div
            className="flex flex-wrap gap-1.5 min-h-9 p-1.5 rounded-md border bg-[var(--bg-default)] cursor-text"
            style={{ borderColor: "var(--border-default)" }}
            onClick={() => inputRef.current?.focus()}
          >
            {selected.map((u) => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-xs"
                style={{
                  background: "var(--blue-subtle)",
                  color: "var(--blue-emphasized)",
                  border: "1px solid var(--blue-muted)",
                }}
              >
                {u.name}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeUser(u.id);
                  }}
                  className="hover:opacity-70 ml-0.5"
                  aria-label="remove"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={onInputKeyDown}
              placeholder={
                selected.length === 0
                  ? t("sharePickerPlaceholder", locale)
                  : ""
              }
              className="flex-1 min-w-[120px] h-6 px-1 bg-transparent text-sm focus:outline-none"
            />
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <ul
              className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-md border bg-[var(--bg-default)] shadow-lg z-10"
              style={{ borderColor: "var(--border-default)" }}
            >
              {suggestions.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => addUser(u)}
                    className="w-full text-left px-3 py-2 hover:bg-[var(--bg-muted)] flex items-center justify-between gap-3"
                  >
                    <span className="min-w-0">
                      <span className="text-sm font-medium block truncate">
                        {u.name}
                      </span>
                      <span className="text-xs text-[var(--text-tertiary)] block truncate">
                        {u.email}
                      </span>
                    </span>
                    <span className="text-2xs uppercase text-[var(--text-tertiary)] shrink-0">
                      {u.department}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {showSuggestions && query && suggestions.length === 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-1 rounded-md border bg-[var(--bg-default)] shadow-lg p-3 text-xs text-[var(--text-tertiary)] z-10"
              style={{ borderColor: "var(--border-default)" }}
            >
              {t("shareNoMatches", locale)}
            </div>
          )}
        </div>
        <p className="mt-1 text-2xs text-[var(--text-tertiary)]">
          {t("sharePickerHint", locale)}
        </p>

        <label className="block text-xs font-medium text-[var(--text-secondary)] mt-4 mb-1">
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
            className="mb-3 px-3 py-2 rounded-md border text-xs space-y-1"
            style={{
              background: "var(--green-subtle)",
              borderColor: "var(--green-muted)",
              color: "var(--green-emphasized)",
            }}
          >
            <div>
              ✓{" "}
              {locale === "ja"
                ? `${feedback.granted.length} 人に権限を付与しました`
                : `Granted access to ${feedback.granted.length} ${
                    feedback.granted.length === 1 ? "user" : "users"
                  }`}
            </div>
            {feedback.granted.length > 0 && (
              <div className="text-[var(--text-secondary)]">
                {feedback.granted.map((g) => g.userName).join(", ")}
              </div>
            )}
            {feedback.notFound.length > 0 && (
              <div style={{ color: "var(--orange-strong)" }}>
                {locale === "ja"
                  ? `${feedback.notFound.length} 件のメールが見つかりませんでした`
                  : `${feedback.notFound.length} email(s) not found`}
                : {feedback.notFound.join(", ")}
              </div>
            )}
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
            {feedback.message}
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
            disabled={selected.length === 0 || submitting}
            className="h-9 px-4 rounded-md text-sm font-medium text-[var(--text-contrast)] disabled:opacity-50"
            style={{ background: "var(--color-red-50)", fontFamily: "var(--font-brand)" }}
          >
            {submitting
              ? "..."
              : selected.length > 1
              ? locale === "ja"
                ? `${selected.length} 人に権限を付与`
                : `Grant to ${selected.length}`
              : t("shareGrant", locale)}
          </button>
        </div>
      </div>
    </div>
  );
}
