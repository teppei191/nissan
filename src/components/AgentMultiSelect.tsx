"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/stores/locale";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ChevronIcon } from "./icons";
import type { Agent } from "@/types";

type PanelPos = {
  top: number;
  left: number;
  minWidth: number;
  flipUp: boolean;
};

export function AgentMultiSelect({
  agents,
  selected,
  onChange,
  placeholder,
  size = "md",
  showAllShortcut = true,
  emptyLabel,
  className,
  buttonStyle,
}: {
  agents: Agent[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  size?: "sm" | "md";
  showAllShortcut?: boolean;
  emptyLabel?: string;
  className?: string;
  buttonStyle?: React.CSSProperties;
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

  // Only count selections that match a visible agent so summary can't drift
  // when stale ids (e.g. hidden agents) live in `selected`.
  const visibleSelected = selected.filter((id) => agents.some((a) => a.id === id));
  const total = agents.length;
  const allChecked = total > 0 && visibleSelected.length === total;
  const noneChecked = visibleSelected.length === 0;

  function toggle(id: string) {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  }
  function selectAll() {
    onChange(agents.map((a) => a.id));
  }
  function clearAll() {
    onChange([]);
  }

  const summary = (() => {
    if (allChecked) return t("allAgents", locale);
    if (noneChecked) return emptyLabel ?? placeholder ?? (locale === "ja" ? "未選択" : "None");
    const names = agents.filter((a) => visibleSelected.includes(a.id)).map((a) => a.name);
    return names.join(", ");
  })();

  const heightClass = size === "sm" ? "h-8 text-xs px-2" : "h-9 text-sm px-2.5";

  const panel = open && mounted && pos ? (
    <div
      ref={panelRef}
      className="rounded-md border bg-[var(--bg-default)] shadow-lg overflow-hidden"
      style={{
        position: "fixed",
        top: pos.flipUp ? undefined : pos.top,
        bottom: pos.flipUp ? window.innerHeight - pos.top : undefined,
        left: pos.left,
        minWidth: Math.max(240, pos.minWidth),
        zIndex: 60,
        borderColor: "var(--border-default)",
      }}
    >
      {showAllShortcut && (
        <div
          className="flex items-center justify-between px-2 py-1.5 border-b text-[11px]"
          style={{ borderColor: "var(--border-light)" }}
        >
          <button
            onClick={selectAll}
            className="px-1.5 py-1 rounded hover:bg-[var(--bg-muted)] text-[var(--text-secondary)]"
          >
            {t("selectAll", locale)}
          </button>
          <button
            onClick={clearAll}
            className="px-1.5 py-1 rounded hover:bg-[var(--bg-muted)] text-[var(--text-secondary)]"
          >
            {t("clearSelection", locale)}
          </button>
        </div>
      )}
      <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
        {agents.map((a) => {
          const on = selected.includes(a.id);
          return (
            <li key={a.id}>
              <button
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => toggle(a.id)}
                className="w-full text-left px-2 py-1.5 flex items-center gap-2 hover:bg-[var(--bg-muted)]"
              >
                <input
                  type="checkbox"
                  checked={on}
                  readOnly
                  className="accent-[var(--color-red-50)]"
                />
                <span className="text-sm truncate">{a.name}</span>
              </button>
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
          "inline-flex items-center gap-1.5 rounded-md border bg-[var(--bg-default)] hover:bg-[var(--bg-muted)] transition-colors min-w-[140px] justify-between",
          heightClass
        )}
        style={{
          borderColor: "var(--border-default)",
          color: "var(--text-primary)",
          ...buttonStyle,
        }}
        aria-haspopup="listbox"
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
