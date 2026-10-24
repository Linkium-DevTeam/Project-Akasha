import { Hono } from 'hono';

export const aiRoutes = new Hono<{ Bindings: Env }>();

const TEXT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8';
const VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

/** 从模型输出中提取 JSON 对象（容忍 ```json 围栏与前后闲话） */
function extractJson(text: string): any | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

const SYSTEM = `你是二次元实体收藏（谷子）管理助手。根据用户提供的信息，输出严格的 JSON 对象，字段：
{"name":"藏品名","series":"系列/作品中文名","character":"角色名","type":"badge|standee|acrylic|plush|card|other 之一","tags":["标签"],"notes":"一句话补充"}
只输出 JSON，不要输出其他内容。不确定的字段用空字符串，tags 可以为空数组。`;

interface IdentifBody { image?: string }

/** AI 图片识别：从谷子照片猜名称 / 系列 / 角色（建议性质，需用户审核） */
aiRoutes.post('/identify', async (c) => {
  const body = await c.req.json<IdentifBody>().catch(() => ({} as IdentifBody));
  const dataUrl = body.image ?? '';
  if (!/^data:image\/(webp|png|jpeg);base64,/.test(dataUrl)) {
    return c.json({ error: '缺少图片或格式不支持' }, 400);
  }
  if (dataUrl.length > 5 * 1024 * 1024) {
    return c.json({ error: '图片太大，请用较小的图' }, 400);
  }
  const result = await c.env.AI.run(VISION_MODEL, {
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: dataUrl } },
        { type: 'text', text: '识别这张二次元周边照片。' + SYSTEM },
      ],
    }],
    max_tokens: 400,
  } as any);
  const text = (result as any)?.response ?? '';
  const parsed = extractJson(String(text));
  if (!parsed) return c.json({ error: '识别失败，换个角度的图试试', raw: String(text).slice(0, 200) }, 502);
  return c.json({ suggestion: parsed });
});

interface EnrichBody { name?: string; series?: string; character?: string; barcode?: string }

/** Bangumi 公开搜索（无凭据），仅取条目名 / 中文名 / 日期 / 简介 */
async function bangumiSearch(keyword: string) {
  const res = await fetch('https://api.bgm.tv/v0/search/subjects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'ProjectAkasha/0.3 (personal collection manager)',
    },
    body: JSON.stringify({ keyword, filter: { type: [1, 2, 4] } }),
  });
  if (!res.ok) return [];
  const data = await res.json<any>();
  return (data?.data ?? []).slice(0, 5).map((s: any) => ({
    name: String(s.name ?? ''),
    nameCn: String(s.name_cn ?? ''),
    date: String(s.date ?? ''),
    summary: String(s.summary ?? '').slice(0, 160),
  }));
}

/** 联网补全：Bangumi 搜索 + LLM 整合，产出待审核建议（不直接落库） */
aiRoutes.post('/enrich', async (c) => {
  const body = await c.req.json<EnrichBody>().catch(() => ({} as EnrichBody));
  const name = String(body.name ?? '').trim();
  const series = String(body.series ?? '').trim();
  if (!name && !series) return c.json({ error: '至少填写名称或系列再补全' }, 400);

  const keyword = series || name;
  let sources: Array<{ name: string; nameCn: string; date: string; summary: string }> = [];
  try {
    sources = await bangumiSearch(keyword);
  } catch {
    sources = []; // 网络失败不阻塞，退化为纯 AI 建议
  }

  const prompt = `当前藏品信息：名称「${name}」系列「${series}」角色「${String(body.character ?? '')}」条码「${String(body.barcode ?? '')}」。
Bangumi 搜索结果（可能为空）：${JSON.stringify(sources)}。
请结合常识与搜索结果补全这条谷子记录。` + SYSTEM;

  const result = await c.env.AI.run(TEXT_MODEL, {
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 400,
  } as any);
  const text = (result as any)?.response ?? '';
  const parsed = extractJson(String(text));
  if (!parsed) return c.json({ error: '补全失败，稍后再试' }, 502);
  return c.json({ suggestion: parsed, sources });
});
