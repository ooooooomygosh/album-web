// 全站唯一的 DeepSeek 模型来源。
// 任何新增的 AI 调用点都必须从这里取模型名，禁止再写死字符串。
//
// deepseek-v4-flash：thinking high，上下文 1M，最大输出 384K。
// 输出上限只是"天花板"，各调用点仍按自身场景设置合理的 max_tokens，
// 避免一次请求把整段 384K 额度打满导致延迟不可控。

export const MODEL = 'deepseek-v4-flash';

// 模型侧的硬上限（token）。用于给各处的 clamp 提供统一天花板。
export const MODEL_MAX_OUTPUT_TOKENS = 384000;

// 默认 thinking 档位。DeepSeek V4 支持 'high' | 'medium' | 'low'。
export const DEFAULT_THINKING = 'high';

export const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';

/**
 * 读取模型名。允许通过环境变量覆盖（灰度/回滚用），但默认永远是 MODEL。
 * @param {string} [envKey] 可选的环境变量名，例如 'DEEPSEEK_PERSONA_MODEL'
 */
export function resolveModel(envKey) {
  if (envKey && process.env[envKey]) return String(process.env[envKey]);
  if (process.env.DEEPSEEK_MODEL) return String(process.env.DEEPSEEK_MODEL);
  return MODEL;
}

/**
 * 把 max_tokens 夹到 [min, max] 且不超过模型硬上限。
 */
export function clampTokens(value, fallback, min, max) {
  const upper = Math.min(max, MODEL_MAX_OUTPUT_TOKENS);
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return Math.max(min, Math.min(upper, fallback));
  return Math.max(min, Math.min(upper, Math.round(n)));
}

/**
 * 统一的 DeepSeek chat completions 调用。
 * 返回原始 Response，由调用方决定如何解析/重试。
 */
export function deepseekChat({
  key,
  model = MODEL,
  messages,
  temperature = 0.8,
  maxTokens = 16000,
  thinking = DEFAULT_THINKING,
  reasoningEffort,
  responseFormat,
  signal
}) {
  return fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: Math.min(maxTokens, MODEL_MAX_OUTPUT_TOKENS),
      ...(thinking ? { thinking } : {}),
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
      ...(responseFormat ? { response_format: responseFormat } : {})
    })
  });
}
