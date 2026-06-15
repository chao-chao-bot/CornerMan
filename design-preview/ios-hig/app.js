// CornerMan · iOS HIG Demo 交互（纯静态，无依赖）

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const frame = $("#frame");

/* ---------- 屏幕切换 ---------- */
function goTo(id) {
  $$(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
  $$("#seg button[data-go]").forEach((b) =>
    b.classList.toggle("active", b.dataset.go === id)
  );
  const active = $(`#${id} .content`);
  if (active) active.scrollTop = 0;
}

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-go]");
  if (!t) return;
  closeSheet();
  goTo(t.dataset.go);
});

/* ---------- 浅 / 深色外观（HIG 跟随系统） ---------- */
$$("#seg button[data-appearance]").forEach((b) => {
  b.addEventListener("click", () => {
    const mode = b.dataset.appearance;
    frame.setAttribute("data-theme", mode);
    $$("#seg button[data-appearance]").forEach((x) =>
      x.classList.toggle("active", x === b)
    );
  });
});

/* ---------- 大标题滚动折叠（导航栏材质） ---------- */
$$(".content").forEach((content) => {
  const navId = content.dataset.nav;
  const nav = navId ? document.getElementById(navId) : null;
  // editor / builder 的导航栏常驻 scrolled（已有标题），仅 list 跟随滚动
  if (!nav || nav.id !== "nav-list") return;
  content.addEventListener("scroll", () => {
    nav.classList.toggle("scrolled", content.scrollTop > 38);
  });
});

/* ---------- Sheet ---------- */
const scrim = $("#scrim");
const sheet = $("#sheet");
function openSheet() {
  scrim.classList.add("open");
  sheet.classList.add("open");
}
function closeSheet() {
  scrim.classList.remove("open");
  sheet.classList.remove("open");
}
$("#addBtn")?.addEventListener("click", openSheet);
$("#sheetCancel")?.addEventListener("click", closeSheet);
scrim?.addEventListener("click", closeSheet);

// 下滑关闭 sheet
let sy = null;
sheet?.addEventListener("touchstart", (e) => (sy = e.touches[0].clientY), { passive: true });
sheet?.addEventListener("touchmove", (e) => {
  if (sy === null) return;
  const dy = e.touches[0].clientY - sy;
  if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
}, { passive: true });
sheet?.addEventListener("touchend", (e) => {
  const dy = e.changedTouches[0].clientY - (sy ?? 0);
  sheet.style.transform = "";
  if (dy > 110) closeSheet();
  sy = null;
});

/* ---------- 完成按钮 ---------- */
$("#doneBtn")?.addEventListener("click", () => {
  showToast("已存储到训练档案");
  setTimeout(() => goTo("list"), 650);
});

/* ---------- 评分星标 ---------- */
$("#stars")?.addEventListener("click", (e) => {
  const star = e.target.closest(".s");
  if (!star) return;
  const arr = $$("#stars .s");
  const idx = arr.indexOf(star);
  arr.forEach((s, i) => s.classList.toggle("on", i <= idx));
});

/* ---------- 异步视频挂载：缩略图 + 环形进度 ---------- */
const R = 16.5;
const C = 2 * Math.PI * R;
const PH = ["🥊", "🎥", "🤜", "🥋", "🏆"];

$("#addMedia")?.addEventListener("click", () => {
  const grid = $("#mgrid");
  const addBtn = $("#addMedia");
  const cell = document.createElement("div");
  cell.className = "mcell";
  cell.innerHTML = `
    <span class="ph">${PH[Math.floor(Math.random() * PH.length)]}</span>
    <div class="ov">
      <svg class="ring" viewBox="0 0 40 40">
        <circle class="tk" cx="20" cy="20" r="${R}"></circle>
        <circle class="br" cx="20" cy="20" r="${R}"
          stroke-dasharray="${C}" stroke-dashoffset="${C}"></circle>
      </svg>
    </div>`;
  grid.insertBefore(cell, addBtn);

  const br = $(".br", cell);
  const ov = $(".ov", cell);
  let pct = 0;
  const tick = setInterval(() => {
    pct += Math.random() * 16 + 7;
    if (pct >= 100) {
      pct = 100;
      clearInterval(tick);
      setTimeout(() => {
        ov.classList.add("done");
        const c = document.createElement("span");
        c.className = "corner";
        c.innerHTML = '<svg><use href="#i-check"/></svg>';
        cell.appendChild(c);
        showToast("视频已就绪");
      }, 900);
    }
    br.style.strokeDashoffset = String(C * (1 - pct / 100));
  }, 240);

  showToast("视频已加入，继续写文字即可");
});

