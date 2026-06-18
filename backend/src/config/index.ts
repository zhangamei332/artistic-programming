import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o',
  },
  aiyiwei: {
    gpt: {
      apiKey: process.env.AIYIWEI_API_KEY || '',
      baseUrl: process.env.AIYIWEI_BASE_URL || 'https://aiyiwei.vip/v1',
      model: process.env.AIYIWEI_GPT_MODEL || 'gpt-5.5',
    },
    gemini: {
      apiKey: process.env.SHIYUNAPI_API_KEY || '',
      baseUrl: process.env.SHIYUNAPI_BASE_URL || 'https://shiyunapi.com/v1',
      model: process.env.SHIYUNAPI_GEMINI_MODEL || 'gemini-3.5-flash',
    },
    mimo: {
      apiKey: process.env.MIMO_API_KEY || '',
      baseUrl: process.env.MIMO_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/v1',
      model: process.env.MIMO_MODEL || 'mimo-v2.5-pro',
    },
  },
};
