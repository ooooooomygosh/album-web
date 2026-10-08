function cleanText(value, max = 900) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function sourceFromResult(result, index) {
  return {
    id: `S${index + 1}`,
    title: cleanText(result.title || result.url || `Source ${index + 1}`, 160),
    url: cleanText(result.url || '', 500),
    content: cleanText(result.content || result.raw_content || '', 850),
    score: Number(result.score || 0)
  };
}

export function researchQueryForItem(item = {}, intent = 'background') {
  const title = cleanText(item.title, 100);
  const artist = cleanText(item.artist, 100);
  const album = cleanText(item.albumTitle || item.title, 100);
  const year = cleanText(item.year, 20);
  const type = item.type === 'album' ? 'album' : 'song';
  const focus = intent === 'recommend'
    ? 'reviews similar music recommendation listening guide'
    : 'official album review production background release credits music review';
  return [artist, title, type, album !== title ? album : '', year, focus]
    .filter(Boolean)
    .join(' ');
}

export async function searchMusicResearch(item = {}, options = {}) {
  const key = process.env.TAVILY_API_KEY;
  const query = options.query || researchQueryForItem(item, options.intent);
  if (!key) return { enabled: false, query, sources: [], answer: '', error: 'TAVILY_API_KEY is not configured.' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 9000);
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        topic: 'general',
        search_depth: options.searchDepth || 'advanced',
        max_results: options.maxResults || 5,
        include_answer: true,
        include_raw_content: false,
        include_images: false
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || `Tavily failed: ${response.status}`);
    const sources = (data.results || [])
      .map(sourceFromResult)
      .filter((source) => source.url && source.content)
      .slice(0, options.maxResults || 5);
    return {
      enabled: true,
      query,
      answer: cleanText(data.answer || '', 900),
      sources
    };
  } catch (error) {
    return {
      enabled: true,
      query,
      sources: [],
      answer: '',
      error: error.name === 'AbortError' ? 'Tavily request timed out.' : error.message
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function formatResearchForPrompt(research = {}) {
  if (!research.enabled) return '联网检索：未配置。只能使用元数据和已保存评论，不得编造具体事实。';
  if (research.error || !research.sources?.length) {
    return `联网检索：已尝试 Tavily 搜索，但没有可用来源。查询：${research.query || ''}。错误：${research.error || 'no sources'}。不得编造具体事实。`;
  }

  const sourceLines = research.sources.map((source) => [
    `[${source.id}] ${source.title}`,
    `URL: ${source.url}`,
    `摘要: ${source.content}`
  ].join('\n'));

  return [
    `联网检索查询：${research.query}`,
    research.answer ? `Tavily 综合摘要：${research.answer}` : '',
    '可引用来源如下。只能把这些来源明确支持的信息写成事实；来源没有支持的信息必须写“待考证”或省略。',
    ...sourceLines
  ].filter(Boolean).join('\n\n');
}

export function publicResearchSources(research = {}, limit = 4) {
  return (research.sources || []).slice(0, limit).map((source) => ({
    title: source.title,
    url: source.url
  }));
}
