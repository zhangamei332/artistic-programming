import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config';
import { parseAnnotations } from './deepseek';
import { SYSTEM_PROMPT, FIX_SYSTEM_PROMPT } from './prompts';

type ProviderModel = 'chatgpt5.5' | 'gemini3.5' | 'mimo-v2.5-pro';

interface GenerateParams {
  prompt: string;
  language: string;
  model: ProviderModel;
  onProgress?: (message: string) => void;
  onDelta?: (text: string) => void;
}

interface FixParams {
  code: string;
  error: string;
  language: 'threejs';
  model: ProviderModel;
  onProgress?: (message: string) => void;
  onDelta?: (text: string) => void;
}

interface ImageToCodeParams {
  imageDataUrl: string;
  instruction: string;
  model: ProviderModel;
  onProgress?: (message: string) => void;
  onDelta?: (text: string) => void;
}

interface NodeData {
  id: string;
  type: string;
  label: string;
  params: Record<string, unknown>;
  position: { x: number; y: number };
}

interface EdgeData {
  id: string;
  source: string;
  target: string;
}

interface GenerateResult {
  code: string;
  language: 'threejs';
  nodes: NodeData[];
  edges: EdgeData[];
}

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

/** Resolve frontend model ID to provider config */
function resolveProvider(frontendModel: ProviderModel): {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: 'openai' | 'anthropic';
} {
  if (frontendModel === 'chatgpt5.5') {
    const cfg = config.aiyiwei.gpt;
    if (!cfg.apiKey) throw new Error('AIYIWEI_API_KEY is not configured');
    return { apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, model: cfg.model, provider: 'openai' };
  }
  if (frontendModel === 'mimo-v2.5-pro') {
    const cfg = config.aiyiwei.mimo;
    if (!cfg.apiKey) throw new Error('MIMO_API_KEY is not configured');
    return { apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, model: cfg.model, provider: 'anthropic' };
  }
  // gemini3.5 → shiyunapi.com (OpenAI-compatible)
  const cfg = config.aiyiwei.gemini;
  if (!cfg.apiKey) throw new Error('SHIYUNAPI_API_KEY is not configured');
  return { apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, model: cfg.model, provider: 'openai' };
}

function stripMarkdownCodeBlock(text: string): string {
  const match = text.match(/```[\w#]*\s*\n?([\s\S]*?)\n?```/);
  return match ? match[1].trim() : text.trim();
}

function toGenerateResult(raw: string): GenerateResult {
  const code = stripMarkdownCodeBlock(raw);
  const { nodes, edges } = parseAnnotations(code);
  return { code, language: 'threejs', nodes, edges };
}

// ---- OpenAI 完成（chatgpt5.5 / gemini3.5） ----

async function completeChatOpenAI(
  client: OpenAI,
  modelName: string,
  messages: ChatMessage[],
  temperature: number,
  onProgress?: (message: string) => void,
  onDelta?: (text: string) => void,
): Promise<string> {
  onProgress?.('正在连接 API');
  const createPlainCompletion = async () => {
    const response = await client.chat.completions.create({
      model: modelName,
      messages,
      temperature,
      max_tokens: 4096,
    });
    const raw = response.choices[0]?.message?.content || '';
    if (raw) onDelta?.(raw);
    return raw;
  };

  if (!onDelta) {
    const raw = await createPlainCompletion();
    onProgress?.('代码接收完成');
    return raw;
  }

  try {
    const stream = await client.chat.completions.create({
      model: modelName,
      messages,
      temperature,
      max_tokens: 4096,
      stream: true,
    });

    onProgress?.('API 已响应，正在接收代码');
    let raw = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (!delta) continue;
      raw += delta;
      onDelta?.(delta);
    }
    onProgress?.('代码接收完成');
    return raw;
  } catch {
    onProgress?.('流式响应不可用，改用普通响应');
    const raw = await createPlainCompletion();
    onProgress?.('代码接收完成');
    return raw;
  }
}

// ---- Anthropic 完成（mimo-v2.5-pro） ----

