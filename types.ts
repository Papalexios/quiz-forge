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
  toolId?: number; // The ID of the cf_tool custom post
}

// Replaced ToolIdea with a comprehensive QuizData structure
export interface KnowledgeCheckQuestion {
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface PersonalityOption {
  text: string;
  pointsFor: string; // Corresponds to an Outcome id
}

export interface PersonalityQuestion {
  questionText: string;
  options: PersonalityOption[];
}

export interface PersonalityOutcome {
  id: string;
  title: string;
  description: string;
}

export interface QuizResultTier {
    scoreThreshold: number; // e.g., 0, 3, 5
    title: string;
    feedback: string;
}

export type QuizData = {
  quizTitle: string;
  quizType: 'knowledge-check' | 'personality';
  questions: (KnowledgeCheckQuestion | PersonalityQuestion)[];
  // One of the following will be present based on quizType
  results?: QuizResultTier[];
  outcomes?: PersonalityOutcome[];
};


export type Theme = 'light' | 'dark';

export type QuizDifficulty = 'Easy' | 'Challenging';

export interface AppState {
  currentStep: Step;
  status: Status; // For general app status like fetching posts/generating snippets
  insertingStatus: Status; // Separate status for the insertion process
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
  setupRequired: boolean; // Flag to indicate if the PHP snippet setup is needed

  // Generation State
  quizData: QuizData | null;
  editableQuizTitle: string;
  regenerationFeedback: string;
  themeColor: string;
  quizDifficulty: QuizDifficulty;
}