/* ---------- 模板编辑模式：添加 / 删除字段 ---------- */
$("#fieldLib")?.addEventListener("click", (e) => {
  const row = e.target.closest(".add-field-row");
  if (!row) return;
  const canvas = $("#canvas");
  const item = document.createElement("div");
  item.className = "edit-row";
  item.innerHTML = `
    <button class="minus" aria-label="删除"><svg><use href="#i-minus"/></svg></button>
    <div class="er-main"><div class="er-title">${row.dataset.name}</div><div class="er-sub">${row.dataset.type}</div></div>
    <span class="grip"><svg><use href="#i-grip"/></svg></span>`;
  canvas.appendChild(item);
  item.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

$("#canvas")?.addEventListener("click", (e) => {
  const del = e.target.closest(".minus");
  if (!del) return;
  const item = del.closest(".edit-row");
  item.style.transition = "opacity .2s ease, transform .2s ease";
  item.style.opacity = "0";
  item.style.transform = "translateX(16px)";
  setTimeout(() => item.remove(), 200);
});

$("#saveTmpl")?.addEventListener("click", () => {
  showToast("模板已存储");
  setTimeout(() => goTo("list"), 650);
});
$("#useTmpl")?.addEventListener("click", () => {
  closeSheet();
  goTo("editor");
});

/* ---------- 逐帧复盘播放器 ---------- */
const FPS = 30;
const vid = $("#vid");

if (vid) {
  const ppIcon = $("#ppIcon");
  const frameNo = $("#frameNo");
  const timecode = $("#timecode");
  const fill = $("#scrubFill");
  const knob = $("#scrubKnob");
  const scrubber = $("#scrubber");

  const fmt = (s) => {
    if (!Number.isFinite(s)) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 1000);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
  };

  function render() {
    const dur = vid.duration || 0;
    const t = vid.currentTime || 0;
    const ratio = dur ? t / dur : 0;
    frameNo.textContent = `帧 ${Math.round(t * FPS)}`;
    timecode.textContent = `${fmt(t)} / ${fmt(dur)}`;
    fill.style.width = `${ratio * 100}%`;
    knob.style.left = `${ratio * 100}%`;
  }

  // 平滑刷新播放头：优先 requestVideoFrameCallback
  function loop() {
    render();
    if ("requestVideoFrameCallback" in vid) {
      vid.requestVideoFrameCallback(loop);
    } else {
      requestAnimationFrame(loop);
    }
  }
  vid.addEventListener("loadedmetadata", () => {
    render();
    loop();
  });
  vid.addEventListener("seeked", render);
  vid.addEventListener("timeupdate", render);

  function setIcon(playing) {
    ppIcon.innerHTML = `<use href="#${playing ? "i-pause" : "i-play"}"/>`;
  }
  vid.addEventListener("play", () => setIcon(true));
  vid.addEventListener("pause", () => setIcon(false));

  $("#playPause")?.addEventListener("click", () => {
    if (vid.paused) vid.play();
    else vid.pause();
  });

  function step(frames) {
    vid.pause();
    const dur = vid.duration || 0;
    vid.currentTime = Math.max(0, Math.min(dur, vid.currentTime + frames / FPS));
  }
  $("#back10")?.addEventListener("click", () => step(-10));
  $("#fwd10")?.addEventListener("click", () => step(10));

  // 单帧：点按步进一帧；长按后连续步进
  [["#prevFrame", -1], ["#nextFrame", 1]].forEach(([sel, dir]) => {
    const btn = $(sel);
    if (!btn) return;
    let hold = null, repeat = null;
    const start = (e) => {
      e.preventDefault();
      step(dir); // 立即步进一帧
      hold = setTimeout(() => {
        repeat = setInterval(() => step(dir), 90);
      }, 350);
    };
    const stop = () => {
      if (hold) { clearTimeout(hold); hold = null; }
      if (repeat) { clearInterval(repeat); repeat = null; }
    };
    btn.addEventListener("pointerdown", start);
    btn.addEventListener("pointerup", stop);
    btn.addEventListener("pointerleave", stop);
    btn.addEventListener("pointercancel", stop);
  });

  // 慢放分段
  $("#speedSeg")?.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    vid.playbackRate = parseFloat(b.dataset.rate);
    $$("#speedSeg button").forEach((x) => x.classList.toggle("on", x === b));
  });

  // 拖动刷度轴定位
  let scrubbing = false;
  const seekAt = (clientX) => {
    const rect = scrubber.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    vid.currentTime = ratio * (vid.duration || 0);
    render();
  };
  scrubber?.addEventListener("pointerdown", (e) => {
    scrubbing = true;
    vid.pause();
    scrubber.setPointerCapture(e.pointerId);
    seekAt(e.clientX);
  });
  scrubber?.addEventListener("pointermove", (e) => {
    if (scrubbing) seekAt(e.clientX);
  });
  scrubber?.addEventListener("pointerup", () => (scrubbing = false));

  $("#grabFrame")?.addEventListener("click", () =>
    showToast(`已收藏 帧 ${Math.round((vid.currentTime || 0) * FPS)}`)
  );

  // 键盘：←/→ 单帧，Shift+←/→ 跳 10 帧，空格 播放/暂停
  document.addEventListener("keydown", (e) => {
    if (!$("#player").classList.contains("active")) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); step(e.shiftKey ? -10 : -1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); step(e.shiftKey ? 10 : 1); }
    else if (e.key === " ") { e.preventDefault(); vid.paused ? vid.play() : vid.pause(); }
  });
}

/* ---------- Toast ---------- */
let tt = null;
function showToast(msg) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(tt);
  tt = setTimeout(() => el.classList.remove("show"), 1700);
}
