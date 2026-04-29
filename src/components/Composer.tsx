"use client";
import { useRef } from "react";
import { useLocale } from "@/stores/locale";
import { t } from "@/lib/i18n";
import { PaperclipIcon, SendIcon, StopIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export function Composer({
  draft,
  setDraft,
  files,
  setFiles,
  streaming,
  onSend,
  onStop,
  placeholder,
  disabled,
  hint,
  variant = "default",
}: {
  draft: string;
  setDraft: (v: string) => void;
  files: File[];
  setFiles: (fs: File[]) => void;
  streaming: boolean;
  onSend: () => void;
  onStop: () => void;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
  variant?: "default" | "centered";
}) {
  const locale = useLocale((s) => s.locale);
  const fileRef = useRef<HTMLInputElement>(null);
  const canSend = !disabled && (draft.trim().length > 0 || files.length > 0);

  return (
    <div
      className={cn(
        "rounded-2xl border bg-[var(--bg-default)] shadow-sm transition-shadow focus-within:shadow-md focus-within:border-[var(--border-strong)]",
        variant === "centered" && "shadow-md"
      )}
      style={{ borderColor: "var(--border-default)" }}
    >
      {files.length > 0 && (
        <div className="px-3 pt-3 flex gap-2 flex-wrap">
          {files.map((f, i) => (
            <span
              key={i}
              className="text-xs px-2 py-1 rounded-md border bg-[var(--bg-subtle)] inline-flex items-center gap-1.5"
              style={{ borderColor: "var(--border-default)" }}
            >
              <PaperclipIcon size={12} />
              {f.name}
              <button
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-error)]"
                aria-label="remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (canSend && !streaming) onSend();
          }
        }}
        placeholder={placeholder ?? t("composerPlaceholder", locale)}
        rows={variant === "centered" ? 3 : 2}
        disabled={disabled}
        className={cn(
          "w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm leading-6 text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none"
        )}
        style={{ fontFamily: "var(--font-body)" }}
      />
      <div className="flex items-center justify-between px-2 pb-2 pt-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
            title={t("attachFile", locale)}
          >
            <PaperclipIcon />
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".txt,.csv,.pptx,.docx,.xlsx,.pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => {
              const fs = Array.from(e.target.files ?? []);
              setFiles([...files, ...fs]);
              e.currentTarget.value = "";
            }}
          />
          {hint && (
            <span className="text-2xs text-[var(--text-tertiary)] hidden sm:inline ml-1">
              {hint}
            </span>
          )}
        </div>
        {streaming ? (
          <button
            onClick={onStop}
            className="h-9 px-3 rounded-lg text-sm font-medium border inline-flex items-center gap-1.5"
            style={{
              background: "var(--bg-default)",
              borderColor: "var(--border-strong)",
              color: "var(--text-primary)",
            }}
          >
            <StopIcon /> {t("stop", locale)}
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={!canSend}
            className={cn(
              "w-9 h-9 rounded-lg inline-flex items-center justify-center transition-opacity",
              canSend ? "" : "opacity-30 cursor-not-allowed"
            )}
            style={{
              background: "var(--red-solid)",
              color: "var(--text-contrast)",
            }}
            aria-label={t("send", locale)}
          >
            <SendIcon />
          </button>
        )}
      </div>
    </div>
  );
}
