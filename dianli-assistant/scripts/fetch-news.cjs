/**
 * 新闻抓取脚本 - 供 GitHub Actions 定时运行
 * 抓取国家能源局各栏目，输出静态 news.json
 * 用法: node scripts/fetch-news.cjs
 */
const fs = require("fs");
const path = require("path");

const SOURCES = [
  { id: "能源要闻", pageUrl: "https://www.nea.gov.cn/xwzx/nyyw.htm", datasourceId: "8839d76f7cb542ca8cbaab7122cc9b83" },
  { id: "政策通知", pageUrl: "https://www.nea.gov.cn/policy/zxwj.htm", datasourceId: "40d365c13659452aa06cdb7268d6192e" },
  { id: "局工作动态", pageUrl: "https://www.nea.gov.cn/news/jwzdt.htm", datasourceId: "c9f95ed9895045b9804bbed332636104" },
  { id: "派出机构动态", pageUrl: "https://www.nea.gov.cn/news/pcjg.htm", datasourceId: "c3625c4be5ba469e91545a080b7e77b5" },
];

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36";
const KEYWORDS = ["电力","电网","火电","水电","风电","光伏","核电","储能","新能源","煤电","输电","配电","发电","电煤","绿电","绿证","电力市场","电价","变电站","能源","氢能","充电","微电网","迎峰度","电力安全","外送电","装机","风光","可再生能源","燃机","燃气轮机","新型储能","电力现货","售电","负荷"];

function cleanTitle(t){return String(t||"").replace(/<[^>]+>/g,"").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g," ").trim();}
function toAbsolute(u,p){if(!u)return"";if(/^https?:\/\//i.test(u))return u;const b=new URL(p);if(u.startsWith("../"))return new URL(u.replace(/^\.\./,""),b.origin+"/").href;if(u.startsWith("/"))return b.origin+u;return new URL(u,p).href;}
function isRelevant(t,s){const h=`${t} ${s||""}`;return KEYWORDS.some(k=>h.includes(k));}

async function fetchSource(s){
  const dir=s.pageUrl.substring(0,s.pageUrl.lastIndexOf("/")+1);
  const jsonUrl=`${dir}ds_${s.datasourceId}.json`;
  const res=await fetch(jsonUrl,{headers:{"User-Agent":UA,Referer:s.pageUrl},signal:AbortSignal.timeout(10000)});
  if(!res.ok)throw new Error(`HTTP ${res.status}`);
  const data=await res.json();
  return (data.datasource||[]).map(it=>({
    title:cleanTitle(it.title||it.showTitle),
    url:toAbsolute(it.publishUrl,s.pageUrl),
    date:(it.publishTime||"").slice(0,10),
    summary:cleanTitle(it.summary||""),
    sourceName:s.id,
    sourceText:cleanTitle(it.sourceText||""),
  }));
}

async function main(){
  const results = await Promise.all(SOURCES.map(async s => {
    try { return await fetchSource(s); }
    catch(e){ console.error(`抓取 ${s.id} 失败:`, e.message); return []; }
  }));

  const seen=new Set(); const all=[];
  for(const items of results) for(const it of items){
    if(!it.title||it.title.length<4)continue;
    if(seen.has(it.url))continue;
    if(!isRelevant(it.title,it.summary))continue;
    seen.add(it.url); all.push(it);
  }
  all.sort((a,b)=>(b.date||"").localeCompare(a.date||""));

  // 只保留最近 100 条
  const brief = all.slice(0, 100);
  const payload = {
    ok: true,
    generatedAt: new Date().toISOString(),
    count: brief.length,
    items: brief,
  };

  const outPath = path.join(__dirname, "..", "news.json");
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`已生成 news.json，共 ${payload.count} 条新闻 -> ${outPath}`);
}

main().catch(e => { console.error("失败:", e.message); process.exit(1); });
