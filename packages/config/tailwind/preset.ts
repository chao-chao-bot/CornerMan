import type { Config } from "tailwindcss";

/**
 * @cornerman/config · Coach Lab 设计令牌 Tailwind 预设
 *
 * 令牌来源：design-preview/coach-lab/coach-lab.css。
 * apps/web 与 packages/ui 共用本预设，保证视觉一致。
 */
const preset: Omit<Config, "content"> = {
  theme: {
    extend: {
      colors: {
        // 背景与表面
        bg: "#f4f6f8",
        surface: {
          DEFAULT: "#ffffff",
          2: "#eef1f5",
          3: "#e6eaf0"
        },
        // 描边
        line: {
          DEFAULT: "#e2e6eb",
          strong: "#cdd4dd"
        },
        // 文本
        ink: {
          DEFAULT: "#1f2937",
          2: "#5b6470",
          3: "#8a93a0"
        },
        // 主色：钢蓝
        brand: {
          DEFAULT: "#1e5aa8",
          hover: "#184c90",
          soft: "#e7eef7",
          line: "#c5d8ee"
        },
        // 语义色
        revise: { DEFAULT: "#f08a24", soft: "#fdefe0", line: "#f3cfa3" }, // 用户修订
        improved: { DEFAULT: "#1fa971", soft: "#e3f5ee", line: "#b4e3d0" }, // 已改进
        risk: { DEFAULT: "#d14747", soft: "#fbe9e9", line: "#eebcbc" }, // 仍存在 / 风险
        amber: "#c8892f" // 低置信度
      },
      borderRadius: {
        lg: "14px",
        DEFAULT: "10px",
        sm: "7px"
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "PingFang SC",
          "HarmonyOS Sans",
          "Microsoft YaHei",
          "sans-serif"
        ]
      }
    }
  }
};

export default preset;
