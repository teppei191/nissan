"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuth } from "@/stores/auth";
import { useLocale } from "@/stores/locale";
import { t } from "@/lib/i18n";
import { AgentIcon } from "@/components/icons";
import { formatBytes, formatRelative } from "@/lib/utils";
import type { Agent, KnowledgeDoc } from "@/types";

const SUPPORTED = [".txt", ".csv", ".docx", ".pdf"];
const MAX_SIZE_BYTES = 50 * 1024 * 1024;

export default function KnowledgePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const locale = useLocale((s) => s.locale);
  const qc = useQueryClient();

  const [retentionMonths, setRetentionMonths] = useState(12);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const agentQ = useQuery({
    queryKey: ["agent", params.id],
    queryFn: () => api.get<Agent>(`/agents/${params.id}`),
  });
  const docsQ = useQuery({
    queryKey: ["kb", params.id],
    queryFn: () => api.get<{ docs: KnowledgeDoc[] }>(`/agents/${params.id}/knowledge`),
  });

  useEffect(() => {
    if (agentQ.data && user) {
      const isOwnerOrAdmin = user.role === "admin" || agentQ.data.ownerUserId === user.id;
      if (!isOwnerOrAdmin || !agentQ.data.hasKnowledgeBase) {
        router.replace(`/agents/${params.id}`);
      }
    }
  }, [agentQ.data, user, router, params.id]);

  async function handleUpload(file: File) {
    setError(null);
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!SUPPORTED.includes(ext)) {
      setError(
        locale === "ja"
          ? `対応していないファイル形式です: ${ext}`
          : `Unsupported file type: ${ext}`
      );
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError(t("fileTooLarge", locale));
      return;
    }
    setUploading(true);
    try {
      await api.post<
        { name: string; size: number; retentionMonths: number },
        KnowledgeDoc
      >(`/agents/${params.id}/knowledge`, {
        name: file.name,
        size: file.size,
        retentionMonths,
      });
      qc.invalidateQueries({ queryKey: ["kb", params.id] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string) {
    await api.del(`/agents/${params.id}/knowledge/${docId}`);
    qc.invalidateQueries({ queryKey: ["kb", params.id] });
  }

  if (!agentQ.data) return null;
  const agent = agentQ.data;
  const docs = docsQ.data?.docs ?? [];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-8">
      <nav className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] mb-4">
        <Link
          href={`/agents/${agent.id}`}
          className="hover:text-[var(--text-secondary)] flex items-center gap-1.5"
        >
          <AgentIcon agent={agent} size="sm" />
          {agent.name}
        </Link>
        <span>›</span>
        <span className="text-[var(--text-secondary)]">{t("knowledgeBase", locale)}</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-xl font-bold mb-1" style={{ fontFamily: "var(--font-brand)" }}>
          {t("knowledgeBase", locale)} {t("ownerOnly", locale)}
        </h1>
        <p className="text-sm text-[var(--text-tertiary)]">{t("knowledgeNote", locale)}</p>
      </header>

      <section
        className="mb-6 border rounded-lg p-4"
        style={{ borderColor: "var(--border-default)", background: "var(--bg-subtle)" }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">
              {t("uploadDocument", locale)}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept={SUPPORTED.join(",")}
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.currentTarget.value = "";
              }}
              className="block text-xs file:mr-2 file:px-3 file:py-1.5 file:rounded file:border file:border-[var(--border-default)] file:bg-[var(--bg-default)] file:text-[var(--text-primary)] file:font-medium"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">
              {t("retentionMonths", locale)}
            </label>
            <input
              type="number"
              min={1}
              max={36}
              value={retentionMonths}
              onChange={(e) =>
                setRetentionMonths(
                  Math.max(1, Math.min(36, Number(e.target.value) || 12))
                )
              }
              disabled={uploading}
              className="w-28 h-9 px-3 rounded-md border text-sm bg-[var(--bg-default)] focus:outline-none focus:border-[var(--text-primary)]"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            />
          </div>
        </div>
        {uploading && (
          <div className="mt-2 text-xs text-[var(--text-tertiary)]">
            {locale === "ja" ? "アップロード中..." : "Uploading..."}
          </div>
        )}
        {error && (
          <div
            className="mt-3 px-3 py-2 rounded-md border text-sm"
            style={{
              background: "var(--red-subtle)",
              borderColor: "var(--border-error)",
              color: "var(--text-error)",
            }}
          >
            {error}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-bold mb-3" style={{ fontFamily: "var(--font-brand)" }}>
          {locale === "ja" ? "登録済みドキュメント" : "Indexed documents"} ({docs.length})
        </h2>
        {docs.length === 0 ? (
          <div className="text-sm text-[var(--text-tertiary)]">
            {locale === "ja" ? "ドキュメントはまだありません。" : "No documents yet."}
          </div>
        ) : (
          <div
            className="border rounded-lg overflow-hidden"
            style={{ borderColor: "var(--border-default)" }}
          >
            <table className="w-full text-sm">
              <thead style={{ background: "var(--bg-subtle)" }}>
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium text-[var(--text-secondary)]">
                    {locale === "ja" ? "ファイル名" : "File name"}
                  </th>
                  <th className="px-3 py-2 font-medium text-[var(--text-secondary)] w-24">
                    {locale === "ja" ? "サイズ" : "Size"}
                  </th>
                  <th className="px-3 py-2 font-medium text-[var(--text-secondary)] w-32">
                    {locale === "ja" ? "アップロード" : "Uploaded"}
                  </th>
                  <th className="px-3 py-2 font-medium text-[var(--text-secondary)] w-32">
                    {t("expiresColumn", locale)}
                  </th>
                  <th className="px-3 py-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d, i) => (
                  <tr
                    key={d.id}
                    className={i > 0 ? "border-t" : ""}
                    style={{ borderColor: "var(--border-light)" }}
                  >
                    <td className="px-3 py-2 truncate">📄 {d.name}</td>
                    <td className="px-3 py-2 text-[var(--text-tertiary)]">
                      {formatBytes(d.size)}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-tertiary)] text-xs">
                      {formatRelative(d.uploadedAt)}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-tertiary)] text-xs">
                      {new Date(d.expiresAt).toISOString().slice(0, 10)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleDelete(d.id)}
                        className="text-xs hover:underline"
                        style={{ color: "var(--text-error)" }}
                      >
                        {t("delete", locale)}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-[var(--text-tertiary)] leading-relaxed">
          {t("autoExcludeNote", locale)}
        </p>
      </section>
      </div>
    </div>
  );
}
