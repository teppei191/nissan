"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiBase } from "@/lib/api-client";
import { useLocale } from "@/stores/locale";
import { t } from "@/lib/i18n";
import { ChatBubble } from "./ChatBubble";
import { Composer } from "./Composer";
import { AgentIcon } from "./icons";
import type { Agent, Conversation, Message } from "@/types";

export function ChatPanel({
  agent,
  conversationId,
  emptyExamples,
  autorespond,
}: {
  agent: Agent;
  conversationId: string | null;
  emptyExamples?: string[];
  autorespond?: boolean;
}) {
  const locale = useLocale((s) => s.locale);
  const qc = useQueryClient();

  const [activeConvId, setActiveConvId] = useState<string | null>(conversationId);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [showVideoBlocked, setShowVideoBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autorespondHandledRef = useRef<string | null>(null);

  useEffect(() => {
    setActiveConvId(conversationId);
    // Reset in-progress UI state whenever the conversation changes (incl. when
    // user clicks the agent in the sidebar to start a fresh chat).
    setDraft("");
    setFiles([]);
    setError(null);
    setShowVideoBlocked(false);
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStreaming(false);
  }, [conversationId]);

  const convQ = useQuery({
    queryKey: ["conversation", activeConvId],
    queryFn: () => api.get<Conversation>(`/conversations/${activeConvId}`),
    enabled: !!activeConvId,
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [convQ.data?.messages.length, streaming]);

  // One-shot auto-respond when arriving from home page
  useEffect(() => {
    if (!autorespond || !activeConvId || streaming) return;
    if (autorespondHandledRef.current === activeConvId) return;
    const msgs = convQ.data?.messages;
    if (!msgs || msgs.length === 0) return;
    const last = msgs[msgs.length - 1];
    if (last.role !== "user") return;
    autorespondHandledRef.current = activeConvId;
    void streamAssistant(activeConvId, last.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorespond, activeConvId, convQ.data?.messages.length]);

  async function ensureConversation(initial: string): Promise<string> {
    if (activeConvId) return activeConvId;
    const c = await api.post<{ agentId: string; title?: string }, Conversation>("/conversations", {
      agentId: agent.id,
      title: initial.slice(0, 30) || "新しいチャット",
    });
    setActiveConvId(c.id);
    qc.setQueryData(["conversation", c.id], c);
    qc.invalidateQueries({ queryKey: ["conversations"] });
    return c.id;
  }

  function detectVideoIntent(text: string): boolean {
    if (agent.isVideoAgent) return false;
    return /(動画|video\b|mp4|movie|録画)/i.test(text);
  }

  function appendMessageToCache(cid: string, msg: Message) {
    qc.setQueryData<Conversation>(["conversation", cid], (old) => {
      if (!old) return old;
      return { ...old, messages: [...old.messages, msg], updatedAt: msg.createdAt };
    });
  }

  function patchMessageInCache(cid: string, mid: string, patch: Partial<Message>) {
    qc.setQueryData<Conversation>(["conversation", cid], (old) => {
      if (!old) return old;
      return {
        ...old,
        messages: old.messages.map((m) => (m.id === mid ? { ...m, ...patch } : m)),
      };
    });
  }

  async function handleSend(overrideText?: string) {
    const text = (overrideText ?? draft).trim();
    if (!text && files.length === 0) return;
    setError(null);
    if (detectVideoIntent(text)) {
      setShowVideoBlocked(true);
      return;
    }
    const attachments = files.map((f) => ({ name: f.name, size: f.size, mime: f.type }));
    setDraft("");
    setFiles([]);
    try {
      const cid = await ensureConversation(text);

      // Optimistically render user msg immediately
      const tempUserId = `m-user-${Date.now()}`;
      appendMessageToCache(cid, {
        id: tempUserId,
        role: "user",
        content: text,
        attachments,
        createdAt: new Date().toISOString(),
      });

      // Persist user msg in background
      api
        .post<Partial<Message>, Message>(`/conversations/${cid}/messages`, {
          role: "user",
          content: text,
          attachments,
        })
        .then(() => qc.invalidateQueries({ queryKey: ["conversations"] }))
        .catch(() => {});

      // Start streaming the assistant
      await streamAssistant(cid, text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  async function streamAssistant(cid: string, prompt: string) {
    setStreaming(true);
    const tempId = `m-stream-${Date.now()}`;
    appendMessageToCache(cid, {
      id: tempId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      status: "thinking",
    });

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let acc = "";
    try {
      const res = await fetch(`${apiBase}/agents/${agent.id}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": locale,
        },
        body: JSON.stringify({ conversationId: cid, prompt }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error("stream failed");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data) as { delta?: string };
            if (parsed.delta) {
              acc += parsed.delta;
              patchMessageInCache(cid, tempId, { content: acc, status: "streaming" });
            }
          } catch {}
        }
      }
      patchMessageInCache(cid, tempId, { content: acc, status: "complete" });
      // Persist assistant
      api
        .post<Partial<Message>, Message>(`/conversations/${cid}/messages`, {
          role: "assistant",
          content: acc,
          status: "complete",
        })
        .then(() => qc.invalidateQueries({ queryKey: ["conversations"] }))
        .catch(() => {});
    } catch (e) {
      const wasAbort = e instanceof Error && e.name === "AbortError";
      patchMessageInCache(cid, tempId, {
        content: acc,
        status: wasAbort ? "stopped" : "error",
      });
      if (!wasAbort) {
        setError(locale === "ja" ? "応答エラーが発生しました。" : "Response error.");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  async function handleRegenerate() {
    if (!activeConvId || !convQ.data) return;
    const lastUser = [...convQ.data.messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    await streamAssistant(activeConvId, lastUser.content);
  }

  const messages = convQ.data?.messages ?? [];
  const lastMsg = messages[messages.length - 1];
  const canRegenerate =
    !streaming &&
    lastMsg &&
    lastMsg.role === "assistant" &&
    (lastMsg.status === "stopped" || lastMsg.status === "error");
  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="h-full flex items-center justify-center px-6">
            <div className="w-full max-w-2xl">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center mb-3">
                  <AgentIcon agent={agent} size="lg" />
                </div>
                <h2
                  className="text-2xl font-bold mb-1"
                  style={{ fontFamily: "var(--font-brand)" }}
                >
                  {agent.name}
                </h2>
                <p className="text-sm text-[var(--text-tertiary)] max-w-md mx-auto">
                  {agent.description}
                </p>
              </div>
              <Composer
                draft={draft}
                setDraft={setDraft}
                files={files}
                setFiles={setFiles}
                streaming={streaming}
                onSend={() => handleSend()}
                onStop={handleStop}
                placeholder={t("composerPlaceholder", locale)}
                hint={t("fileSupported", locale)}
                variant="centered"
              />
              {emptyExamples && emptyExamples.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
                  {emptyExamples.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(ex)}
                      className="text-left text-xs px-3 py-2.5 rounded-lg border bg-[var(--bg-default)] hover:bg-[var(--bg-subtle)] transition-colors text-[var(--text-secondary)]"
                      style={{ borderColor: "var(--border-default)" }}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
            {messages.map((m) => (
              <ChatBubble key={m.id} msg={m} conversationId={activeConvId} />
            ))}
            {canRegenerate && (
              <div className="flex justify-center">
                <button
                  onClick={handleRegenerate}
                  className="text-xs px-3 h-8 rounded-md border hover:bg-[var(--bg-muted)]"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  ↻ {t("regenerate", locale)}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {!isEmpty && (
        <div className="border-t px-6 py-3" style={{ borderColor: "var(--border-default)" }}>
          <div className="max-w-3xl mx-auto">
            {showVideoBlocked && (
              <div
                className="mb-3 px-3 py-2 rounded-md border text-sm"
                style={{
                  background: "var(--orange-subtle)",
                  borderColor: "var(--orange-muted)",
                  color: "var(--orange-strong)",
                }}
              >
                <div className="font-medium">{t("videoNotSupportedTitle", locale)}</div>
                <div className="text-xs mt-0.5">{t("videoNotSupportedBody", locale)}</div>
                <button
                  onClick={() => setShowVideoBlocked(false)}
                  className="text-xs underline mt-1"
                >
                  {locale === "ja" ? "閉じる" : "Dismiss"}
                </button>
              </div>
            )}
            {error && (
              <div
                className="mb-3 px-3 py-2 rounded-md border text-sm"
                style={{
                  background: "var(--red-subtle)",
                  borderColor: "var(--border-error)",
                  color: "var(--text-error)",
                }}
              >
                {error}
              </div>
            )}
            <Composer
              draft={draft}
              setDraft={setDraft}
              files={files}
              setFiles={setFiles}
              streaming={streaming}
              onSend={() => handleSend()}
              onStop={handleStop}
              hint={t("fileSupported", locale)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
