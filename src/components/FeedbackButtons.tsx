"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useLocale } from "@/stores/locale";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Conversation, Feedback, Message } from "@/types";

export function FeedbackButtons({
  conversationId,
  message,
}: {
  conversationId: string;
  message: Message;
}) {
  const locale = useLocale((s) => s.locale);
  const qc = useQueryClient();
  const [openDislike, setOpenDislike] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fb = message.feedback;

  function patchCache(updated: Feedback) {
    qc.setQueryData<Conversation>(["conversation", conversationId], (old) => {
      if (!old) return old;
      return {
        ...old,
        messages: old.messages.map((m) =>
          m.id === message.id ? { ...m, feedback: updated } : m
        ),
      };
    });
  }

  async function send(type: "like" | "dislike", commentText?: string) {
    if (submitting) return;
    setSubmitting(true);
    const optimistic: Feedback = {
      type,
      comment: commentText,
      createdAt: new Date().toISOString(),
    };
    patchCache(optimistic);
    try {
      await api.post<
        { type: "like" | "dislike"; comment?: string },
        Message
      >(`/conversations/${conversationId}/messages/${message.id}/feedback`, {
        type,
        comment: commentText,
      });
    } finally {
      setSubmitting(false);
      setOpenDislike(false);
      setComment("");
    }
  }

  // Already submitted → show state
  if (fb) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px]"
        style={{
          color:
            fb.type === "like" ? "var(--green-emphasized)" : "var(--orange-emphasized)",
        }}
        title={fb.comment || undefined}
      >
        {fb.type === "like" ? t("feedbackLiked", locale) : t("feedbackDisliked", locale)}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1.5">
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          aria-label={t("feedbackLike", locale)}
          disabled={submitting}
          onClick={() => send("like")}
          className={cn(
            "w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)] hover:text-[var(--green-emphasized)] disabled:opacity-50"
          )}
        >
          <ThumbIcon up />
        </button>
        <button
          type="button"
          aria-label={t("feedbackDislike", locale)}
          disabled={submitting}
          onClick={() => setOpenDislike((v) => !v)}
          className={cn(
            "w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)] hover:text-[var(--orange-emphasized)] disabled:opacity-50",
            openDislike && "bg-[var(--bg-muted)] text-[var(--orange-emphasized)]"
          )}
        >
          <ThumbIcon up={false} />
        </button>
      </span>
      {openDislike && (
        <div
          className="rounded-md border p-2 max-w-md"
          style={{
            background: "var(--bg-default)",
            borderColor: "var(--border-default)",
          }}
        >
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder={t("feedbackCommentPlaceholder", locale)}
            className="w-full resize-none text-xs px-2 py-1.5 rounded border bg-[var(--bg-default)] focus:outline-none focus:border-[var(--text-primary)]"
            style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
            autoFocus
          />
          <div className="mt-1.5 flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setOpenDislike(false);
                setComment("");
              }}
              className="h-7 px-2 rounded text-[11px] hover:bg-[var(--bg-muted)] text-[var(--text-secondary)]"
            >
              {t("cancel", locale)}
            </button>
            <button
              type="button"
              onClick={() => send("dislike", comment.trim() || undefined)}
              disabled={submitting || !comment.trim()}
              className="h-7 px-2.5 rounded text-[11px] font-medium text-[var(--text-contrast)] disabled:opacity-50"
              style={{ background: "var(--color-red-50)", fontFamily: "var(--font-brand)" }}
            >
              {submitting ? "..." : t("feedbackSubmit", locale)}
            </button>
          </div>
        </div>
      )}
    </span>
  );
}

function ThumbIcon({ up }: { up: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: up ? undefined : "rotate(180deg)" }}
    >
      <path d="M7 10v11" />
      <path d="M7 10l4-7a2.5 2.5 0 0 1 2.5 2.5V10h6.2a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 18.3 21H7" />
    </svg>
  );
}
