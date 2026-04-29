"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuth } from "@/stores/auth";
import { useLocale } from "@/stores/locale";
import { t } from "@/lib/i18n";
import { Composer } from "@/components/Composer";
import { NexusLogo } from "@/components/icons";
import type { Conversation, Message } from "@/types";

const GENERAL_AGENT_ID = "a-general";

export default function HomePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const locale = useLocale((s) => s.locale);

  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function send(overrideText?: string) {
    const text = (overrideText ?? draft).trim();
    if (!text && files.length === 0) return;
    setSubmitting(true);
    try {
      // Create conversation against the hidden general agent
      const c = await api.post<{ agentId: string; title?: string }, Conversation>(
        "/conversations",
        { agentId: GENERAL_AGENT_ID, title: text.slice(0, 30) || "新しいチャット" }
      );
      // Persist user message so it shows up immediately on the chat page
      await api.post<Partial<Message>, Message>(`/conversations/${c.id}/messages`, {
        role: "user",
        content: text,
        attachments: files.map((f) => ({ name: f.name, size: f.size, mime: f.type })),
      });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      // Navigate; chat page will pick up the conversation and we'll auto-stream a reply
      router.push(`/agents/${GENERAL_AGENT_ID}?cid=${c.id}&autorespond=1`);
    } catch {
      setSubmitting(false);
    }
  }

  const firstName =
    user?.name?.split(/\s+/)[0] ?? (locale === "ja" ? "ようこそ" : "there");
  const greeting =
    locale === "ja"
      ? `${firstName} さん、${t("homeWelcome", locale)}`
      : `${t("homeWelcome", locale)}, ${firstName}`;

  const quicks = [
    {
      key: "strategize",
      label: t("quickStrategize", locale),
      prompt:
        locale === "ja"
          ? "次四半期の優先施策を整理し、戦略上のインパクト・リスク・推奨アクションをまとめてください。"
          : "Help me prioritize next quarter's initiatives — strategic impact, risks, recommended actions.",
    },
    {
      key: "analyze",
      label: t("quickAnalyze", locale),
      prompt:
        locale === "ja"
          ? "直近の販売データから注目すべきトレンドを 3 点教えてください。"
          : "Surface the top 3 trends in our recent sales data.",
    },
    {
      key: "write",
      label: t("quickWrite", locale),
      prompt:
        locale === "ja"
          ? "Q1 業績ハイライトの社内向けアナウンスメントを書いてください。"
          : "Draft an internal announcement summarizing Q1 highlights.",
    },
    {
      key: "research",
      label: t("quickResearch", locale),
      prompt:
        locale === "ja"
          ? "競合 EV ラインナップの直近 3 ヶ月の動向を調べてまとめてください。"
          : "Research competitor EV lineup updates over the past 3 months.",
    },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 pt-24 pb-16">
        <div className="flex items-center justify-center gap-3 mb-8">
          <span style={{ color: "var(--color-red-50)" }}>
            <NexusLogo size={32} />
          </span>
          <h1
            className="text-3xl font-medium tracking-tight"
            style={{
              fontFamily: "var(--font-brand)",
              color: "var(--text-primary)",
            }}
          >
            {greeting}
          </h1>
        </div>

        <Composer
          draft={draft}
          setDraft={setDraft}
          files={files}
          setFiles={setFiles}
          streaming={submitting}
          onSend={() => send()}
          onStop={() => {}}
          placeholder={t("homePromptPlaceholder", locale)}
          variant="centered"
          hint={t("fileSupported", locale)}
          disabled={submitting}
        />

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {quicks.map((q) => (
            <button
              key={q.key}
              onClick={() => send(q.prompt)}
              disabled={submitting}
              className="text-xs h-9 px-3 rounded-full border bg-[var(--bg-default)] hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)] disabled:opacity-50 inline-flex items-center gap-1.5"
              style={{ borderColor: "var(--border-default)" }}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
