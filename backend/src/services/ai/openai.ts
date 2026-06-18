import OpenAI from 'openai';
import { config } from '../../config';
import { parseAnnotations } from './deepseek';
import { SYSTEM_PROMPT, FIX_SYSTEM_PROMPT } from './prompts';

interface GenerateParams {
  prompt: string;
  language: string;
}

interface FixParams {
  code: string;
  error: string;
  language: 'threejs';
}

interface ImageToCodeParams {
  imageDataUrl: string;
  instruction: string;
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

function getOpenAIClient(): OpenAI {
  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY is not configured. Set it in backend/.env to use chatgpt5.5.');
  }
  return new OpenAI({ apiKey: config.openai.apiKey });
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

export async function generateWithOpenAI(params: GenerateParams): Promise<GenerateResult> {
  const client = getOpenAIClient();
  const langHint = params.language === 'auto' ? '' : `请使用 ${params.language} 生成代码。`;
  const response = await client.chat.completions.create({
    model: config.openai.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `${params.prompt}\n${langHint}` },
    ],
    temperature: 0.7,
    max_tokens: 4096,
  });
  return toGenerateResult(response.choices[0]?.message?.content || '');
}

export async function fixWithOpenAI(params: FixParams): Promise<GenerateResult> {
  const client = getOpenAIClient();
  const isAdjust = /调整|修改|改成|变成|换成|替换|添加|增加|删除|去掉|移除/.test(params.error);
  const task = isAdjust
    ? `任务：用户要求调整: ${params.error}\n\n原代码：\n${params.code}`
    : `错误信息：${params.error}\n\n原代码：\n${params.code}`;
  const response = await client.chat.completions.create({
    model: config.openai.model,
    messages: [
      { role: 'system', content: FIX_SYSTEM_PROMPT },
      { role: 'user', content: task },
    ],
    temperature: 0.5,
    max_tokens: 4096,
  });
  return toGenerateResult(response.choices[0]?.message?.content || '');
}

export async function imageToCodeWithOpenAI(params: ImageToCodeParams): Promise<GenerateResult> {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: config.openai.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: `请根据参考图片生成 Three.js 艺术编程代码；p5.js 只能作为可选动态纹理，禁止使用 GSAP。请严格包含完整 @node/@param/@connect 注释。\n${params.instruction}` },
          { type: 'image_url', image_url: { url: params.imageDataUrl } },
        ],
      },
    ],
    temperature: 0.7,
    max_tokens: 4096,
  });
  return toGenerateResult(response.choices[0]?.message?.content || '');
}
