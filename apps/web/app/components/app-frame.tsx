"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AppShell, Button, navItemClass } from "@cornerman/ui";
import { clearAuth, getStoredUser, isAuthenticated } from "../lib/auth";

const NAV = [
  { href: "/sessions", label: "训练记录" },
  { href: "/trends", label: "趋势" },
  { href: "/problems", label: "问题追踪" }
];

export function AppFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    setName(getStoredUser()?.displayName || getStoredUser()?.username || "我");
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-3">
        加载中…
      </div>
    );
  }

  function logout() {
    clearAuth();
    router.replace("/login");
  }

  const nav = (
    <nav>
      <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
        训练
      </div>
      {NAV.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} className={navItemClass(active)}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const headerRight = (
    <div className="flex items-center gap-3">
      <span className="text-[13px] text-ink-2">{name}</span>
      <Button variant="ghost" onClick={logout}>
        退出
      </Button>
    </div>
  );

  return (
    <AppShell nav={nav} headerRight={headerRight}>
      {children}
    </AppShell>
  );
}
