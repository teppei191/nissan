"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuth } from "@/stores/auth";
import { useLocale } from "@/stores/locale";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ImageIcon } from "@/components/icons";
import type { AvatarOption, Conversation, Message } from "@/types";

type ImageCue = {
  id: string;
  fileName: string;
  afterParaIndex: number;
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

  useEffect(() => {
    if (avatars.length > 0 && !avatarId) setAvatarId(avatars[0].id);
  }, [avatars, avatarId]);

  const noAvatarAccess = !avatarsQ.isLoading && avatars.length === 0;

  // Split script by blank-line into paragraphs (for image cues)
  const paragraphs = script.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

  function addImage(file: File) {
    setImageCues((arr) => [
      ...arr,
      {
        id: `ic-${Math.random().toString(36).slice(2, 8)}`,
        fileName: file.name,
        afterParaIndex: Math.max(0, Math.min(paragraphs.length - 1, 0)),
      },
    ]);
  }

  function updateCue(id: string, patch: Partial<ImageCue>) {
    setImageCues((arr) => arr.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function removeCue(id: string) {
    setImageCues((arr) => arr.filter((c) => c.id !== id));
  }

  async function handleGenerate() {
    if (!avatarId) return;
    const avatar = avatars.find((a) => a.id === avatarId);
    if (!avatar) return;
    setSubmitting(true);
    onPreview?.({ language, avatar: avatar.label, durationSec: 0, submitting: true });
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
              .map(
                (c) =>
                  `${c.fileName} → ${(locale === "ja" ? "段落" : "para")} ${c.afterParaIndex + 1} ${locale === "ja" ? "の後" : "after"}`
              )
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
      await api.post<
        {
          conversationId: string;
          script: string;
          language: "ja" | "en";
          avatar: string;
        },
        Message
      >(`/agents/a-ceo-video/video`, {
        conversationId: cid,
        script,
        language,
        avatar: avatar.label,
      });
      qc.invalidateQueries({ queryKey: ["conversation", cid] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      onPreview?.({
        language,
        avatar: avatar.label,
        durationSec: Math.max(20, Math.min(120, script.length / 4)),
        submitting: false,
      });
    } finally {
      setSubmitting(false);
    }
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
        {noAvatarAccess ? (
          <div
            className="text-xs px-3 py-2 rounded-md border"
            style={{
              background: "var(--orange-subtle)",
              borderColor: "var(--orange-muted)",
              color: "var(--orange-strong)",
            }}
          >
            {t("noAvatarAccess", locale)}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {avatars.map((a) => {
              const selected = avatarId === a.id;
              const initials = a.label.split(/\s+/).slice(-1)[0].slice(0, 2).toUpperCase();
              const role = a.label.split(/\s+/)[0];
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAvatarId(a.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 px-3 py-3 rounded-lg border bg-[var(--bg-default)] transition-all",
                    selected ? "shadow-sm" : "hover:bg-[var(--bg-subtle)]"
                  )}
                  style={{
                    borderColor: selected ? "var(--color-red-50)" : "var(--border-default)",
                    boxShadow: selected ? "inset 0 0 0 1px var(--color-red-50)" : undefined,
                  }}
                >
                  <span
                    className="w-12 h-12 rounded-full flex items-center justify-center text-[var(--text-contrast)] text-sm font-bold"
                    style={{ background: a.color, fontFamily: "var(--font-brand)" }}
                  >
                    {initials}
                  </span>
                  <span className="text-xs font-medium">{role}</span>
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
          <div className="mt-2 space-y-1.5">
            {imageCues.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md border bg-[var(--bg-subtle)] text-xs"
                style={{ borderColor: "var(--border-default)" }}
              >
                <ImageIcon size={14} />
                <span className="truncate flex-1">{c.fileName}</span>
                <select
                  value={c.afterParaIndex}
                  onChange={(e) =>
                    updateCue(c.id, { afterParaIndex: Number(e.target.value) })
                  }
                  className="h-7 px-1 rounded border text-xs bg-[var(--bg-default)] max-w-[160px]"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  {paragraphs.map((p, i) => (
                    <option key={i} value={i}>
                      {locale === "ja" ? "段落" : "Para"} {i + 1}: {p.slice(0, 24)}
                      {p.length > 24 ? "..." : ""}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => removeCue(c.id)}
                  className="text-[var(--text-tertiary)] hover:text-[var(--text-error)] px-1"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleGenerate}
        disabled={submitting || !script.trim() || !avatarId || noAvatarAccess}
        className="h-11 w-full rounded-md text-sm font-medium text-[var(--text-contrast)] disabled:opacity-50"
        style={{ background: "var(--color-red-50)", fontFamily: "var(--font-brand)" }}
      >
        {submitting ? t("generating", locale) : t("generate", locale)}
      </button>

      <p className="text-xs text-[var(--text-tertiary)] leading-relaxed text-center">
        {t("refineHint", locale)}
      </p>
    </div>
  );
}
