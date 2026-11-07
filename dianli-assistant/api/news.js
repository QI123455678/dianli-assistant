/**
 * 电力行业新闻简报 - 云端抓取函数
 * 部署到 Vercel 后，手机端调用 /api/news 获取每日电力新闻简报
 *
 * 数据源：国家能源局官网 (nea.gov.cn) 各栏目公开 JSON 数据接口
 *  1. 能源要闻   - 电力/能源行业综合要闻
 *  2. 政策通知   - 最新政策文件（电力相关）
 *  3. 局工作动态 - 国家能源局工作动态
 *  4. 派出机构动态 - 各地监管机构动态
 *
 * 说明：这些接口无跨域限制问题的处理放在云端完成，
 * 云端抓取后清洗、去重、过滤，返回结构化 JSON 供手机端 PWA 读取。
 */

const SOURCES = [
  {
    id: "能源要闻",
    pageUrl: "https://www.nea.gov.cn/xwzx/nyyw.htm",
    datasourceId: "8839d76f7cb542ca8cbaab7122cc9b83",
  },
  {
    id: "政策通知",
    pageUrl: "https://www.nea.gov.cn/policy/zxwj.htm",
    datasourceId: "40d365c13659452aa06cdb7268d6192e",
  },
  {
    id: "局工作动态",
    pageUrl: "https://www.nea.gov.cn/news/jwzdt.htm",
    datasourceId: "c9f95ed9895045b9804bbed332636104",
  },
  {
    id: "派出机构动态",
    pageUrl: "https://www.nea.gov.cn/news/pcjg.htm",
    datasourceId: "c3625c4be5ba469e91545a080b7e77b5",
  },
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// 从标题中剥离 HTML 标签
function cleanTitle(title) {
  return String(title || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// 将相对链接转为绝对链接
function toAbsolute(publishUrl, pageUrl) {
  if (!publishUrl) return "";
  if (/^https?:\/\//i.test(publishUrl)) return publishUrl;
  const base = new URL(pageUrl);
  if (publishUrl.startsWith("../")) {
    // 相对站点的上级目录
    return new URL(publishUrl.replace(/^\.\./, ""), base.origin + "/").href;
  }
  if (publishUrl.startsWith("/")) {
    return base.origin + publishUrl;
  }
  return new URL(publishUrl, pageUrl).href;
}

// 电力相关关键词过滤
const KEYWORDS = [
  "电力", "电网", "火电", "水电", "风电", "光伏", "核电", "储能",
  "新能源", "煤电", "输电", "配电", "发电", "电煤", "绿电", "绿证",
  "电力市场", "电价", "变电站", "能源", "氢能", "充电", "微电网",
  "迎峰度", "电力安全", "外送电", "装机", "风光", "可再生能源",
  "燃机", "燃气轮机", "新型储能", "电力现货", "售电", "负荷",
];

function isRelevant(title, summary) {
  const hay = `${title} ${summary || ""}`;
  return KEYWORDS.some((k) => hay.includes(k));
}

async function fetchSource(source) {
  try {
    const dir = source.pageUrl.substring(0, source.pageUrl.lastIndexOf("/") + 1);
    const jsonUrl = `${dir}ds_${source.datasourceId}.json`;

    const res = await fetch(jsonUrl, {
      headers: { "User-Agent": UA, Referer: source.pageUrl },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const list = data.datasource || [];

    return list.map((it) => ({
      title: cleanTitle(it.title || it.showTitle),
      url: toAbsolute(it.publishUrl, source.pageUrl),
      date: (it.publishTime || "").slice(0, 10),
      summary: cleanTitle(it.summary || ""),
      sourceName: source.id,
      sourceText: cleanTitle(it.sourceText || ""),
    }));
  } catch (err) {
    console.error(`抓取「${source.id}」失败:`, err.message);
    return [];
  }
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.statusCode = 200;
    res.end();
    return;
  }

  try {
    const results = await Promise.all(SOURCES.map(fetchSource));

    // 合并去重
    const seen = new Set();
    const all = [];
    for (const items of results) {
      for (const item of items) {
        if (!item.title || item.title.length < 4) continue;
        if (seen.has(item.url)) continue;
        if (!isRelevant(item.title, item.summary)) continue;
        seen.add(item.url);
        all.push(item);
      }
    }

    // 按日期倒序
    all.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    // 只取最近 60 条（大约覆盖近期新闻）
    const brief = all.slice(0, 60);

    sendJson(res, 200, {
      ok: true,
      generatedAt: new Date().toISOString(),
      count: brief.length,
      items: brief,
    });
  } catch (err) {
    console.error("新闻抓取异常:", err);
    sendJson(res, 500, { ok: false, error: err.message, items: [] });
  }
};
