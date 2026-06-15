"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** 左侧按钮（默认「取消」） */
  leading?: ReactNode;
  /** 右侧按钮（如「完成」） */
  trailing?: ReactNode;
  children: ReactNode;
}

/**
 * HIG 风格的底部 Sheet：grabber + 蒙层、下滑关闭。
 * 视觉令牌对齐 design-preview/ios-hig（.sheet/.scrim/.grabber/.sheet-nav）。
 */
export function BottomSheet({
  open,
  onClose,
  title,
  leading,
  trailing,
  children
}: BottomSheetProps) {
  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="hig-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <motion.div
            className="hig-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 34, stiffness: 360 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
          >
            <div className="grabber" />
            <div className="sheet-nav">
              <span>
                {leading ?? (
                  <button type="button" onClick={onClose}>
                    取消
                  </button>
                )}
              </span>
              {title && <span className="t">{title}</span>}
              <span style={{ textAlign: "right" }}>{trailing}</span>
            </div>
            <div className="sheet-body">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
