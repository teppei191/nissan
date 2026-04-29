"use client";
import { useState } from "react";
import { useLocale } from "@/stores/locale";
import { t } from "@/lib/i18n";
import { formatBytes, cn } from "@/lib/utils";
import { ThinkingDots } from "@/components/icons";
import { FeedbackButtons } from "@/components/FeedbackButtons";
import type { Message } from "@/types";

export function ChatBubble({
  msg,
  conversationId,
}: {
  msg: Message;
  conversationId?: string | null;
}) {
  const isUser = msg.role === "user";
  const locale = useLocale((s) => s.locale);
  const isThinking = msg.status === "thinking" || (msg.status === "streaming" && !msg.content);

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-contrast)] text-[10px] font-bold shrink-0"
          style={{
            background: "linear-gradient(135deg, var(--color-red-50), var(--color-red-70))",
            fontFamily: "var(--font-brand)",
          }}
        >
          AI
        </div>
      )}
      <div className={cn("max-w-[78%] min-w-0", isUser && "text-right")}>
        {!isUser && (
          <div className="text-[10px] text-[var(--text-tertiary)] mb-1">
            AI {locale === "ja" ? "アシスタント" : "Assistant"}
          </div>
        )}
        <div
          className={cn(
            "inline-block whitespace-pre-wrap text-left text-[15px] rounded-2xl px-4 py-2.5 border leading-relaxed"
          )}
          style={
            isUser
              ? {
                  background: "var(--blue-emphasized)",
                  borderColor: "var(--blue-emphasized)",
                  color: "var(--text-contrast)",
                }
              : {
                  background: "var(--bg-subtle)",
                  borderColor: "var(--border-default)",
                  color: "var(--text-primary)",
                }
          }
        >
          {isThinking ? (
            <span className="inline-flex items-center gap-2 text-[var(--text-tertiary)]">
              {t("thinking", locale)}
              <ThinkingDots />
            </span>
          ) : (
            <>
              {msg.content}
              {msg.status === "streaming" && (
                <span
                  className="inline-block w-[3px] h-[14px] ml-0.5 align-middle"
                  style={{ background: "var(--text-tertiary)", animation: "cursor-blink 0.8s steps(2) infinite" }}
                />
              )}
            </>
          )}
        </div>
        <style jsx>{`
          @keyframes cursor-blink {
            50% { opacity: 0; }
          }
        `}</style>
        {msg.attachments && msg.attachments.length > 0 && (
          <div className={cn("flex gap-2 mt-1.5 flex-wrap", isUser ? "justify-end" : "")}>
            {msg.attachments.map((f, i) => (
              <div
                key={i}
                className="text-[11px] px-2 py-1 rounded border bg-[var(--bg-default)]"
                style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
              >
                📎 {f.name}{" "}
                <span className="text-[var(--text-tertiary)]">({formatBytes(f.size)})</span>
              </div>
            ))}
          </div>
        )}
        {msg.videoOutput && (
          <div
            className="mt-2 inline-block border rounded-lg p-3 text-left"
            style={{ borderColor: "var(--border-default)", background: "var(--bg-default)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-32 h-20 rounded flex items-center justify-center text-[var(--text-contrast)] text-xs font-bold shrink-0"
                style={{
                  background:
                    "linear-gradient(135deg, var(--color-gray-90), var(--color-red-60))",
                  fontFamily: "var(--font-brand)",
                }}
              >
                ▶ MOCK VIDEO
              </div>
              <div className="text-xs space-y-0.5">
                <div className="font-medium text-sm">{msg.videoOutput.avatar}</div>
                <div className="text-[var(--text-tertiary)]">
                  {msg.videoOutput.language === "ja" ? "日本語" : "English"} ·{" "}
                  {msg.videoOutput.durationSec}s
                </div>
                <button
                  className="hover:underline mt-1"
                  style={{ color: "var(--blue-solid)" }}
                  onClick={() => alert("Mock: video would download here")}
                >
                  ⬇ {t("download", locale)}
                </button>
              </div>
            </div>
          </div>
        )}
        {!isUser &&
          msg.status !== "streaming" &&
          msg.status !== "thinking" &&
          msg.content && (
            <div className="mt-1.5 flex items-start gap-3">
              {conversationId && (
                <FeedbackButtons conversationId={conversationId} message={msg} />
              )}
              <span className="text-[10px] text-[var(--text-tertiary)] self-center">
                <CopyButton text={msg.content} />
              </span>
            </div>
          )}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const locale = useLocale((s) => s.locale);
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-[10px] hover:text-[var(--text-secondary)]"
    >
      {copied ? `✓ ${t("copied", locale)}` : t("copy", locale)}
    </button>
  );
}
