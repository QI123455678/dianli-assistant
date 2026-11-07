/**
 * 新闻简报模块
 * 调用云端 /api/news 获取电力行业每日新闻，展示标题+摘要+日期+原文链接
 */
(function () {
  let newsData = { items: [] };

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderNews() {
    const listEl = document.getElementById("news-list");
    const emptyEl = document.getElementById("news-empty");
    const metaEl = document.getElementById("news-meta");
    const items = newsData.items || [];

    if (!items.length) {
      listEl.innerHTML = "";
      emptyEl.classList.remove("hidden");
      metaEl.textContent = "";
      return;
    }
    emptyEl.classList.add("hidden");

    const generated = newsData.generatedAt
      ? new Date(newsData.generatedAt).toLocaleString("zh-CN")
      : "";
    metaEl.textContent = `共 ${items.length} 条 · 更新于 ${generated}`;

    listEl.innerHTML = items
      .map((item) => {
        const safeUrl = item.url || "#";
        const summary = item.summary
          ? `<div class="news-summary">${escapeHtml(item.summary)}</div>`
          : "";
        return `
        <a class="card news-item" href="${safeUrl}" target="_blank" rel="noopener noreferrer">
          <div class="news-title">${escapeHtml(item.title)}</div>
          ${summary}
          <div class="news-foot">
            <span class="news-source">${escapeHtml(item.sourceName || "")}</span>
            <span class="news-date">${escapeHtml(item.date || "")}</span>
          </div>
        </a>`;
      })
      .join("");
  }

  async function refreshNews() {
    const btn = document.getElementById("btn-refresh-news");
    btn.disabled = true;
    btn.textContent = "⏳ 抓取中…";
    try {
      // 优先实时接口（Vercel），失败回退静态文件（GitHub Pages）
      const base = window.APP_BASE || "";
      let data = null;
      try {
        const res = await fetch(base + "api/news", { cache: "no-store" });
        if (res.ok) data = await res.json();
      } catch (e) {
        // /api/news 不存在（GitHub Pages 环境），回退静态文件
      }
      if (!data || !data.ok) {
        const res2 = await fetch(base + "news.json", { cache: "no-store" });
        if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
        data = await res2.json();
      }

      newsData = data;
      renderNews();
      if (!data.count) {
        toast("已刷新，但暂时没抓到电力相关新闻，请稍后再试");
      } else {
        toast(`已更新 ${data.count} 条新闻`);
      }
    } catch (err) {
      console.error("新闻抓取失败:", err);
      toast("抓取失败，请检查网络后重试");
      renderNews(); // 保留旧数据
    } finally {
      btn.disabled = false;
      btn.textContent = "🔄 刷新简报";
    }
  }

  async function shareNews() {
    const items = newsData.items || [];
    if (!items.length) {
      toast("先刷新出新闻简报再分享");
      return;
    }
    const dateStr = new Date().toLocaleDateString("zh-CN");
    const text =
      `【电力行业每日简报 ${dateStr}】\n\n` +
      items
        .slice(0, 20)
        .map((it, i) => `${i + 1}. ${it.title}\n   ${it.url}`)
        .join("\n");

    try {
      if (navigator.share) {
        await navigator.share({ title: "电力行业每日简报", text });
      } else {
        await navigator.clipboard.writeText(text);
        toast("已复制简报，可粘贴分享");
      }
    } catch (err) {
      if (err && err.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(text);
        toast("已复制简报，可粘贴分享");
      } catch (e) {
        toast("分享失败");
      }
    }
  }

  function initNews() {
    document.getElementById("btn-refresh-news").addEventListener("click", refreshNews);
    document.getElementById("btn-share-news").addEventListener("click", shareNews);
    refreshNews();
  }

  window.NewsModule = { initNews, refreshNews, shareNews, getData: () => newsData };
})();
