"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Login page is removed; auto-login takes over in (app)/layout.tsx
export default function LoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}