async function completeChatAnthropic(
  client: Anthropic,
  modelName: string,
  systemPrompt: string,
  userMessage: string,
  temperature: number,
  onProgress?: (message: string) => void,
  onDelta?: (text: string) => void,
): Promise<string> {
  onProgress?.('正在连接 MIMO API');

  if (!onDelta) {
    onProgress?.('MIMO API 已响应，正在接收代码');
    const response = await client.messages.create({
      model: modelName,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      temperature,
    });
    const raw = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('');
    onProgress?.('代码接收完成');
    return raw;
  }

  onProgress?.('MIMO API 已响应，正在接收代码');
  const stream = await client.messages.create({
    model: modelName,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    temperature,
    stream: true,
  });

  let raw = '';
  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      'delta' in event &&
      event.delta &&
      typeof event.delta === 'object' &&
      'text' in event.delta &&
      typeof (event.delta as Anthropic.TextDelta).text === 'string'
    ) {
      const text = (event.delta as Anthropic.TextDelta).text;
      raw += text;
      onDelta?.(text);
    }
  }
  onProgress?.('代码接收完成');
  return raw;
}

// ---- 统一完成入口 ----

async function completeChat(
  frontendModel: ProviderModel,
  systemPrompt: string,
  userMessage: string,
  temperature: number,
  onProgress?: (message: string) => void,
  onDelta?: (text: string) => void,
): Promise<string> {
  const providerInfo = resolveProvider(frontendModel);

  if (providerInfo.provider === 'anthropic') {
    const client = new Anthropic({
      apiKey: providerInfo.apiKey,
      baseURL: providerInfo.baseUrl,
    });
    return completeChatAnthropic(
      client,
      providerInfo.model,
      systemPrompt,
      userMessage,
      temperature,
      onProgress,
      onDelta,
    );
  }

  // OpenAI-compatible providers
  const client = new OpenAI({
    apiKey: providerInfo.apiKey,
    baseURL: providerInfo.baseUrl,
  });
  return completeChatOpenAI(
    client,
    providerInfo.model,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature,
    onProgress,
    onDelta,
  );
}

export async function generateWithAiyiwei(params: GenerateParams): Promise<GenerateResult> {
  const langHint = params.language === 'auto' ? '' : `请使用 ${params.language} 生成代码。`;
  const userMessage = `${params.prompt}\n${langHint}`;

  const raw = await completeChat(
    params.model,
    SYSTEM_PROMPT,
    userMessage,
    0.7,
    params.onProgress,
    params.onDelta,
  );

  return toGenerateResult(raw);
}

export async function fixWithAiyiwei(params: FixParams): Promise<GenerateResult> {
  const isAdjust = /调整|修改|改成|变成|换成|替换|添加|增加|删除|去掉|移除/.test(params.error);
  const userMessage = isAdjust
    ? `任务：用户要求调整: ${params.error}\n\n原代码：\n${params.code}`
    : `错误信息：${params.error}\n\n原代码：\n${params.code}`;

  const raw = await completeChat(
    params.model,
    FIX_SYSTEM_PROMPT,
    userMessage,
    0.5,
    params.onProgress,
    params.onDelta,
  );

  return toGenerateResult(raw);
}

export async function imageToCodeWithAiyiwei(params: ImageToCodeParams): Promise<GenerateResult> {
  // 图生代码仅支持 OpenAI-compatible 模型（chatgpt5.5 / gemini3.5），MIMO 当前不支持图片
  const providerInfo = resolveProvider(params.model);
  if (providerInfo.provider === 'anthropic') {
    throw new Error('mimo-v2.5-pro 不支持图生代码，请使用 chatgpt5.5 或 gemini3.5');
  }

  const client = new OpenAI({
    apiKey: providerInfo.apiKey,
    baseURL: providerInfo.baseUrl,
  });

  const raw = await completeChatOpenAI(
    client,
    providerInfo.model,
    [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `请根据参考图片生成 Three.js 艺术编程代码。\n${params.instruction}`,
          },
          { type: 'image_url', image_url: { url: params.imageDataUrl } },
        ],
      },
    ],
    0.7,
    params.onProgress,
    params.onDelta,
  );

  return toGenerateResult(raw);
}
