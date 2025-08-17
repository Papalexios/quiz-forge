import { Step, AiProvider } from './types';

export const STEP_DESCRIPTIONS: Record<Step, { title: string; description: string }> = {
  [Step.Configure]: {
    title: 'Configure Connection',
    description: 'Connect to your WordPress site.',
  },
  [Step.Analyze]: {
    title: 'Analyze & Select',
    description: 'Choose a post and an enhancement idea.',
  },
  [Step.Generate]: {
    title: 'Generate & Insert',
    description: 'Generate HTML and update your post.',
  },
};

export const AI_PROVIDERS: Record<AiProvider, { name: string, defaultModel: string, requiresModelField?: boolean }> = {
  [AiProvider.Gemini]: {
    name: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
  },
  [AiProvider.OpenAI]: {
    name: 'OpenAI',
    defaultModel: 'gpt-4o',
  },
  [AiProvider.Anthropic]: {
    name: 'Anthropic (Claude)',
    defaultModel: 'claude-3-haiku-20240307',
  },
  [AiProvider.OpenRouter]: {
    name: 'OpenRouter',
    defaultModel: 'mistralai/mistral-7b-instruct',
    requiresModelField: true,
  }
};