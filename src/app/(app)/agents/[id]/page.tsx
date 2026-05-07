"use client";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuth } from "@/stores/auth";
import { useLocale } from "@/stores/locale";
import { t } from "@/lib/i18n";
import { ChatPanel } from "@/components/ChatPanel";
import { VideoGenForm } from "@/components/VideoGenForm";
import { VideoPreviewPanel } from "@/components/VideoPreviewPanel";
import { ShareModal } from "@/components/ShareModal";
import { BookIcon, LockIcon, ShareIcon } from "@/components/icons";
import type { Agent } from "@/types";

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const locale = useLocale((s) => s.locale);

  const cidFromUrl = search.get("cid");
  const autorespond = search.get("autorespond") === "1";
  const [activeConvId, setActiveConvId] = useState<string | null>(cidFromUrl);
  const [pendingPreview, setPendingPreview] = useState<
    | { language: "ja" | "en"; avatar: string; durationSec: number; submitting: boolean }
    | undefined
  >();
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    setActiveConvId(cidFromUrl);
    // When clicking the agent in the sidebar (cid drops), drop any video
    // preview state so the right panel resets to its empty placeholder.
    if (!cidFromUrl) setPendingPreview(undefined);
  }, [cidFromUrl]);

  const { data: agent, isLoading } = useQuery({
    queryKey: ["agent", params.id],
    queryFn: () => api.get<Agent>(`/agents/${params.id}`),
  });

  if (isLoading) return null;
  if (!agent) return <div className="p-8 text-sm text-[var(--text-tertiary)]">404</div>;

  const isOwnerOrAdmin = user?.role === "admin" || agent.ownerUserId === user?.id;
  const isAdmin = user?.role === "admin";

  const examples =
    agent.kind === "ceo_chatbot"
      ? [t("exampleAskQ1", locale), t("exampleAskRoi", locale), t("exampleAskRisk", locale)]
      : undefined;

  if (agent.isVideoAgent) {
    return (
      <div className="h-full flex overflow-hidden">
        {/* Form column (left) */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-8 py-6">
            <div className="flex items-center justify-end gap-1.5 mb-4">
              {isOwnerOrAdmin && (
                <Link
                  href={`/agents/${agent.id}/avatar-permissions`}
                  className="h-8 text-xs px-2.5 rounded-md border hover:bg-[var(--bg-muted)] flex items-center gap-1.5"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  <LockIcon /> {t("avatarPermissions", locale)}
                </Link>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="h-8 text-xs px-2.5 rounded-md border hover:bg-[var(--bg-muted)] flex items-center gap-1.5"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  <ShareIcon /> {t("share", locale)}
                </button>
              )}
            </div>
            <VideoGenForm
              agentId={agent.id}
              conversationId={activeConvId}
              onConversationCreated={(cid) => {
                setActiveConvId(cid);
                router.replace(`/agents/${agent.id}?cid=${cid}`);
              }}
              onPreview={(p) => setPendingPreview(p)}
            />
          </div>
        </div>

        {/* Preview column (right) */}
        <VideoPreviewPanel conversationId={activeConvId} pendingPreview={pendingPreview} />
        {shareOpen && <ShareModal agent={agent} onClose={() => setShareOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div
        className="px-5 py-3 border-b flex items-center justify-end gap-1.5"
        style={{ borderColor: "var(--border-default)" }}
      >
        {isOwnerOrAdmin && agent.hasKnowledgeBase && (
          <Link
            href={`/agents/${agent.id}/knowledge`}
            className="h-8 text-xs px-2.5 rounded-md border hover:bg-[var(--bg-muted)] flex items-center gap-1.5"
            style={{ borderColor: "var(--border-default)" }}
          >
            <BookIcon /> {t("knowledgeBase", locale)}
          </Link>
        )}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="h-8 text-xs px-2.5 rounded-md border hover:bg-[var(--bg-muted)] flex items-center gap-1.5"
            style={{ borderColor: "var(--border-default)" }}
          >
            <ShareIcon /> {t("share", locale)}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatPanel
          agent={agent}
          conversationId={activeConvId}
          emptyExamples={examples}
          autorespond={autorespond}
        />
      </div>
      {shareOpen && <ShareModal agent={agent} onClose={() => setShareOpen(false)} />}
    </div>
  );
}
