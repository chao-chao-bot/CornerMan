/**
 * @cornerman/ui · 设计令牌
 *
 * 来源：design-preview/coach-lab/coach-lab.css（方案 C：浅灰 + 钢蓝 + 模块化）。
 * 作为 JS 侧引用入口；Tailwind 侧令牌见 @cornerman/config/tailwind/preset。
 */
export const tokens = {
  color: {
    bg: "#f4f6f8",
    surface: "#ffffff",
    surface2: "#eef1f5",
    surface3: "#e6eaf0",
    line: "#e2e6eb",
    lineStrong: "#cdd4dd",
    ink: "#1f2937",
    ink2: "#5b6470",
    ink3: "#8a93a0",
    blue: "#1e5aa8",
    blueHover: "#184c90",
    blueSoft: "#e7eef7",
    blueLine: "#c5d8ee",
    orange: "#f08a24",
    orangeSoft: "#fdefe0",
    orangeLine: "#f3cfa3",
    green: "#1fa971",
    greenSoft: "#e3f5ee",
    greenLine: "#b4e3d0",
    red: "#d14747",
    redSoft: "#fbe9e9",
    redLine: "#eebcbc",
    amber: "#c8892f"
  },
  radius: {
    lg: "14px",
    md: "10px",
    sm: "7px"
  },
  layout: {
    navWidth: "252px",
    topbarHeight: "53px",
    gap: "16px"
  }
} as const;

export type Tokens = typeof tokens;
