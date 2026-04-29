import type { Conversation, Locale, Message } from "@/types";

type I18nText = { ja: string; en: string };

type MessageI18n = Omit<Message, "content"> & { content: I18nText };
type ConversationI18n = Omit<Conversation, "title" | "messages"> & {
  title: I18nText;
  messages: MessageI18n[];
};

const now = Date.now();
const minutes = (n: number) => new Date(now - n * 60_000).toISOString();
const hours = (n: number) => new Date(now - n * 3600_000).toISOString();
const days = (n: number) => new Date(now - n * 86400_000).toISOString();

export const initialConversationsI18n: ConversationI18n[] = [
  {
    id: "c-1",
    agentId: "a-ceo-chatbot",
    title: {
      ja: "Q1 ROI レビュー方針",
      en: "Q1 ROI review approach",
    },
    createdAt: hours(2),
    updatedAt: minutes(15),
    messages: [
      {
        id: "m-1",
        role: "user",
        content: {
          ja: "Q1 の ROI レビューについて、経営会議向けの要点を教えてください。",
          en: "Please summarize Q1 ROI review highlights for the executive meeting.",
        },
        createdAt: hours(2),
      },
      {
        id: "m-2",
        role: "assistant",
        content: {
          ja: "Q1 ROI レビューの要点は以下の3点です:\n\n1. 投資回収期間の見直し（中期計画との整合）\n2. KPI ツリーの再構成（売上 → 粗利 → ROIC）\n3. 想定リスク（為替・原材料）への感度分析\n\n社内ナレッジベースの「中計2026」セクション (p.12-18) を参照しています。",
          en: "Three key points for Q1 ROI review:\n\n1. Revisit payback periods (alignment with mid-term plan)\n2. Restructure the KPI tree (Revenue → Gross profit → ROIC)\n3. Sensitivity analysis on key risks (FX / raw materials)\n\nReferences: internal knowledge base \"Mid-term Plan 2026\" (p.12-18).",
        },
        createdAt: hours(2),
        status: "complete",
      },
    ],
  },
  {
    id: "c-2",
    agentId: "a-ceo-video",
    title: {
      ja: "Q1決算メッセージ動画 - 日本語版",
      en: "Q1 earnings message video — Japanese",
    },
    createdAt: days(2),
    updatedAt: days(2),
    messages: [
      {
        id: "m-3",
        role: "user",
        content: {
          ja: "[動画生成リクエスト]\n台本: Q1の業績ハイライト...\n言語: 日本語 / アバター: CEO Uchida",
          en: "[Video generation request]\nScript: Q1 performance highlights...\nLanguage: Japanese / Avatar: CEO Uchida",
        },
        createdAt: days(2),
      },
      {
        id: "m-4",
        role: "assistant",
        content: {
          ja: "動画を生成しました（言語: 日本語 / アバター: CEO Uchida）。プレーヤーから再生・ダウンロードできます。",
          en: "Video generated (Language: Japanese / Avatar: CEO Uchida). You can play or download it from the player.",
        },
        createdAt: days(2),
        status: "complete",
        videoOutput: {
          url: "/mock-video.mp4",
          thumbnailUrl: "",
          durationSec: 48,
          language: "ja",
          avatar: "CEO Uchida",
        },
      },
    ],
  },
];

export function resolveConversation(c: ConversationI18n, locale: Locale): Conversation {
  return {
    ...c,
    title: c.title[locale],
    messages: c.messages.map((m) => ({ ...m, content: m.content[locale] })),
  };
}

// Backwards-compat default — JP fallback for any direct access in code.
export const initialConversations: Conversation[] = initialConversationsI18n.map((c) =>
  resolveConversation(c, "ja")
);
