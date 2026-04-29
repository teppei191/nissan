"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/stores/locale";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ChevronIcon } from "./icons";
import type { Agent } from "@/types";

type Permission = "OWNER" | "VIEW";
type Access = Record<string, Permission>;

type PanelPos = { top: number; left: number; minWidth: number; flipUp: boolean };

export function AgentAccessSelector({
  agents,
  value,
  onChange,
  size = "md",
  className,
}: {
  agents: Agent[];
  value: Access;
  onChange: (next: Access) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const locale = useLocale((s) => s.locale);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open) return;
    function compute() {
      const btn = btnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const vh = window.innerHeight;
      const flipUp = r.bottom + 320 > vh && r.top > vh - r.bottom;
      setPos({
        top: flipUp ? r.top - 4 : r.bottom + 4,
        left: r.left,
        minWidth: r.width,
        flipUp,
      });
    }
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function setAgent(id: string, next: Permission | null) {
    const copy = { ...value };
    if (next === null) delete copy[id];
    else copy[id] = next;
    onChange(copy);
  }

  // Build summary text
  const granted = agents.filter((a) => value[a.id]);
  const summary = (() => {
    if (granted.length === 0) return locale === "ja" ? "未付与" : "None";
    if (granted.length === agents.length) {
      const allOwner = granted.every((a) => value[a.id] === "OWNER");
      const allViewer = granted.every((a) => value[a.id] === "VIEW");
      if (allOwner) return `${t("allAgents", locale)} · ${t("permissionOwner", locale)}`;
      if (allViewer) return `${t("allAgents", locale)} · ${t("permissionViewer", locale)}`;
      return `${t("allAgents", locale)} · ${t("permissionMixed", locale)}`;
    }
    return granted
      .map((a) => `${a.name}: ${permLabel(value[a.id], locale)}`)
      .join(", ");
  })();

  const heightClass = size === "sm" ? "h-8 text-xs px-2" : "h-9 text-sm px-2.5";

  const panel =
    open && mounted && pos ? (
      <div
        ref={panelRef}
        className="rounded-md border bg-[var(--bg-default)] shadow-lg overflow-hidden"
        style={{
          position: "fixed",
          top: pos.flipUp ? undefined : pos.top,
          bottom: pos.flipUp ? window.innerHeight - pos.top : undefined,
          left: pos.left,
          minWidth: Math.max(280, pos.minWidth),
          zIndex: 60,
          borderColor: "var(--border-default)",
        }}
      >
        <div
          className="px-3 py-2 border-b text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]"
          style={{ borderColor: "var(--border-light)" }}
        >
          {t("agentsColumn", locale)}
        </div>
        <ul className="py-1">
          {agents.map((a) => {
            const v = value[a.id];
            return (
              <li
                key={a.id}
                className="px-3 py-2 flex items-center justify-between gap-3 hover:bg-[var(--bg-muted)]"
              >
                <span className="text-sm truncate">{a.name}</span>
                <PermSegment value={v ?? null} onChange={(p) => setAgent(a.id, p)} />
              </li>
            );
          })}
          {agents.length === 0 && (
            <li className="px-3 py-2 text-xs text-[var(--text-tertiary)]">
              {locale === "ja" ? "エージェントがありません" : "No agents"}
            </li>
          )}
        </ul>
      </div>
    ) : null;

  return (
    <div className={cn("inline-block", className)}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border bg-[var(--bg-default)] hover:bg-[var(--bg-muted)] transition-colors min-w-[180px] justify-between",
          heightClass
        )}
        style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="truncate">{summary}</span>
        <span className="shrink-0 text-[var(--text-tertiary)]">
          <ChevronIcon direction={open ? "up" : "down"} size={14} />
        </span>
      </button>
      {panel && createPortal(panel, document.body)}
    </div>
  );
}

function PermSegment({
  value,
  onChange,
}: {
  value: Permission | null;
  onChange: (next: Permission | null) => void;
}) {
  const locale = useLocale((s) => s.locale);
  const opts: { v: Permission | null; label: string }[] = [
    { v: null, label: t("permissionOff", locale) },
    { v: "VIEW", label: t("permissionViewer", locale) },
    { v: "OWNER", label: t("permissionOwner", locale) },
  ];
  return (
    <div
      className="inline-flex rounded border overflow-hidden text-[11px]"
      style={{ borderColor: "var(--border-default)" }}
    >
      {opts.map((o, i) => {
        const active = o.v === value;
        return (
          <button
            key={String(o.v)}
            type="button"
            onClick={() => onChange(o.v)}
            className={cn(
              "h-6 px-2 transition-colors",
              i > 0 && "border-l",
              active
                ? "text-[var(--text-contrast)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
            )}
            style={{
              borderColor: "var(--border-default)",
              background: active ? "var(--color-red-50)" : "var(--bg-default)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function permLabel(p: Permission, locale: "ja" | "en"): string {
  if (p === "OWNER") return t("permissionOwner", locale);
  return t("permissionViewer", locale);
}
