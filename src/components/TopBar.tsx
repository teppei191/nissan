"use client";
import Link from "next/link";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useLocale } from "@/stores/locale";
import { t } from "@/lib/i18n";
import { ChevronIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types";

export function TopBar() {
  const pathname = usePathname();
  const params = useParams();
  const search = useSearchParams();
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);

  const agentId = (params?.id as string) ?? null;
  const { data: agent } = useQuery({
    queryKey: ["agent", agentId],
    queryFn: () => api.get<Agent>(`/agents/${agentId}`),
    enabled: !!agentId,
  });

  const crumbs: { label: string; href?: string }[] = [{ label: t("home", locale), href: "/" }];
  if (pathname === "/admin") {
    crumbs.push({ label: t("admin", locale) });
  } else if (agent) {
    if (search.get("cid")) {
      crumbs.push({ label: agent.name, href: `/agents/${agent.id}` });
      crumbs.push({ label: t("chat", locale) });
    } else if (pathname.endsWith("/knowledge")) {
      crumbs.push({ label: agent.name, href: `/agents/${agent.id}` });
      crumbs.push({ label: t("knowledgeBase", locale) });
    } else {
      crumbs.push({ label: agent.name });
    }
  }

  return (
    <header
      className="h-14 border-b px-5 flex items-center justify-between shrink-0"
      style={{
        background: "var(--bg-default)",
        borderColor: "var(--border-default)",
      }}
    >
      <nav className="flex items-center gap-1.5 text-sm min-w-0">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && (
              <span className="text-[var(--text-tertiary)]">
                <ChevronIcon size={12} />
              </span>
            )}
            {c.href ? (
              <Link
                href={c.href}
                className={cn(
                  "truncate",
                  i === crumbs.length - 1
                    ? "text-[var(--text-primary)] font-medium"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                )}
              >
                {c.label}
              </Link>
            ) : (
              <span
                className={cn(
                  "truncate",
                  i === crumbs.length - 1
                    ? "text-[var(--text-primary)] font-medium"
                    : "text-[var(--text-tertiary)]"
                )}
              >
                {c.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <div
          className="inline-flex border rounded-md overflow-hidden text-xs"
          style={{ borderColor: "var(--border-default)" }}
        >
          {(["ja", "en"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLocale(l)}
              className={cn(
                "px-2.5 h-7 transition-colors",
                locale === l
                  ? "bg-[var(--bg-inverted)] text-[var(--text-contrast)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
              )}
              style={{ fontFamily: "var(--font-brand)" }}
            >
              {l === "ja" ? "日本語" : "EN"}
            </button>
          ))}
        </div>
        {/* TODO Q2: per-agent settings (temperature, system prompt) slot */}
      </div>
    </header>
  );
}
