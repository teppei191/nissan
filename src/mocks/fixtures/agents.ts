import type { Agent, AgentPermission, AvatarOption, AvatarPermissions, Locale } from "@/types";

type I18nText = { ja: string; en: string };

type AgentI18n = Omit<Agent, "name" | "description" | "systemPromptPreview"> & {
  name: I18nText;
  description: I18nText;
  systemPromptPreview: I18nText;
};

export function pickI18n(s: I18nText, locale: Locale): string {
  return s[locale];
}

export const agentsI18n: AgentI18n[] = [
  {
    id: "a-general",
    kind: "general",
    name: { ja: "Digital Twin Hub アシスタント", en: "Digital Twin Hub Assistant" },
    description: {
      ja: "汎用アシスタント。一般的な質問・調査・要約・文章作成などをサポートします。",
      en: "General-purpose assistant. Helps with questions, research, summarization, and writing.",
    },
    iconLabel: "DT",
    systemPromptPreview: {
      ja: "Nissan Digital Twin Hub の汎用アシスタントです。",
      en: "General-purpose assistant for Nissan Digital Twin Hub.",
    },
    ownerUserId: "u-admin",
    hasKnowledgeBase: false,
    isVideoAgent: false,
    hidden: true,
  },
  {
    id: "a-ceo-chatbot",
    kind: "ceo_chatbot",
    name: { ja: "CEO Chatbot", en: "CEO Chatbot" },
    description: {
      ja: "経営層の意思決定を支援する CEO アバターチャットボット。RAG ナレッジベース搭載。",
      en: "CEO avatar chatbot that supports executive decision-making, backed by a RAG knowledge base.",
    },
    iconLabel: "CEO",
    systemPromptPreview: {
      ja: "あなたは Nissan の CEO 室の意思決定を支援するアシスタントです...",
      en: "You are an assistant supporting decision-making in Nissan's CEO office...",
    },
    ownerUserId: "u-owner1",
    hasKnowledgeBase: true,
    isVideoAgent: false,
  },
  {
    id: "a-ceo-video",
    kind: "ceo_video",
    name: { ja: "CEO Video Agent", en: "CEO Video Agent" },
    description: {
      ja: "台本と役員アバター・言語を指定して CEO ナレーション動画を生成するエージェント。",
      en: "Generates CEO narration videos from a script with selectable executive avatars and languages.",
    },
    iconLabel: "VID",
    systemPromptPreview: {
      ja: "ElevenLabs のクローン音声で役員アバター動画を生成します。",
      en: "Generates videos with cloned voice (ElevenLabs) using executive avatars.",
    },
    ownerUserId: "u-owner1",
    hasKnowledgeBase: false,
    isVideoAgent: true,
  },
];

// Localized resolver — used by handlers when serving a request for a given locale.
export function resolveAgents(locale: Locale): Agent[] {
  return agentsI18n.map((a) => ({
    ...a,
    name: a.name[locale],
    description: a.description[locale],
    systemPromptPreview: a.systemPromptPreview[locale],
  }));
}

// Backwards-compatible: provide a JP-fallback list for code that needs raw access
// (e.g., id-only lookups, hidden-flag filtering). Display fields default to JP.
export const agents: Agent[] = resolveAgents("ja");

export const initialAgentAccess: Record<string, Record<string, AgentPermission>> = {
  "a-general": {
    "u-admin": "OWNER",
    "u-owner1": "OWNER",
    "u-user1": "VIEW",
  },
  "a-ceo-chatbot": {
    "u-admin": "OWNER",
    "u-owner1": "OWNER",
    "u-user1": "VIEW",
  },
  "a-ceo-video": {
    "u-admin": "OWNER",
    "u-owner1": "OWNER",
    "u-user1": "VIEW",
  },
};

export const departmentAccess: Record<string, string[]> = {
  "a-ceo-chatbot": ["Executive", "MarketIntelligence"],
  "a-ceo-video": ["Executive"],
};

// CEO Video Agent: per-user avatar restrictions
export const AVATARS: AvatarOption[] = [
  { id: "uchida", label: "CEO Uchida", color: "var(--red-solid)" },
  { id: "stephen", label: "COO Stephen", color: "var(--blue-emphasized)" },
  { id: "guillaume", label: "CFO Guillaume", color: "var(--orange-emphasized)" },
];

// userId -> allowed avatar IDs. undefined => all allowed (admin), [] => none
export const initialAvatarPermissions: AvatarPermissions = {
  "u-admin": ["uchida", "stephen", "guillaume"],
  "u-owner1": ["uchida", "stephen", "guillaume"],
  "u-user1": ["uchida"], // user1 can only use CEO Uchida avatar
};
