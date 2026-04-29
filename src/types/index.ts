export type Role = "admin" | "user";

// Display-only role label derived from role + agentAccess
export type DerivedRole = "Admin" | "Agent Owner" | "Agent Viewer" | "No access";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  department: string;
  disabled?: boolean;
  // Computed at /users response. Per-agent permission map (visible agents only).
  // For admin role this is empty (admins have implicit OWNER on all).
  agentAccess?: Record<string, "OWNER" | "VIEW">;
};

export type FeedbackEntry = {
  messageId: string;
  conversationId: string;
  type: "like" | "dislike";
  comment?: string;
  createdAt: string;
  userPreview: string;
};

export type FeedbackMonthly = {
  // YYYY-MM
  month: string;
  like: number;
  dislike: number;
};

export type FeedbackSummary = {
  agentId: string;
  agentName: string;
  likeCount: number;
  dislikeCount: number;
  // Last 6 months of like/dislike counts (oldest → newest)
  monthly: FeedbackMonthly[];
  // Full list of feedback entries (newest first)
  recent: FeedbackEntry[];
};

export type AgentKind = "ceo_chatbot" | "ceo_video" | "general";

export type AgentPermission = "OWNER" | "VIEW" | "NONE";

export type Agent = {
  id: string;
  kind: AgentKind;
  name: string;
  description: string;
  iconLabel: string;
  systemPromptPreview: string;
  ownerUserId: string;
  hasKnowledgeBase: boolean;
  isVideoAgent: boolean;
  // If true, agent is excluded from sidebar list (e.g., the general home assistant)
  hidden?: boolean;
};

export type Feedback = {
  type: "like" | "dislike";
  comment?: string;
  createdAt: string;
};

export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: { name: string; size: number; mime: string }[];
  createdAt: string;
  status?: "thinking" | "streaming" | "complete" | "stopped" | "error";
  videoOutput?: {
    url: string;
    thumbnailUrl: string;
    durationSec: number;
    language: "ja" | "en";
    avatar: string;
  };
  feedback?: Feedback;
};

export type Conversation = {
  id: string;
  agentId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
};

export type KnowledgeDoc = {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  retentionMonths: number;
  expiresAt: string;
};

export type Department =
  | "Executive"
  | "Sales"
  | "Marketing"
  | "Finance"
  | "Engineering"
  | "MarketIntelligence"
  | "Legal"
  | "HR";

export type SystemHealth = {
  uptimePercent: number;
  errorCount24h: number;
  alertsActive: number;
  apiLatencyMs: number;
  status: "healthy" | "degraded" | "down";
  series: { ts: string; latencyMs: number; errors: number }[];
};

export type LoginEvent = {
  id: string;
  userId: string;
  email: string;
  event: "login" | "logout" | "login_failed";
  ip: string;
  ts: string;
};

export type Locale = "ja" | "en";

export type AvatarOption = {
  id: string;
  label: string;
  color: string; // semantic token reference for icon background
};

export type AvatarPermissions = Record<string, string[]>; // userId -> allowed avatar IDs ([] = none, undefined = all if has VIEW)
