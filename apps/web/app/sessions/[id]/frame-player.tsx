"use client";

import { useEffect, useRef, useState } from "react";
import {
  Jump10BackIcon,
  Jump10FwdIcon,
  PauseIcon,
  PlayIcon,
  StepBackIcon,
  StepFwdIcon
} from "../../components/hig/icons";

const FPS = 30;
const SPEEDS = [0.25, 0.5, 1];

function fmt(s: number): string {
  if (!Number.isFinite(s)) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(
    ms
  ).padStart(3, "0")}`;
}

/** 逐帧复盘播放器：步进 / 刷度轴 / 慢放 / 键盘，对齐 design-preview/ios-hig */
export function FramePlayer({
  src,
  poster,
  title = "逐帧复盘",
  onClose
}: {
  src: string;
  poster?: string;
  title?: string;
  onClose: () => void;
}) {
  const vidRef = useRef<HTMLVideoElement | null>(null);
  const scrubRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(0);
  const [tc, setTc] = useState("00:00.000 / 00:00.000");
  const [ratio, setRatio] = useState(0);
  const [rate, setRate] = useState(1);

  function render() {
    const vid = vidRef.current;
    if (!vid) return;
    const dur = vid.duration || 0;
    const t = vid.currentTime || 0;
    setFrame(Math.round(t * FPS));
    setTc(`${fmt(t)} / ${fmt(dur)}`);
    setRatio(dur ? t / dur : 0);
  }

  function step(frames: number) {
    const vid = vidRef.current;
    if (!vid) return;
    vid.pause();
    const dur = vid.duration || 0;
    vid.currentTime = Math.max(
      0,
      Math.min(dur, vid.currentTime + frames / FPS)
    );
  }

  function togglePlay() {
    const vid = vidRef.current;
    if (!vid) return;
    if (vid.paused) void vid.play();
    else vid.pause();
  }

  function setSpeed(r: number) {
    const vid = vidRef.current;
    if (vid) vid.playbackRate = r;
    setRate(r);
  }

  // 平滑刷新播放头：优先 requestVideoFrameCallback
  useEffect(() => {
    const vid = vidRef.current;
    if (!vid) return;
    let raf = 0;
    let cancelled = false;
    type RVFC = HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    };
    const v = vid as RVFC;
    const loop = () => {
      if (cancelled) return;
      render();
      if (typeof v.requestVideoFrameCallback === "function") {
        v.requestVideoFrameCallback(loop);
      } else {
        raf = requestAnimationFrame(loop);
      }
    };
    loop();
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // 打开时锁定 body 滚动
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // 键盘：←/→ 单帧，Shift+←/→ ±10 帧，空格 播放/暂停，Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(e.shiftKey ? -10 : -1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        step(e.shiftKey ? 10 : 1);
      } else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const seekAt = (clientX: number) => {
    const vid = vidRef.current;
    const scrub = scrubRef.current;
    if (!vid || !scrub) return;
    const rect = scrub.getBoundingClientRect();
    const r = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    vid.currentTime = r * (vid.duration || 0);
    render();
  };

  const scrubbing = useRef(false);

  // 长按连续步进的计时器：用 ref 持久化，避免渲染间闭包失效导致 stop 清不掉，
  // 进而留下一个永久 setInterval 不停 pause()，让播放无法继续/暂停失灵。
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopHold = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (repeatTimerRef.current) clearInterval(repeatTimerRef.current);
    holdTimerRef.current = null;
    repeatTimerRef.current = null;
  };

  // 卸载时清掉残留计时器
  useEffect(() => stopHold, []);

  // 单帧按钮：点按步进一帧，长按后连续步进
  function holdProps(dir: number) {
    return {
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        stopHold();
        step(dir);
        holdTimerRef.current = setTimeout(() => {
          repeatTimerRef.current = setInterval(() => step(dir), 90);
        }, 350);
      },
      onPointerUp: stopHold,
      onPointerLeave: stopHold,
      onPointerCancel: stopHold
    };
  }

  return (
    <div className="hig-player">
      <div className="player-nav">
        <button type="button" className="hig-navbtn" onClick={onClose}>
          完成
        </button>
        <span className="pn-title">{title}</span>
        <span style={{ width: 56 }} />
      </div>

      <div className="player-stage">
        <video
          ref={vidRef}
          src={src}
          poster={poster}
          playsInline
          preload="metadata"
          onLoadedMetadata={render}
          onSeeked={render}
          onTimeUpdate={render}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
      </div>

      <div className="player-readout">
        <span className="frame-no">帧 {frame}</span>
        <span className="tc">{tc}</span>
      </div>

      <div
        ref={scrubRef}
        className="scrubber"
        onPointerDown={(e) => {
          scrubbing.current = true;
          vidRef.current?.pause();
          e.currentTarget.setPointerCapture(e.pointerId);
          seekAt(e.clientX);
        }}
        onPointerMove={(e) => {
          if (scrubbing.current) seekAt(e.clientX);
        }}
        onPointerUp={() => {
          scrubbing.current = false;
        }}
      >
        <div className="scrub-fill" style={{ width: `${ratio * 100}%` }} />
        <div className="scrub-knob" style={{ left: `${ratio * 100}%` }} />
      </div>

      <div className="transport">
        <button
          type="button"
          className="tbtn"
          aria-label="后退10帧"
          onClick={() => step(-10)}
        >
          <Jump10BackIcon />
          <span>10</span>
        </button>
        <button
          type="button"
          className="tbtn"
          aria-label="上一帧"
          {...holdProps(-1)}
        >
          <StepBackIcon />
        </button>
        <button
          type="button"
          className="tbtn play"
          aria-label="播放/暂停"
          onClick={togglePlay}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          type="button"
          className="tbtn"
          aria-label="下一帧"
          {...holdProps(1)}
        >
          <StepFwdIcon />
        </button>
        <button
          type="button"
          className="tbtn"
          aria-label="前进10帧"
          onClick={() => step(10)}
        >
          <Jump10FwdIcon />
          <span>10</span>
        </button>
      </div>

      <div className="speed-seg">
        {SPEEDS.map((r) => (
          <button
            key={r}
            type="button"
            className={rate === r ? "on" : ""}
            onClick={() => setSpeed(r)}
          >
            {r}×
          </button>
        ))}
      </div>

      <p className="player-note">
        逐帧：点 ‹帧 帧› 单帧步进（默认 30fps），慢放观察出拳轨迹与回防。拖动刷度轴可精确定位。
      </p>
    </div>
  );
}
