"use client";

import { useState } from "react";
import { DatePicker, Picker } from "antd-mobile";
import { useAdmDarkSync } from "./use-hig-theme";

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

interface HigDateFieldProps {
  /** 选中的日期；null 表示未选择（显示 placeholder） */
  value: Date | null;
  max?: Date;
  /** 未选择时的占位文案 */
  placeholder?: string;
  onChange: (d: Date) => void;
}

/** iOS 风格日期选择：可点击取值 + 底部滚轮弹层（antd-mobile DatePicker，precision=day） */
export function HigDateField({
  value,
  max,
  placeholder = "选择日期",
  onChange
}: HigDateFieldProps) {
  useAdmDarkSync();
  const [visible, setVisible] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`hig-picker-trigger${value ? "" : " is-empty"}`}
        onClick={() => setVisible(true)}
      >
        {value ? fmtDate(value) : placeholder}
      </button>
      <DatePicker
        visible={visible}
        value={value ?? undefined}
        max={max}
        precision="day"
        title="选择日期"
        confirmText="确定"
        cancelText="取消"
        onClose={() => setVisible(false)}
        onConfirm={(d) => onChange(d)}
      />
    </>
  );
}

interface HigSelectFieldProps {
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}

/** iOS 风格单选：可点击取值 + 底部滚轮弹层（antd-mobile Picker） */
export function HigSelectField({ value, options, onChange }: HigSelectFieldProps) {
  useAdmDarkSync();
  const [visible, setVisible] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? "请选择";
  return (
    <>
      <button
        type="button"
        className="hig-picker-trigger as-chip"
        onClick={() => setVisible(true)}
      >
        {current}
      </button>
      <Picker
        columns={[options]}
        value={[value]}
        visible={visible}
        title="选择类型"
        confirmText="确定"
        cancelText="取消"
        onClose={() => setVisible(false)}
        onConfirm={(val) => {
          const v = val[0];
          if (typeof v === "string") onChange(v);
        }}
      />
    </>
  );
}
