export enum Step {
  Configure = 1,
  Analyze = 2,
  Generate = 3,
}

export type Status = 'idle' | 'loading' | 'error' | 'success';

export enum AiProvider {
  Gemini = 'gemini',
  OpenAI = 'openai',
  Anthropic = 'anthropic',
  OpenRouter = 'openrouter',
}

export type ApiValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid';

export interface ApiKeys {
  [AiProvider.Gemini]: string;
  [AiProvider.OpenAI]: string;
  [AiProvider.Anthropic]: string;
  [AiProvider.OpenRouter]: string;
}

export interface ApiValidationStatuses {
  [AiProvider.Gemini]: ApiValidationStatus;
  [AiProvider.OpenAI]: ApiValidationStatus;
  [AiProvider.Anthropic]: ApiValidationStatus;
  [AiProvider.OpenRouter]: ApiValidationStatus;
}


export interface WordPressConfig {
  url: string;
  username: string;
  appPassword: string;
}

export interface WordPressPost {
  id: number;
  title: {
    rendered: string;
  };
  content: {
    rendered: string;
  };
  link: string;
  featuredImageUrl: string | null;
  hasOptimizerSnippet: boolean;
}

export interface ToolIdea {
  title: string;
  description: string;
  icon: string; // e.g., "calculator", "chart", "list"
}

export type Theme = 'light' | 'dark';

export interface AppState {
  currentStep: Step;
  status: Status; // For general app status like fetching posts/generating snippets
  error: string | null;
  deletingPostId: number | null;
  theme: Theme;
  
  // AI Provider State
  apiKeys: ApiKeys;
  apiValidationStatuses: ApiValidationStatuses;
  selectedProvider: AiProvider;
  openRouterModel: string;

  // WordPress State
  wpConfig: WordPressConfig | null;
  posts: WordPressPost[];
  filteredPosts: WordPressPost[];
  postSearchQuery: string;
  selectedPost: WordPressPost | null;

  // Generation State
  toolIdeas: ToolIdea[];
  selectedIdea: ToolIdea | null;
  generatedSnippet: string;
  themeColor: string;
}