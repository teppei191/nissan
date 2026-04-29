"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useLocale } from "@/stores/locale";
import { t } from "@/lib/i18n";
import { CloseIcon, DownloadIcon, MaximizeIcon, PlayIcon } from "@/components/icons";
import type { Conversation, Message } from "@/types";

export function VideoPreviewPanel({
  conversationId,
  pendingPreview,
}: {
  conversationId: string | null;
  pendingPreview?: { language: "ja" | "en"; avatar: string; durationSec: number; submitting: boolean };
}) {
  const locale = useLocale((s) => s.locale);
  const [maximized, setMaximized] = useState(false);
  const convQ = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => api.get<Conversation>(`/conversations/${conversationId}`),
    enabled: !!conversationId,
  });

  const lastVideo = [...(convQ.data?.messages ?? [])].reverse().find((m) => m.videoOutput);
  const submitting = pendingPreview?.submitting;
  // Expand panel when there is a finished video
  const expanded = !!lastVideo && !submitting;

  return (
    <>
      <aside
        className="theme-dark shrink-0 h-full flex flex-col border-l transition-[width] duration-300 ease-out"
        style={{
          width: expanded ? 480 : 320,
          background: "var(--bg-default)",
          borderColor: "var(--border-default)",
          color: "var(--text-primary)",
        }}
      >
        <div className="px-5 pt-4 pb-3 flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-medium">
            {t("preview", locale)}
          </div>
          {lastVideo && !submitting && (
            <button
              onClick={() => setMaximized(true)}
              aria-label={t("maximize", locale)}
              title={t("maximize", locale)}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
            >
              <MaximizeIcon size={15} />
            </button>
          )}
        </div>
        <div className="px-5 pb-4 flex-1 overflow-y-auto">
          {!lastVideo && !submitting ? (
            <div
              className="rounded-lg border border-dashed h-48 flex items-center justify-center text-xs text-[var(--text-tertiary)] text-center px-4"
              style={{ borderColor: "var(--border-default)" }}
            >
              {t("noVideoYet", locale)}
            </div>
          ) : (
            <>
              <div className="text-sm font-medium mb-2">
                {lastVideo
                  ? `${lastVideo.videoOutput!.avatar.split(/\s+/)[0]} · ${lastVideo.videoOutput!.language === "ja" ? "JP" : "EN"}`
                  : `${pendingPreview?.avatar.split(/\s+/)[0]} · ${pendingPreview?.language === "ja" ? "JP" : "EN"}`}
              </div>
              <VideoStage submitting={submitting} lastVideo={lastVideo} />
              {lastVideo && (
                <>
                  <div className="mt-3 space-y-1 text-xs">
                    <MetaRow label={locale === "ja" ? "アバター" : "Avatar"} value={lastVideo.videoOutput!.avatar} />
                    <MetaRow label={t("language", locale)} value={lastVideo.videoOutput!.language === "ja" ? "日本語" : "English"} />
                    <MetaRow label={locale === "ja" ? "長さ" : "Duration"} value={`${lastVideo.videoOutput!.durationSec}s · 1080p`} />
                  </div>
                  <button
                    onClick={() => alert("Mock: video would download here")}
                    className="mt-3 w-full h-9 rounded-md inline-flex items-center justify-center gap-1.5 text-xs font-medium border hover:bg-[var(--bg-muted)]"
                    style={{
                      borderColor: "var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <DownloadIcon size={14} />
                    {t("download", locale)}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </aside>

      {maximized && lastVideo && (
        <FullscreenPreview lastVideo={lastVideo} onClose={() => setMaximized(false)} />
      )}
    </>
  );
}

function VideoStage({
  submitting,
  lastVideo,
}: {
  submitting: boolean | undefined;
  lastVideo: Message | undefined;
}) {
  const locale = useLocale((s) => s.locale);
  return (
    <div
      className="rounded-lg overflow-hidden relative"
      style={{
        aspectRatio: "16 / 10",
        background:
          "linear-gradient(135deg, var(--color-gray-90) 0%, var(--color-red-90) 100%)",
      }}
    >
      {submitting ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-[var(--text-secondary)]">
          <span
            className="w-9 h-9 mb-2 rounded-full border-2 animate-spin"
            style={{
              borderColor: "var(--color-gray-50)",
              borderTopColor: "var(--color-red-50)",
            }}
          />
          {t("videoBeingGenerated", locale)}
        </div>
      ) : (
        lastVideo && (
          <button
            onClick={() => alert("Mock: video would play here")}
            className="absolute inset-0 flex items-center justify-center group"
          >
            <span
              className="rounded-full flex items-center justify-center transition-transform group-hover:scale-105"
              style={{
                background: "var(--color-red-50)",
                width: 56,
                height: 56,
              }}
            >
              <span style={{ color: "#fff", marginLeft: 2 }}>
                <PlayIcon size={26} />
              </span>
            </span>
          </button>
        )
      )}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--text-tertiary)]">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function FullscreenPreview({
  lastVideo,
  onClose,
}: {
  lastVideo: Message;
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
      className="fixed inset-0 z-50 flex items-center justify-center px-6 py-6 theme-dark"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label={t("closeModal", locale)}
        className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10"
      >
        <CloseIcon size={20} />
      </button>
      <div
        className="w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
        style={{ color: "var(--text-primary)" }}
      >
        <div
          className="text-xs uppercase tracking-wider text-white/70 mb-3"
          style={{ fontFamily: "var(--font-brand)" }}
        >
          {t("preview", locale)} · {lastVideo.videoOutput!.avatar}
        </div>
        <div
          className="rounded-xl overflow-hidden relative w-full"
          style={{
            aspectRatio: "16 / 9",
            background:
              "linear-gradient(135deg, var(--color-gray-90) 0%, var(--color-red-90) 100%)",
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              alert("Mock: video would play here");
            }}
            className="absolute inset-0 flex items-center justify-center group"
          >
            <span
              className="rounded-full flex items-center justify-center transition-transform group-hover:scale-105"
              style={{ background: "var(--color-red-50)", width: 96, height: 96 }}
            >
              <span style={{ color: "#fff", marginLeft: 4 }}>
                <PlayIcon size={48} />
              </span>
            </span>
          </button>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-white/80">
          <div className="space-x-4">
            <span>
              {lastVideo.videoOutput!.language === "ja" ? "日本語" : "English"}
            </span>
            <span>{lastVideo.videoOutput!.durationSec}s · 1080p</span>
          </div>
          <button
            onClick={() => alert("Mock: video would download here")}
            className="h-9 px-4 rounded-md inline-flex items-center gap-1.5 text-xs font-medium text-white border border-white/30 hover:bg-white/10"
          >
            <DownloadIcon size={14} />
            {t("download", locale)}
          </button>
        </div>
      </div>
    </div>
  );
}
