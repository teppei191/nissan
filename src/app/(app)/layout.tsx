"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/stores/auth";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

const DEFAULT_ADMIN = {
  id: "u-admin",
  email: "admin@example.com",
  name: "Admin Tanaka",
  role: "admin" as const,
  department: "Executive",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("dt-hub-sidebar-collapsed");
    if (saved === "1") setCollapsed(true);
  }, []);

  // Auto-login: no login page; default to admin if not signed in.
  useEffect(() => {
    if (!user) setUser(DEFAULT_ADMIN);
  }, [user, setUser]);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem("dt-hub-sidebar-collapsed", next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  if (!user) return null;
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-default)]">
        <TopBar />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
