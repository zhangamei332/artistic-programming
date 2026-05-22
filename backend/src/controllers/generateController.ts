import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { generateWithDeepSeek, fixWithDeepSeek } from '../services/ai/deepseek';

const textGenerateSchema = z.object({
  prompt: z.string().min(1).max(2000),
  model: z.enum(['deepseek', 'gemini', 'gpt']).default('deepseek'),
  language: z.enum(['auto', 'threejs', 'p5js']).default('auto'),
});

const fixCodeSchema = z.object({
  code: z.string().min(1).max(50000),
  error: z.string().min(1).max(10000),
  language: z.enum(['threejs', 'p5js']),
});

export async function generateTextController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = textGenerateSchema.parse(req.body);

    // 仅实现 DeepSeek，其他模型后续添加
    const result = await generateWithDeepSeek({
      prompt: body.prompt,
      language: body.language,
    });

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

    const result = await fixWithDeepSeek({
      code: body.code,
      error: body.error,
      language: body.language,
    });

    res.json({
      success: true,
      data: { code: result.code },
    });
  } catch (err) {
    next(err);
  }
}
