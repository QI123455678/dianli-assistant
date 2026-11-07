/**
 * 工作台账模块
 * 记录增删改查、搜索、按月筛选、统计、导出备份（JSON/CSV）
 */
(function () {
  let allRecords = [];
  let editingId = null;

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function today() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  async function loadRecords() {
    allRecords = await AppDB.getAllRecords();
    populateMonthFilter();
    renderLedger();
  }

  function populateMonthFilter() {
    const sel = document.getElementById("ledger-month");
    const months = new Set();
    for (const r of allRecords) {
      if (r.date) months.add(r.date.slice(0, 7));
    }
    const sorted = [...months].sort().reverse();
    const cur = sel.value;
    sel.innerHTML =
      '<option value="">全部月份</option>' +
      sorted.map((m) => `<option value="${m}">${m}</option>`).join("");
    if (cur) sel.value = cur;
  }

  function getFiltered() {
    const kw = document.getElementById("ledger-search").value.trim().toLowerCase();
    const month = document.getElementById("ledger-month").value;
    return allRecords.filter((r) => {
      if (month && !(r.date || "").startsWith(month)) return false;
      if (kw) {
        const hay = `${r.title} ${r.content} ${r.tags} ${r.date}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }

  function renderLedger() {
    const list = getFiltered();
    const listEl = document.getElementById("ledger-list");
    const emptyEl = document.getElementById("ledger-empty");
    const statsEl = document.getElementById("ledger-stats");

    // 统计
    const total = allRecords.length;
    const thisMonth = today().slice(0, 7);
    const monthCount = allRecords.filter((r) => (r.date || "").startsWith(thisMonth)).length;
    statsEl.innerHTML = `共 <b>${total}</b> 条记录 · 本月 <b>${monthCount}</b> 条`;

    if (!list.length) {
      listEl.innerHTML = "";
      emptyEl.classList.remove("hidden");
      return;
    }
    emptyEl.classList.add("hidden");

    listEl.innerHTML = list
      .map((r) => {
        const tags = (r.tags || "")
          .split(/[,，]/)
          .map((t) => t.trim())
          .filter(Boolean)
          .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
          .join("");
        return `
        <div class="card record" data-id="${r.id}">
          <div class="record-head">
            <span class="record-title">${escapeHtml(r.title || "（无标题）")}</span>
            <span class="record-date">${escapeHtml(r.date || "")}</span>
          </div>
          <div class="record-content">${escapeHtml(r.content || "")}</div>
          ${tags ? `<div class="record-tags">${tags}</div>` : ""}
        </div>`;
      })
      .join("");

    // 点击记录编辑
    listEl.querySelectorAll(".record").forEach((el) => {
      el.addEventListener("click", () => openEdit(el.dataset.id));
    });
  }

  function openAdd() {
    editingId = null;
    document.getElementById("modal-title").textContent = "记一笔";
    document.getElementById("rec-date").value = today();
    document.getElementById("rec-title").value = "";
    document.getElementById("rec-content").value = "";
    document.getElementById("rec-tags").value = "";
    document.getElementById("btn-modal-delete").classList.add("hidden");
    showModal();
  }

  function openEdit(id) {
    const r = allRecords.find((x) => x.id === id);
    if (!r) return;
    editingId = id;
    document.getElementById("modal-title").textContent = "编辑记录";
    document.getElementById("rec-date").value = r.date || today();
    document.getElementById("rec-title").value = r.title || "";
    document.getElementById("rec-content").value = r.content || "";
    document.getElementById("rec-tags").value = r.tags || "";
    document.getElementById("btn-modal-delete").classList.remove("hidden");
    showModal();
  }

  async function saveRecord() {
    const date = document.getElementById("rec-date").value;
    const title = document.getElementById("rec-title").value.trim();
    const content = document.getElementById("rec-content").value.trim();
    const tags = document.getElementById("rec-tags").value.trim();

    if (!title && !content) {
      toast("请至少填写标题或内容");
      return;
    }

    const rec = { date, title, content, tags };
    if (editingId) rec.id = editingId;

    await AppDB.saveRecord(rec);
    hideModal();
    await loadRecords();
    toast(editingId ? "已更新" : "已保存");
  }

  async function deleteRecord() {
    if (!editingId) return;
    if (!confirm("确定删除这条记录吗？删除后无法恢复。")) return;
    await AppDB.deleteRecord(editingId);
    hideModal();
    await loadRecords();
    toast("已删除");
  }

  async function exportBackup() {
    if (!allRecords.length) {
      toast("还没有记录可导出");
      return;
    }
    const payload = {
      app: "dianli-assistant",
      exportedAt: new Date().toISOString(),
      count: allRecords.length,
      records: allRecords,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `电力台账备份_${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`已导出 ${allRecords.length} 条记录`);
  }

  function showModal() {
    document.getElementById("modal").classList.remove("hidden");
  }
  function hideModal() {
    document.getElementById("modal").classList.add("hidden");
  }

  /* ============ 备份恢复 ============ */

  // 触发选择备份文件
  function openRestore() {
    document.getElementById("restore-file").click();
  }

  // 恢复备份：读取导出的 JSON，合并写入台账
  async function handleRestoreFile(e) {
    const file = e.target.files[0];
    e.target.value = ""; // 允许重复选择同一文件
    if (!file) return;

    try {
      const text = await file.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        toast("这不是有效的备份文件（无法解析 JSON）");
        return;
      }

      // 兼容两种结构：{records:[...]} 或直接是数组
      const records = Array.isArray(data) ? data : data.records;
      if (!Array.isArray(records) || !records.length) {
        toast("备份文件里没有找到台账记录");
        return;
      }

      const mode = confirm(
        `备份里共 ${records.length} 条记录。\n\n点「确定」= 追加合并（保留现有记录）\n点「取消」= 覆盖（清空现有后恢复）`
      );

      if (mode) {
        // 追加合并
        for (const r of records) {
          await AppDB.saveRecord(r);
        }
        toast(`已追加导入 ${records.length} 条记录`);
      } else {
        // 覆盖：清空后恢复
        await AppDB.clearAll();
        for (const r of records) {
          await AppDB.saveRecord(r);
        }
        toast(`已恢复 ${records.length} 条记录（原数据已清空）`);
      }

      await loadRecords();
    } catch (err) {
      console.error("恢复备份失败:", err);
      toast("恢复失败：" + err.message);
    }
  }

  /* ============ 日报导入解析 ============ */

  // 识别一行是否是「日期行」，支持多种格式：
  // 2026-11-06 / 2026/11/6 / 2026年11月6日 / 11月6日 / 11.6 / 11-6
  function parseDateLine(line) {
    const t = line.trim();
    if (!t || t.length > 30) return null; // 太长不太可能是纯日期行

    // 完整日期
    let m = t.match(/^(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/);
    if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;

    // 只有月日（默认补当前年份）
    m = t.match(/^(\d{1,2})[-/.月](\d{1,2})日?$/);
    if (m) {
      const y = new Date().getFullYear();
      return `${y}-${pad(m[1])}-${pad(m[2])}`;
    }
    return null;
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  /**
   * 解析日报文本 -> 记录数组
   * 规则：
   *  - 遇到日期行，开启一条新记录
   *  - 日期行后的第一行非空文本作为「标题」
   *  - 其余文本累积为「内容」
   */
  function parseDailyReport(text) {
    const lines = String(text || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const records = [];
    let cur = null;

    for (const line of lines) {
      const date = parseDateLine(line);
      if (date) {
        // 新记录
        if (cur && (cur.title || cur.content)) records.push(cur);
        cur = { date, title: "", content: "" };
        continue;
      }
      if (!cur) {
        // 还没遇到日期就出现内容：作为一条无日期记录，日期用今天
        cur = { date: today(), title: "", content: "" };
      }
      if (!cur.title) {
        cur.title = line.slice(0, 40); // 第一行作为标题
        // 如果这一行较长，剩余部分归入内容
        if (line.length > 40) cur.content = line.slice(40);
      } else {
        cur.content = cur.content ? cur.content + "\n" + line : line;
      }
    }
    if (cur && (cur.title || cur.content)) records.push(cur);

    return records;
  }

  function openImport() {
    document.getElementById("import-modal").classList.remove("hidden");
    document.getElementById("import-text").value = "";
    document.getElementById("import-file").value = "";
    const pv = document.getElementById("import-preview");
    pv.style.display = "none";
    pv.textContent = "";
  }
  function closeImport() {
    document.getElementById("import-modal").classList.add("hidden");
  }

  function updateImportPreview() {
    const text = document.getElementById("import-text").value;
    const records = parseDailyReport(text);
    const pv = document.getElementById("import-preview");
    if (!records.length) {
      pv.style.display = "none";
      return;
    }
    pv.style.display = "block";
    pv.innerHTML = `解析出 <b>${records.length}</b> 条记录：` +
      records.map((r) => `<br>· ${r.date} ${r.title}`).join("");
  }

  async function confirmImport() {
    const text = document.getElementById("import-text").value.trim();
    if (!text) {
      toast("请先粘贴日报内容，或上传 .txt 文件");
      return;
    }
    const records = parseDailyReport(text);
    if (!records.length) {
      toast("没能识别出有效内容，请检查格式（建议每段以日期开头）");
      return;
    }
    let saved = 0;
    for (const r of records) {
      await AppDB.saveRecord({ ...r, tags: "" });
      saved++;
    }
    closeImport();
    await loadRecords();
    toast(`已导入 ${saved} 条记录到台账`);
  }

  // 解析 .docx：解压 zip，提取 word/document.xml 中的文字段落
  async function parseDocxText(arrayBuffer) {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docFile = zip.file("word/document.xml");
    if (!docFile) throw new Error("找不到 document.xml");
    const xml = await docFile.async("string");
    // 每个 <w:p> 是一个段落
    const paras = [];
    const pRe = /<w:p[ >][\s\S]*?<\/w:p>/g;
    let pm;
    while ((pm = pRe.exec(xml)) !== null) {
      const texts = [];
      const tRe = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
      let tm;
      while ((tm = tRe.exec(pm[0])) !== null) {
        texts.push(
          tm[1]
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
        );
      }
      if (texts.length) paras.push(texts.join(""));
    }
    return paras.join("\n");
  }

  // 解析 .xlsx：读取第一个 sheet，把每行单元格拼成文本
  async function parseXlsxText(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new Error("表格为空");
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    return rows
      .map((row) => row.map((c) => String(c)).join("\t"))
      .join("\n");
  }

  // 处理文件上传（.txt / .docx / .xlsx）
  async function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      let text = "";
      const name = (file.name || "").toLowerCase();
      if (name.endsWith(".txt")) {
        text = await file.text();
      } else if (name.endsWith(".docx")) {
        text = await parseDocxText(await file.arrayBuffer());
      } else if (name.endsWith(".xlsx")) {
        text = await parseXlsxText(await file.arrayBuffer());
      } else {
        toast("不支持的文件格式，请用 .txt / .docx / .xlsx");
        return;
      }
      if (!text.trim()) {
        toast("文件内容为空");
        return;
      }
      const ta = document.getElementById("import-text");
      ta.value = ta.value ? ta.value + "\n" + text : text;
      updateImportPreview();
      toast(`已读取「${file.name}」，点「解析并导入」入库`);
    } catch (err) {
      console.error("文件解析失败:", err);
      toast("文件解析失败：" + err.message);
    }
  }

  function initLedger() {
    document.getElementById("btn-add-record").addEventListener("click", openAdd);
    document.getElementById("btn-export").addEventListener("click", exportBackup);
    document.getElementById("btn-restore").addEventListener("click", openRestore);
    document.getElementById("restore-file").addEventListener("change", handleRestoreFile);
    document.getElementById("btn-modal-save").addEventListener("click", saveRecord);
    document.getElementById("btn-modal-cancel").addEventListener("click", hideModal);
    document.getElementById("btn-modal-delete").addEventListener("click", deleteRecord);
    document.getElementById("ledger-search").addEventListener("input", renderLedger);
    document.getElementById("ledger-month").addEventListener("change", renderLedger);

    // 导入日报
    document.getElementById("btn-import").addEventListener("click", openImport);
    document.getElementById("btn-import-cancel").addEventListener("click", closeImport);
    document.getElementById("btn-import-confirm").addEventListener("click", confirmImport);
    document.getElementById("import-file").addEventListener("change", handleImportFile);
    document.getElementById("import-text").addEventListener("input", updateImportPreview);

    loadRecords();
  }

  window.LedgerModule = { initLedger, loadRecords, openAdd };
})();
