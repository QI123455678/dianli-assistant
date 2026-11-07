/**
 * 主应用逻辑：标签页切换、初始化、PWA 注册
 */
(function () {
  // 应用根路径（相对路径的基准），适配 GitHub Pages 子路径部署
  // 例如页面 URL 是 https://u.github.io/dianli-assistant/index.html
  // 则 APP_BASE = "dianli-assistant/"
  function computeBase() {
    const path = window.location.pathname; // 如 /dianli-assistant/index.html 或 /dianli-assistant/
    if (path.endsWith("/")) return path; // 已经是目录
    const idx = path.lastIndexOf("/");
    return path.slice(0, idx + 1); // 去掉文件名部分
  }
  window.APP_BASE = computeBase();

  const TABS = {
    news: { title: "新闻简报", init: () => NewsModule.initNews() },
    ledger: { title: "工作台账", init: () => LedgerModule.initLedger() },
    ai: { title: "AI 辅助", init: () => AIModule.initAI() },
  };

  const inited = {};

  function switchTab(tabName) {
    // 隐藏所有页面
    document.querySelectorAll(".tab-page").forEach((el) => el.classList.add("hidden"));
    // 显示目标页
    document.getElementById(`tab-${tabName}`).classList.remove("hidden");
    // 更新标签按钮状态
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    // 更新标题
    document.getElementById("header-title").textContent = TABS[tabName].title;
    // 首次进入时初始化该模块
    if (!inited[tabName]) {
      inited[tabName] = true;
      TABS[tabName].init();
    }
  }

  function initHeaderDate() {
    const d = new Date();
    const week = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
    document.getElementById("header-date").textContent =
      `${d.getMonth() + 1}月${d.getDate()}日 周${week}`;
  }

  function registerSW() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(window.APP_BASE + "sw.js").catch((err) => {
        console.error("SW 注册失败:", err);
      });
    }
  }

  function init() {
    initHeaderDate();
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });
    switchTab("news");
    registerSW();
  }

  // 全局 toast
  window.toast = function (msg) {
    let t = document.getElementById("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2200);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
