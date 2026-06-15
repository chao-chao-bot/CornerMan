// CornerMan 移动端设计 Demo · 交互脚本（纯静态，无依赖）

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- 屏幕切换 ---------- */
function goTo(id) {
  $$(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
  $$("#screenSwitch button").forEach((b) =>
    b.classList.toggle("active", b.dataset.go === id)
  );
  const vp = $(".viewport");
  if (vp) vp.scrollTop = 0;
  $(".screen.active")?.scrollTo({ top: 0 });
}

document.addEventListener("click", (e) => {
  const target = e.target.closest("[data-go]");
  if (!target) return;
  // FAB / 模板卡进入编辑器前先关 sheet
  closeSheet();
  goTo(target.dataset.go);
});

/* ---------- Bottom Sheet ---------- */
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

$("#fabBtn")?.addEventListener("click", openSheet);
scrim?.addEventListener("click", closeSheet);

// 下滑手势关闭 sheet
let sheetStartY = null;
sheet?.addEventListener("touchstart", (e) => {
  sheetStartY = e.touches[0].clientY;
}, { passive: true });
sheet?.addEventListener("touchmove", (e) => {
  if (sheetStartY === null) return;
  const dy = e.touches[0].clientY - sheetStartY;
  if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
}, { passive: true });
sheet?.addEventListener("touchend", (e) => {
  const dy = e.changedTouches[0].clientY - (sheetStartY ?? 0);
  sheet.style.transform = "";
  if (dy > 90) closeSheet();
  sheetStartY = null;
});

/* ---------- 富文本 Block 聚焦 + 软键盘工具条 ---------- */
const kbd = $("#kbdToolbar");
let activeEditable = null;

$$(".block .editable, #builder .editable").forEach((el) => {
  el.addEventListener("focus", () => {
    activeEditable = el;
    el.closest(".block")?.classList.add("focused");
    if (el.closest("#editor")) kbd.classList.add("open");
  });
  el.addEventListener("blur", () => {
    el.closest(".block")?.classList.remove("focused");
    markSaving();
  });
  el.addEventListener("input", scheduleSave);
});

$("#kbdDone")?.addEventListener("click", () => {
  kbd.classList.remove("open");
  activeEditable?.blur();
});

$$(".kbd-toolbar .kb").forEach((btn) => {
  // 用 mousedown 防止编辑器失焦
  btn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const cmd = btn.dataset.cmd;
    if (cmd === "hilite") {
      document.execCommand("backColor", false, "#5a4a12");
    } else if (cmd === "formatBlock-h3") {
      document.execCommand("formatBlock", false, "h3");
    } else {
      document.execCommand(cmd, false, null);
    }
    scheduleSave();
  });
});

/* ---------- 保存状态（防抖自动保存） ---------- */
const saveChip = $("#saveChip");
let saveTimer = null;

function markSaving() {
  if (!saveChip) return;
  saveChip.classList.add("saving");
  saveChip.innerHTML = '<span class="dot"></span>保存中…';
}
function markSaved() {
  if (!saveChip) return;
  saveChip.classList.remove("saving");
  saveChip.innerHTML = '<span class="dot"></span>已保存';
}
function scheduleSave() {
  markSaving();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(markSaved, 900);
}

/* ---------- 评分星星 ---------- */
$("#ratingStars")?.addEventListener("click", (e) => {
  const star = e.target.closest(".s");
  if (!star) return;
  const stars = $$("#ratingStars .s");
  const idx = stars.indexOf(star);
  stars.forEach((s, i) => s.classList.toggle("on", i <= idx));
  scheduleSave();
});

/* ---------- 异步视频挂载：缩略图 + 环形进度 ---------- */
const RING_R = 16;
const RING_C = 2 * Math.PI * RING_R;
const EMOJIS = ["🥊", "🎥", "🤜", "🥋", "🏆"];

$("#addMedia")?.addEventListener("click", () => {
  const grid = $("#mediaGrid");
  const addBtn = $("#addMedia");

  const cell = document.createElement("div");
  cell.className = "media-cell";
  cell.innerHTML = `
    <div style="font-size:24px;">${EMOJIS[Math.floor(Math.random() * EMOJIS.length)]}</div>
    <div class="overlay">
      <svg class="ring" viewBox="0 0 40 40">
        <circle class="track" cx="20" cy="20" r="${RING_R}"></circle>
        <circle class="bar" cx="20" cy="20" r="${RING_R}"
          stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}"></circle>
      </svg>
    </div>
    <span class="badge">上传中</span>`;
  grid.insertBefore(cell, addBtn);

  const bar = $(".bar", cell);
  const overlay = $(".overlay", cell);
  const badge = $(".badge", cell);

  let pct = 0;
  const tick = setInterval(() => {
    pct += Math.random() * 16 + 6;
    if (pct >= 100) {
      pct = 100;
      clearInterval(tick);
      badge.textContent = "转码中";
      setTimeout(() => {
        overlay.classList.add("done");
        badge.textContent = "已就绪";
        badge.classList.add("ready");
        showToast("视频已就绪，可在记录里回看");
      }, 1100);
    }
    bar.style.strokeDashoffset = String(RING_C * (1 - pct / 100));
  }, 260);

  showToast("视频已加入，继续写文字即可");
});

/* ---------- 模板 Builder：点击添加 + 删除 ---------- */
$("#fieldLib")?.addEventListener("click", (e) => {
  const chip = e.target.closest(".field-chip");
  if (!chip) return;
  const canvas = $("#builderCanvas");
  const item = document.createElement("div");
  item.className = "builder-item";
  item.innerHTML = `
    <span class="handle">⠿</span>
    <div class="info"><div class="n">${chip.dataset.name}</div><div class="t">${chip.dataset.type}</div></div>
    <button class="del" aria-label="删除">×</button>`;
  canvas.appendChild(item);
  item.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

$("#builderCanvas")?.addEventListener("click", (e) => {
  const del = e.target.closest(".del");
  if (!del) return;
  const item = del.closest(".builder-item");
  item.style.transition = "opacity .2s ease, transform .2s ease";
  item.style.opacity = "0";
  item.style.transform = "translateX(20px)";
  setTimeout(() => item.remove(), 200);
});

$("#saveTmpl")?.addEventListener("click", () => {
  showToast("模板已保存到「我的模板」");
  setTimeout(() => goTo("home"), 700);
});

/* ---------- toast ---------- */
let toastTimer = null;
function showToast(msg) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}
