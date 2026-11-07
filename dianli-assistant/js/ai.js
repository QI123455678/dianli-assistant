/**
 * AI 辅助模块
 * 1. 一键分享文本给手机系统（用户选择蓝心小V等）
 * 2. 内置 AI 对话（调用 DeepSeek 等 OpenAI 兼容接口）
 */
(function () {
  const CONFIG_KEY = "dianli-ai-config";

  function getConfig() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG_KEY)) || {};
    } catch {
      return {};
    }
  }
  function setConfig(cfg) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  }

  function loadConfigToForm() {
    const c = getConfig();
    document.getElementById("ai-api-key").value = c.apiKey || "";
    document.getElementById("ai-api-base").value = c.apiBase || "https://api.deepseek.com";
    document.getElementById("ai-model").value = c.model || "deepseek-chat";
  }

  function saveConfig() {
    const c = {
      apiKey: document.getElementById("ai-api-key").value.trim(),
      apiBase: document.getElementById("ai-api-base").value.trim(),
      model: document.getElementById("ai-model").value.trim(),
    };
    setConfig(c);
    toast("AI 设置已保存");
  }

  // 分享文本给手机系统（安卓会弹出系统分享菜单，可选蓝心小V）
  async function shareToPhoneAI() {
    const text = document.getElementById("ai-share-text").value.trim();
    if (!text) {
      toast("请先在上方输入要分享的内容");
      return;
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: "请帮我处理以下内容", text });
      } else {
        await navigator.clipboard.writeText(text);
        toast("已复制，请打开蓝心小V粘贴");
      }
    } catch (err) {
      if (err && err.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(text);
        toast("已复制，请打开蓝心小V粘贴");
      } catch (e) {
        toast("分享失败");
      }
    }
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
  }

  function addMessage(role, content) {
    const box = document.getElementById("ai-messages");
    const div = document.createElement("div");
    div.className = `msg msg-${role}`;
    div.innerHTML = escapeHtml(content);
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return div;
  }

  function addLoading() {
    const box = document.getElementById("ai-messages");
    const div = document.createElement("div");
    div.className = "msg msg-assistant msg-loading";
    div.textContent = "思考中…";
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return div;
  }

  async function sendMessage() {
    const input = document.getElementById("ai-input");
    const text = input.value.trim();
    if (!text) return;

    const c = getConfig();
    if (!c.apiKey) {
      toast("请先在上方填写 AI 接口密钥并保存");
      return;
    }

    addMessage("user", text);
    input.value = "";
    const loading = addLoading();

    try {
      const res = await fetch(`${c.apiBase.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${c.apiKey}`,
        },
        body: JSON.stringify({
          model: c.model || "deepseek-chat",
          messages: [{ role: "user", content: text }],
          temperature: 0.7,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      const reply =
        data.choices && data.choices[0] && data.choices[0].message
          ? data.choices[0].message.content
          : "（无返回内容）";

      loading.remove();
      addMessage("assistant", reply);
    } catch (err) {
      loading.remove();
      console.error("AI 调用失败:", err);
      addMessage("assistant", "⚠️ 调用失败：" + err.message + "\n请检查网络和 API 密钥。");
    }
  }

  function initAI() {
    loadConfigToForm();
    document.getElementById("btn-share-ai").addEventListener("click", shareToPhoneAI);
    document.getElementById("btn-save-ai-config").addEventListener("click", saveConfig);
    document.getElementById("btn-ai-send").addEventListener("click", sendMessage);
    document.getElementById("ai-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMessage();
    });
    // 初始欢迎语
    addMessage(
      "assistant",
      "你好！我是内置 AI。你可以直接问我问题，或把要处理的文字粘到上方文本框、点「分享给蓝心小V」交给手机 AI。"
    );
  }

  window.AIModule = { initAI };
})();
