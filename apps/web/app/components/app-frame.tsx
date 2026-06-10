"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AppShell, Button, navItemClass } from "@cornerman/ui";
import { clearAuth, getStoredUser, isAuthenticated } from "../lib/auth";

type NavItem = { href: string; label: string; disabled?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "训练",
    items: [
      { href: "/sessions", label: "训练记录" },
      { href: "/segments", label: "片段库", disabled: true }
    ]
  },
  {
    label: "成长",
    items: [
      { href: "/trends", label: "趋势看板" },
      { href: "/problems", label: "问题追踪" }
    ]
  }
];

export function AppFrame({
  children,
  rightPanel,
  headerExtras
}: {
  children: ReactNode;
  rightPanel?: ReactNode;
  headerExtras?: ReactNode;
}) {
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
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="mb-[22px]">
          <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
            {group.label}
          </div>
          {group.items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            if (item.disabled) {
              return (
                <span
                  key={item.href}
                  className="mb-0.5 flex cursor-default items-center justify-between gap-2.5 rounded-sm px-3 py-2 text-[13.5px] text-ink-3"
                  title="即将开放"
                >
                  {item.label}
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-3">
                    即将开放
                  </span>
                </span>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={navItemClass(active)}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
      <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
        本周
      </div>
      <div className="mt-1.5 rounded border border-line bg-surface-2 p-3.5">
        <div className="text-[26px] font-bold leading-none text-brand">—</div>
        <div className="mt-1 text-[11px] text-ink-3">本周训练 · 统计即将开放</div>
      </div>
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
    <AppShell
      nav={nav}
      headerRight={headerRight}
      headerExtras={headerExtras}
      rightPanel={rightPanel}
    >
      {children}
    </AppShell>
  );
}
