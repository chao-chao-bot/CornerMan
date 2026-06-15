"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProblemIcon, ListIcon, TemplateIcon, TrendIcon } from "./icons";

const TABS = [
  { href: "/sessions", label: "训练", Icon: ListIcon },
  { href: "/templates", label: "模板", Icon: TemplateIcon },
  { href: "/trends", label: "趋势", Icon: TrendIcon },
  { href: "/problems", label: "问题", Icon: ProblemIcon }
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <div className="hig-tabbar">
      {TABS.map(({ href, label, Icon }) => {
        const active =
          pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`hig-tab${active ? " active" : ""}`}
          >
            <Icon />
            <span>{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
