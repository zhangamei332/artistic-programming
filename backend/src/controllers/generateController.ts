import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { generateWithDeepSeek, fixWithDeepSeek, imageToCodeWithDeepSeek } from '../services/ai/deepseek';
import { generateWithGemini, fixWithGemini } from '../services/ai/gemini';

const textGenerateSchema = z.object({
  prompt: z.string().min(1).max(2000),
  model: z.enum(['deepseek', 'gemini', 'gpt']).default('deepseek'),
  language: z.enum(['auto', 'threejs']).default('auto'),
});

const fixCodeSchema = z.object({
  code: z.string().min(1).max(50000),
  error: z.string().min(1).max(10000),
  language: z.enum(['threejs']),
  model: z.enum(['deepseek', 'gemini', 'gpt']).default('deepseek'),
});

const imageToCodeSchema = z.object({
  image: z.string().min(1).max(10000000),
  instruction: z.string().min(1).max(2000),
  model: z.enum(['deepseek', 'gemini', 'gpt']).default('deepseek'),
});

export async function generateTextController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = textGenerateSchema.parse(req.body);

    const result = body.model === 'gemini'
      ? await generateWithGemini({ prompt: body.prompt, language: body.language })
      : await generateWithDeepSeek({ prompt: body.prompt, language: body.language });

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

    const result = body.model === 'gemini'
      ? await fixWithGemini({ code: body.code, error: body.error, language: body.language })
      : await fixWithDeepSeek({ code: body.code, error: body.error, language: body.language });

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

    // 图生代码暂用 DeepSeek（Gemini 图生代码需额外适配）
    const result = body.model === 'gemini'
      ? await generateWithGemini({ prompt: `根据图片描述生成代码：${body.instruction}`, language: 'threejs' })
      : await imageToCodeWithDeepSeek({ imageDataUrl: body.image, instruction: body.instruction });

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
