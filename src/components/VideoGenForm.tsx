"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiBase } from "@/lib/api-client";
import { useAuth } from "@/stores/auth";
import { useLocale } from "@/stores/locale";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ImageIcon, StopIcon } from "@/components/icons";
import type { AvatarOption, Conversation, Message } from "@/types";

type ImageCue = {
  id: string;
  fileName: string;
  // Free-text snippet from the script. The image is inserted right after the
  // first occurrence of this text. Empty string = beginning of the video.
  afterText: string;
};

export function VideoGenForm({
  agentId,
  conversationId,
  onConversationCreated,
  onPreview,
}: {
  agentId: string;
  conversationId: string | null;
  onConversationCreated: (cid: string) => void;
  onPreview?: (preview: { language: "ja" | "en"; avatar: string; durationSec: number; submitting: boolean }) => void;
}) {
  const user = useAuth((s) => s.user);
  const locale = useLocale((s) => s.locale);
  const qc = useQueryClient();

  const avatarsQ = useQuery({
    queryKey: ["avatars", user?.id],
    queryFn: () =>
      api.get<{ avatars: AvatarOption[] }>(`/agents/a-ceo-video/avatars?userId=${user?.id ?? ""}`),
    enabled: !!user,
  });
  const avatars = avatarsQ.data?.avatars ?? [];

  const [script, setScript] = useState(
    locale === "ja"
      ? "本日は、当社の 2026 年度 中期経営計画 The Arc についてお話しします。\n\n当社は 3 つの柱により持続可能な成長を実現します。第一に、ボリューム回復。第二に、電動化の加速。そして第三に、構造改革による収益基盤の強化です。"
      : "Today I'll share our FY26 mid-term plan, The Arc.\n\nThree pillars drive sustainable growth: first, volume recovery; second, accelerated electrification; and third, structural reform that strengthens our earnings base."
  );
  const [language, setLanguage] = useState<"ja" | "en">(locale);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [imageCues, setImageCues] = useState<ImageCue[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-select the first allowed avatar; reset selection if the currently
  // selected avatar is no longer allowed (e.g., permission was just revoked).
  useEffect(() => {
    const firstAllowed = avatars.find((a) => a.allowed);
    if (!firstAllowed) {
      if (avatarId) setAvatarId(null);
      return;
    }
    const currentStillAllowed = avatars.some(
      (a) => a.id === avatarId && a.allowed
    );
    if (!currentStillAllowed) {
      setAvatarId(firstAllowed.id);
    }
  }, [avatars, avatarId]);

  // Reset per-generation UI when the conversation changes (e.g., the user
  // clicks the agent in the sidebar to start a fresh session).
  useEffect(() => {
    setImageCues([]);
    setCancelled(false);
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setSubmitting(false);
  }, [conversationId]);

  const allowedAvatars = avatars.filter((a) => a.allowed);
  const noAvatarAccess = !avatarsQ.isLoading && allowedAvatars.length === 0;

  function addImage(file: File) {
    setImageCues((arr) => [
      ...arr,
      {
        id: `ic-${Math.random().toString(36).slice(2, 8)}`,
        fileName: file.name,
        afterText: "",
      },
    ]);
  }

  function updateCue(id: string, patch: Partial<ImageCue>) {
    setImageCues((arr) => arr.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function removeCue(id: string) {
    setImageCues((arr) => arr.filter((c) => c.id !== id));
  }

  function cueMatches(c: ImageCue): boolean {
    if (!c.afterText.trim()) return true;
    return script.includes(c.afterText.trim());
  }

  async function handleGenerate() {
    if (!avatarId) return;
    const avatar = avatars.find((a) => a.id === avatarId);
    if (!avatar || avatar.allowed !== true) return;
    setSubmitting(true);
    setCancelled(false);
    onPreview?.({ language, avatar: avatar.label, durationSec: 0, submitting: true });
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      let cid = conversationId;
      if (!cid) {
        const c = await api.post<{ agentId: string; title?: string }, Conversation>(
          "/conversations",
          { agentId, title: script.slice(0, 30) }
        );
        cid = c.id;
        onConversationCreated(cid);
      }
      const cueSummary =
        imageCues.length > 0
          ? "\n" +
            (locale === "ja" ? "挿入画像: " : "Inserted images: ") +
            imageCues
              .map((c) => {
                const where = c.afterText.trim()
                  ? `${(locale === "ja" ? "「" : '"')}${c.afterText.slice(0, 30)}${
                      c.afterText.length > 30 ? "…" : ""
                    }${(locale === "ja" ? "」の後" : '" after')}`
                  : locale === "ja"
                  ? "冒頭"
                  : "at start";
                return `${c.fileName} → ${where}`;
              })
              .join(", ")
          : "";
      await api.post<Partial<Message>, Message>(`/conversations/${cid}/messages`, {
        role: "user",
        content:
          (locale === "ja" ? "[動画生成リクエスト]\n台本: " : "[Video gen request]\nScript: ") +
          script.slice(0, 80) +
          (script.length > 80 ? "..." : "") +
          `\n${t("language", locale)}: ${language === "ja" ? "日本語" : "English"} | ${t("executive", locale)}: ${avatar.label}` +
          cueSummary,
      });

      // Use fetch directly so we can abort via signal
      const res = await fetch(`${apiBase}/agents/a-ceo-video/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": locale },
        body: JSON.stringify({
          conversationId: cid,
          script,
          language,
          avatar: avatar.label,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      qc.invalidateQueries({ queryKey: ["conversation", cid] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      onPreview?.({
        language,
        avatar: avatar.label,
        durationSec: Math.max(20, Math.min(120, script.length / 4)),
        submitting: false,
      });
    } catch (e) {
      const wasAbort = e instanceof Error && e.name === "AbortError";
      if (wasAbort) {
        setCancelled(true);
        onPreview?.({ language, avatar: avatar.label, durationSec: 0, submitting: false });
      } else {
        onPreview?.({ language, avatar: avatar.label, durationSec: 0, submitting: false });
      }
    } finally {
      setSubmitting(false);
      abortRef.current = null;
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1" style={{ fontFamily: "var(--font-brand)" }}>
          {t("ceoVideoTitle", locale)}
        </h2>
        <p className="text-sm text-[var(--text-tertiary)]">{t("ceoVideoSubtitle", locale)}</p>
      </div>

      {/* Notice */}
      <div
        className="px-3 py-2 rounded-md border text-xs flex items-start gap-2"
        style={{
          background: "var(--blue-subtle)",
          borderColor: "var(--blue-muted)",
          color: "var(--blue-emphasized)",
        }}
      >
        <span aria-hidden>ℹ</span>
        <span>{t("videoNotSupportedBody", locale)}</span>
      </div>

      {/* Script */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
          {t("script", locale)}
        </label>
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={7}
          placeholder={t("scriptPlaceholder", locale)}
          className="w-full resize-none px-3.5 py-2.5 rounded-md border bg-[var(--bg-default)] text-sm leading-6 focus:outline-none focus:border-[var(--text-primary)] placeholder:text-[var(--text-quaternary)]"
          style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
        />
      </div>

      {/* Language */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
          {t("language", locale)}
        </label>
        <div className="grid grid-cols-2 rounded-md border overflow-hidden" style={{ borderColor: "var(--border-default)" }}>
          {(["ja", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLanguage(l)}
              className={cn(
                "h-10 text-sm transition-colors",
                language === l
                  ? "bg-[var(--bg-inverted)] text-[var(--text-contrast)]"
                  : "bg-[var(--bg-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              )}
              style={{ fontFamily: "var(--font-brand)" }}
            >
              {l === "ja" ? "日本語" : "English"}
            </button>
          ))}
        </div>
      </div>

      {/* Avatar */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
          {t("executive", locale)}
        </label>
        {noAvatarAccess && (
          <div
            className="text-xs px-3 py-2 rounded-md border mb-2"
            style={{
              background: "var(--orange-subtle)",
              borderColor: "var(--orange-muted)",
              color: "var(--orange-strong)",
            }}
          >
            {t("noAvatarAccess", locale)}
          </div>
        )}
        {avatars.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {avatars.map((a) => {
              const allowed = a.allowed === true;
              const selected = avatarId === a.id && allowed;
              const initials = a.label.split(/\s+/).slice(-1)[0].slice(0, 2).toUpperCase();
              const role = a.label.split(/\s+/)[0];
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => allowed && setAvatarId(a.id)}
                  disabled={!allowed}
                  aria-disabled={!allowed}
                  title={!allowed ? t("avatarLocked", locale) : a.label}
                  className={cn(
                    "flex flex-col items-center gap-2 px-3 py-3 rounded-lg border bg-[var(--bg-default)] transition-all relative",
                    !allowed && "cursor-not-allowed opacity-50",
                    allowed && !selected && "hover:bg-[var(--bg-subtle)]",
                    selected && "shadow-sm"
                  )}
                  style={{
                    borderColor: selected ? "var(--color-red-50)" : "var(--border-default)",
                    boxShadow: selected ? "inset 0 0 0 1px var(--color-red-50)" : undefined,
                  }}
                >
                  <span
                    className="w-12 h-12 rounded-full flex items-center justify-center text-[var(--text-contrast)] text-sm font-bold"
                    style={{
                      background: a.color,
                      fontFamily: "var(--font-brand)",
                      filter: allowed ? undefined : "grayscale(0.7)",
                    }}
                  >
                    {initials}
                  </span>
                  <span className="text-xs font-medium">{role}</span>
                  {!allowed && (
                    <span
                      aria-hidden
                      className="absolute top-1.5 right-1.5 text-2xs"
                      style={{ color: "var(--text-tertiary)" }}
                      title={t("avatarLocked", locale)}
                    >
                      🔒
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Insert image */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
          {t("insertImageTitle", locale)}
        </label>
        <p className="text-xs text-[var(--text-tertiary)] mb-2">
          {t("insertImageHint", locale)}
        </p>
        <label
          className="flex items-center justify-center gap-2 h-9 rounded-md border border-dashed cursor-pointer text-xs hover:bg-[var(--bg-subtle)]"
          style={{ borderColor: "var(--border-strong)", color: "var(--text-secondary)" }}
        >
          <input
            type="file"
            accept=".png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) addImage(f);
              e.currentTarget.value = "";
            }}
          />
          <ImageIcon /> {t("addImage", locale)}
        </label>
        {imageCues.length > 0 && (
          <div className="mt-2 space-y-2">
            {imageCues.map((c) => {
              const matched = cueMatches(c);
              return (
                <div
                  key={c.id}
                  className="rounded-md border bg-[var(--bg-subtle)] px-2 py-2"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <ImageIcon size={14} />
                    <span className="truncate flex-1 text-xs font-medium">
                      {c.fileName}
                    </span>
                    <button
                      onClick={() => removeCue(c.id)}
                      aria-label={locale === "ja" ? "削除" : "Remove"}
                      className="text-[var(--text-tertiary)] hover:text-[var(--text-error)] px-1"
                    >
                      ×
                    </button>
                  </div>
                  <label className="block text-2xs uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                    {t("insertAfterLabel", locale)}
                  </label>
                  <input
                    type="text"
                    value={c.afterText}
                    onChange={(e) => updateCue(c.id, { afterText: e.target.value })}
                    placeholder={t("insertAfterPlaceholder", locale)}
                    className="w-full h-8 px-2.5 rounded border text-xs bg-[var(--bg-default)] focus:outline-none focus:border-[var(--text-primary)]"
                    style={{
                      borderColor: matched
                        ? "var(--border-default)"
                        : "var(--border-error)",
                      color: "var(--text-primary)",
                    }}
                  />
                  {!matched && (
                    <p className="mt-1 text-2xs" style={{ color: "var(--text-error)" }}>
                      {t("insertAfterNotFound", locale)}
                    </p>
                  )}
                  {matched && c.afterText.trim() === "" && (
                    <p className="mt-1 text-2xs text-[var(--text-tertiary)]">
                      {t("insertAtStart", locale)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {submitting ? (
        <button
          onClick={handleStop}
          className="h-11 w-full rounded-md text-sm font-medium border inline-flex items-center justify-center gap-2 hover:bg-[var(--bg-muted)]"
          style={{
            borderColor: "var(--border-default)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-brand)",
          }}
        >
          <StopIcon size={12} />
          {t("stopGeneration", locale)}
        </button>
      ) : (
        <button
          onClick={() => {
            setCancelled(false);
            handleGenerate();
          }}
          disabled={!script.trim() || !avatarId || noAvatarAccess}
          className="h-11 w-full rounded-md text-sm font-medium text-[var(--text-contrast)] disabled:opacity-50"
          style={{ background: "var(--color-red-50)", fontFamily: "var(--font-brand)" }}
        >
          {t("generate", locale)}
        </button>
      )}

      {cancelled && !submitting && (
        <div
          className="px-3 py-2 rounded-md border text-xs"
          style={{
            background: "var(--orange-subtle)",
            borderColor: "var(--orange-muted)",
            color: "var(--orange-strong)",
          }}
        >
          {t("generationCancelled", locale)}
        </div>
      )}

      <p className="text-xs text-[var(--text-tertiary)] leading-relaxed text-center">
        {t("refineHint", locale)}
      </p>
    </div>
  );
}
