import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { generateWithDeepSeek, fixWithDeepSeek, imageToCodeWithDeepSeek } from '../services/ai/deepseek';
import { generateWithAiyiwei, fixWithAiyiwei, imageToCodeWithAiyiwei } from '../services/ai/aiyiwei';

const MODEL_OPTIONS = ['deepseekv4', 'chatgpt5.5', 'gemini3.5', 'mimo-v2.5-pro'] as const;
type ModelOption = typeof MODEL_OPTIONS[number];

const textGenerateSchema = z.object({
  prompt: z.string().min(1).max(50000),
  model: z.enum(MODEL_OPTIONS).default('deepseekv4'),
  language: z.enum(['auto', 'threejs']).default('auto'),
  stream: z.boolean().optional().default(false),
});

const fixCodeSchema = z.object({
  code: z.string().min(1).max(50000),
  error: z.string().min(1).max(10000),
  language: z.enum(['threejs']),
  model: z.enum(MODEL_OPTIONS).default('deepseekv4'),
  stream: z.boolean().optional().default(false),
});

const imageToCodeSchema = z.object({
  image: z.string().min(1).max(50000000),
  instruction: z.string().min(1).max(2000),
  model: z.enum(MODEL_OPTIONS).default('deepseekv4'),
  stream: z.boolean().optional().default(false),
});

function isAiyiweiModel(model: ModelOption): model is 'chatgpt5.5' | 'gemini3.5' | 'mimo-v2.5-pro' {
  return model === 'chatgpt5.5' || model === 'gemini3.5' || model === 'mimo-v2.5-pro';
}

function setupEventStream(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  return (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
}

export async function generateTextController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = textGenerateSchema.parse(req.body);

    if (body.stream) {
      const send = setupEventStream(res);
      send('progress', { message: '收到生成请求，正在准备提示词' });
      try {
        const result = isAiyiweiModel(body.model)
          ? await generateWithAiyiwei({
            prompt: body.prompt,
            language: body.language,
            model: body.model,
            onProgress: (message) => send('progress', { message }),
            onDelta: (text) => send('delta', { text }),
          })
          : await generateWithDeepSeek({
            prompt: body.prompt,
            language: body.language,
            onProgress: (message) => send('progress', { message }),
            onDelta: (text) => send('delta', { text }),
          });
        send('done', { code: result.code, language: result.language, nodes: result.nodes, edges: result.edges });
      } catch (err) {
        send('error', { message: err instanceof Error ? err.message : '生成失败' });
      } finally {
        res.end();
      }
      return;
    }

    let result;
    if (isAiyiweiModel(body.model)) {
      result = await generateWithAiyiwei({ prompt: body.prompt, language: body.language, model: body.model });
    } else {
      result = await generateWithDeepSeek({ prompt: body.prompt, language: body.language });
    }

    res.json({
      success: true,
      data: {
        code: result.code,
        language: result.language,
        nodes: result.nodes,
        edges: result.edges,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function fixCodeController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = fixCodeSchema.parse(req.body);

    if (body.stream) {
      const send = setupEventStream(res);
      send('progress', { message: '收到修改请求，正在准备上下文' });
      try {
        const result = isAiyiweiModel(body.model)
          ? await fixWithAiyiwei({
            code: body.code,
            error: body.error,
            language: body.language,
            model: body.model,
            onProgress: (message) => send('progress', { message }),
            onDelta: (text) => send('delta', { text }),
          })
          : await fixWithDeepSeek({
            code: body.code,
            error: body.error,
            language: body.language,
            onProgress: (message) => send('progress', { message }),
            onDelta: (text) => send('delta', { text }),
          });
        send('done', { code: result.code, nodes: result.nodes, edges: result.edges });
      } catch (err) {
        send('error', { message: err instanceof Error ? err.message : '修改失败' });
      } finally {
        res.end();
      }
      return;
    }

    let result;
    if (isAiyiweiModel(body.model)) {
      result = await fixWithAiyiwei({ code: body.code, error: body.error, language: body.language, model: body.model });
    } else {
      result = await fixWithDeepSeek({ code: body.code, error: body.error, language: body.language });
    }

    res.json({
      success: true,
      data: {
        code: result.code,
        nodes: result.nodes,
        edges: result.edges,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function imageToCodeController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = imageToCodeSchema.parse(req.body);

    if (body.stream) {
      const send = setupEventStream(res);
      send('progress', { message: '收到图生代码请求，正在读取图片' });
      try {
        const result = isAiyiweiModel(body.model)
          ? await imageToCodeWithAiyiwei({
            imageDataUrl: body.image,
            instruction: body.instruction,
            model: body.model,
            onProgress: (message) => send('progress', { message }),
            onDelta: (text) => send('delta', { text }),
          })
          : await imageToCodeWithDeepSeek({
            imageDataUrl: body.image,
            instruction: body.instruction,
            onProgress: (message) => send('progress', { message }),
            onDelta: (text) => send('delta', { text }),
          });
        send('done', { code: result.code, language: result.language, nodes: result.nodes, edges: result.edges });
      } catch (err) {
        send('error', { message: err instanceof Error ? err.message : '图生代码失败' });
      } finally {
        res.end();
      }
      return;
    }

    let result;
    if (isAiyiweiModel(body.model)) {
      result = await imageToCodeWithAiyiwei({ imageDataUrl: body.image, instruction: body.instruction, model: body.model });
    } else {
      result = await imageToCodeWithDeepSeek({ imageDataUrl: body.image, instruction: body.instruction });
    }

    res.json({
      success: true,
      data: {
        code: result.code,
        language: result.language,
        nodes: result.nodes,
        edges: result.edges,
      },
    });
  } catch (err) {
    next(err);
  }
}
