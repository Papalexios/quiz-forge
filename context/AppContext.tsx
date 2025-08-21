import React, { createContext, useReducer, useContext, useCallback, useMemo, useEffect } from 'react';
import { AppState, Step, WordPressConfig, WordPressPost, AiProvider, ApiKeys, ApiValidationStatuses, ApiValidationStatus, Theme, QuizDifficulty, QuizData } from '../types';
import { fetchPosts, updatePost, checkSetup, createCfTool, deleteCfTool } from '../services/wordpressService';
import { generateQuizData, renderQuizToStaticHtml, regenerateQuizData, validateApiKey } from '../services/aiService';
import { SHORTCODE_DETECTION_REGEX, SHORTCODE_REMOVAL_REGEX } from '../constants';

type Action =
  | { type: 'RESET' }
  | { type: 'RESET_TO_ANALYZE' }
  | { type: 'START_LOADING'; }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_SETUP_REQUIRED'; payload: boolean }
  | { type: 'CONFIGURE_SUCCESS'; payload: { config: WordPressConfig; posts: WordPressPost[] } }
  | { type: 'SELECT_POST'; payload: WordPressPost }
  | { type: 'GENERATE_QUIZ_SUCCESS'; payload: QuizData }
  | { type: 'SET_THEME_COLOR'; payload: string }
  | { type: 'SET_QUIZ_DIFFICULTY'; payload: QuizDifficulty }
  | { type: 'SET_EDITABLE_QUIZ_TITLE', payload: string }
  | { type: 'SET_REGENERATION_FEEDBACK', payload: string }
  | { type: 'START_INSERTING' }
  | { type: 'INSERT_SNIPPET_SUCCESS'; payload: { posts: WordPressPost[]; updatedPost: WordPressPost } }
  | { type: 'START_DELETING_SNIPPET'; payload: number }
  | { type: 'DELETE_SNIPPET_COMPLETE'; payload: { posts: WordPressPost[] } }
  | { type: 'SET_POST_SEARCH_QUERY', payload: string }
  | { type: 'SET_PROVIDER', payload: AiProvider }
  | { type: 'SET_API_KEY', payload: { provider: AiProvider, key: string } }
  | { type: 'SET_OPENROUTER_MODEL', payload: string }
  | { type: 'SET_VALIDATION_STATUS', payload: { provider: AiProvider, status: ApiValidationStatus } }
  | { type: 'SET_THEME'; payload: Theme };


const WP_CONFIG_KEY = 'wp_config';
const WP_POSTS_KEY = 'wp_posts';
const AI_CONFIG_KEY = 'ai_config';
const THEME_KEY = 'app_theme';

const initialApiKeys: ApiKeys = { gemini: '', openai: '', anthropic: '', openrouter: '' };
const initialValidationStatuses: ApiValidationStatuses = { gemini: 'idle', openai: 'idle', anthropic: 'idle', openrouter: 'idle' };

const getInitialTheme = (): Theme => {
    if (typeof window === 'undefined') return 'light';
    const storedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
    if (storedTheme) return storedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};


const initialState: AppState = {
  currentStep: Step.Configure,
  status: 'idle',
  insertingStatus: 'idle',
  error: null,
  deletingPostId: null,
  theme: getInitialTheme(),
  // AI State
  apiKeys: initialApiKeys,
  apiValidationStatuses: initialValidationStatuses,
  selectedProvider: AiProvider.Gemini,
  openRouterModel: '',
  // WP State
  wpConfig: null,
  posts: [],
  filteredPosts: [],
  postSearchQuery: '',
  selectedPost: null,
  setupRequired: false,
  // Generation State
  quizData: null,
  editableQuizTitle: '',
  regenerationFeedback: '',
  themeColor: '#3b82f6',
  quizDifficulty: 'Challenging',
};

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'RESET':
      sessionStorage.removeItem(WP_POSTS_KEY);
      sessionStorage.removeItem(WP_CONFIG_KEY);
      // Keep API keys and theme on reset
      return { ...initialState, apiKeys: state.apiKeys, apiValidationStatuses: state.apiValidationStatuses, selectedProvider: state.selectedProvider, openRouterModel: state.openRouterModel, theme: state.theme };
    case 'RESET_TO_ANALYZE':
      return {
        ...state,
        currentStep: Step.Analyze,
        status: 'idle',
        insertingStatus: 'idle',
        error: null,
        deletingPostId: null,
        selectedPost: null,
        quizData: null,
        editableQuizTitle: '',
        regenerationFeedback: '',
      };
    case 'START_LOADING':
      return { ...state, status: 'loading', error: null, setupRequired: false, quizData: null };
    case 'SET_ERROR':
      return { ...state, status: 'error', insertingStatus: 'error', error: action.payload, deletingPostId: null };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'SET_SETUP_REQUIRED':
      return { ...state, status: 'error', setupRequired: action.payload };
    case 'CONFIGURE_SUCCESS':
      return {
        ...state,
        status: 'idle',
        currentStep: Step.Analyze,
        wpConfig: action.payload.config,
        posts: action.payload.posts,
        filteredPosts: action.payload.posts,
        setupRequired: false,
      };
    case 'SELECT_POST':
      return { 
        ...state, 
        selectedPost: action.payload, 
        currentStep: Step.Generate,
        editableQuizTitle: '',
        regenerationFeedback: '',
        error: null,
      };
    case 'GENERATE_QUIZ_SUCCESS':
      return { ...state, status: 'idle', error: null, quizData: action.payload, editableQuizTitle: action.payload.quizTitle };
    case 'SET_THEME_COLOR':
        return { ...state, themeColor: action.payload };
    case 'SET_QUIZ_DIFFICULTY':
        return { ...state, quizDifficulty: action.payload };
    case 'SET_EDITABLE_QUIZ_TITLE':
        return { ...state, editableQuizTitle: action.payload };
    case 'SET_REGENERATION_FEEDBACK':
        return { ...state, regenerationFeedback: action.payload };
    case 'START_INSERTING':
        return { ...state, insertingStatus: 'loading', error: null };
    case 'INSERT_SNIPPET_SUCCESS':
        const filteredAfterInsert = action.payload.posts.filter(post => post.title.rendered.toLowerCase().includes(state.postSearchQuery.toLowerCase()));
        return { 
            ...state, 
            insertingStatus: 'success',
            posts: action.payload.posts,
            filteredPosts: filteredAfterInsert,
            selectedPost: action.payload.updatedPost,
        };
    case 'START_DELETING_SNIPPET':
        return { ...state, status: 'loading', deletingPostId: action.payload, error: null };
    case 'DELETE_SNIPPET_COMPLETE':
        const filteredAfterDelete = action.payload.posts.filter(post => post.title.rendered.toLowerCase().includes(state.postSearchQuery.toLowerCase()));
        return {
            ...state,
            status: 'idle',
            deletingPostId: null,
            posts: action.payload.posts,
            filteredPosts: filteredAfterDelete,
            selectedPost: state.selectedPost?.id === state.deletingPostId ? null : state.selectedPost,
            quizData: state.selectedPost?.id === state.deletingPostId ? null : state.quizData,
        };
    case 'SET_POST_SEARCH_QUERY': {
        const query = action.payload.toLowerCase();
        const filteredPosts = state.posts.filter(post => post.title.rendered.toLowerCase().includes(query));
        return { ...state, postSearchQuery: action.payload, filteredPosts };
    }
    case 'SET_PROVIDER':
        return { ...state, selectedProvider: action.payload };
    case 'SET_API_KEY':
        return { ...state, apiKeys: { ...state.apiKeys, [action.payload.provider]: action.payload.key } };
    case 'SET_OPENROUTER_MODEL':
        return { ...state, openRouterModel: action.payload };
    case 'SET_VALIDATION_STATUS':
        return { ...state, apiValidationStatuses: { ...state.apiValidationStatuses, [action.payload.provider]: action.payload.status }};
    case 'SET_THEME':
        return { ...state, theme: action.payload };
    default:
      return state;
  }
};

const AppContext = createContext<{
  state: AppState;
  connectToWordPress: (config: WordPressConfig) => Promise<void>;
  selectPost: (post: WordPressPost) => Promise<void>;
  setThemeColor: (color: string) => void;
  setQuizDifficulty: (difficulty: QuizDifficulty) => void;
  setEditableQuizTitle: (title: string) => void;
  setRegenerationFeedback: (feedback: string) => void;
  regenerateQuiz: () => Promise<void>;
  insertSnippet: () => Promise<void>;
  deleteSnippet: (postId: number, toolId?: number) => Promise<void>;
  setPostSearchQuery: (query: string) => void;
  reset: () => void;
  resetToAnalyze: () => void;
  setProvider: (provider: AiProvider) => void;
  setApiKey: (provider: AiProvider, key: string) => void;
  setOpenRouterModel: (model: string) => void;
  validateAndSaveApiKey: (provider: AiProvider) => Promise<void>;
  setTheme: (theme: Theme) => void;
} | null>(null);

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState, (init) => {
    try {
      // Load AI config from localStorage (persistent)
      const cachedAiConfig = localStorage.getItem(AI_CONFIG_KEY);
      const aiConfig = cachedAiConfig ? JSON.parse(cachedAiConfig) : {};

      // Load WP config from sessionStorage (session-only)
      const cachedWpConfig = sessionStorage.getItem(WP_CONFIG_KEY);
      const cachedPosts = sessionStorage.getItem(WP_POSTS_KEY);
      
      let wpState = {};
      if (cachedWpConfig && cachedPosts) {
        const config = JSON.parse(cachedWpConfig);
        const posts = JSON.parse(cachedPosts);
        wpState = {
          currentStep: Step.Analyze,
          wpConfig: config,
          posts: posts,
          filteredPosts: posts,
        };
      }
       return {
          ...init,
          ...wpState,
          apiKeys: { ...initialApiKeys, ...aiConfig.apiKeys },
          selectedProvider: aiConfig.selectedProvider || AiProvider.Gemini,
          openRouterModel: aiConfig.openRouterModel || '',
          theme: getInitialTheme(),
        };
    } catch (e) {
      console.error("Failed to load state from storage", e);
    }
    return { ...init, theme: getInitialTheme() };
  });
  
  // Effect to apply theme class to the root element
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(state.theme);
    localStorage.setItem(THEME_KEY, state.theme);
  }, [state.theme]);

  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);
  const resetToAnalyze = useCallback(() => dispatch({ type: 'RESET_TO_ANALYZE' }), []);

  const connectToWordPress = useCallback(async (config: WordPressConfig) => {
    dispatch({ type: 'START_LOADING' });
    try {
      const isSetup = await checkSetup(config);
      if (!isSetup) {
        dispatch({ type: 'SET_SETUP_REQUIRED', payload: true });
        dispatch({ type: 'SET_ERROR', payload: 'A one-time setup is required.' });
        sessionStorage.setItem(WP_CONFIG_KEY, JSON.stringify(config)); 
        return;
      }

      const posts = await fetchPosts(config);
      if (posts.length === 0) {
        dispatch({ type: 'SET_ERROR', payload: 'Connected successfully, but no posts were found.' });
      } else {
        sessionStorage.setItem(WP_CONFIG_KEY, JSON.stringify(config));
        sessionStorage.setItem(WP_POSTS_KEY, JSON.stringify(posts));
        dispatch({ type: 'CONFIGURE_SUCCESS', payload: { config, posts } });
      }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'An unknown error occurred' });
    }
  }, []);

  const generateAndSetQuizData = useCallback(async (post: WordPressPost, difficulty: QuizDifficulty, quizData?: QuizData, feedback?: string) => {
    dispatch({ type: 'START_LOADING' });
    try {
        let data;
        if (quizData && feedback) {
            // This is a regeneration call
            data = await regenerateQuizData(state, post.title.rendered, post.content.rendered, quizData, feedback);
        } else {
            // This is a fresh generation call
            data = await generateQuizData(state, post.title.rendered, post.content.rendered, difficulty);
        }
      dispatch({ type: 'GENERATE_QUIZ_SUCCESS', payload: data });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to generate quiz data.' });
    }
  }, [state]);

  const selectPost = useCallback(async (post: WordPressPost) => {
    dispatch({ type: 'SELECT_POST', payload: post });
    await generateAndSetQuizData(post, state.quizDifficulty);
  }, [generateAndSetQuizData, state.quizDifficulty]);
  
  const regenerateQuiz = useCallback(async () => {
    if (state.selectedPost && state.quizData) {
        await generateAndSetQuizData(state.selectedPost, state.quizDifficulty, state.quizData, state.regenerationFeedback);
    }
  }, [state.selectedPost, state.quizDifficulty, state.quizData, state.regenerationFeedback, generateAndSetQuizData]);

  const setThemeColor = useCallback((color: string) => dispatch({ type: 'SET_THEME_COLOR', payload: color }), []);
  
  const setQuizDifficulty = useCallback((difficulty: QuizDifficulty) => {
      dispatch({ type: 'SET_QUIZ_DIFFICULTY', payload: difficulty });
      if (state.selectedPost) {
          generateAndSetQuizData(state.selectedPost, difficulty);
      }
  }, [state.selectedPost, generateAndSetQuizData]);

  const setEditableQuizTitle = useCallback((title: string) => dispatch({ type: 'SET_EDITABLE_QUIZ_TITLE', payload: title }), []);
  const setRegenerationFeedback = useCallback((feedback: string) => dispatch({ type: 'SET_REGENERATION_FEEDBACK', payload: feedback }), []);
  
  const insertSnippet = useCallback(async () => {
    if (!state.wpConfig || !state.selectedPost || !state.quizData) return;
    dispatch({ type: 'START_INSERTING' });
    try {
      const finalQuizData = { ...state.quizData, quizTitle: state.editableQuizTitle };
      const finalHtml = renderQuizToStaticHtml(finalQuizData, state.themeColor);

      const { id: newToolId } = await createCfTool(state.wpConfig, finalQuizData.quizTitle, finalHtml);
      
      const shortcode = `[contentforge_tool id="${newToolId}"]`;

      // Smart Insertion Logic
      const newContent = (() => {
          const originalContent = state.selectedPost.content.rendered;
          const shortcodeWithNewlines = `\n\n${shortcode}\n\n`;

          // Try to find the last h2 or h3 tag to insert before
          const lastH2 = originalContent.lastIndexOf('</h2>');
          const lastH3 = originalContent.lastIndexOf('</h3>');
          const insertionPoint = Math.max(lastH2, lastH3);

          if (insertionPoint !== -1) {
              // Find the start of that tag
              const tagStart = originalContent.lastIndexOf('<h', insertionPoint);
              if (tagStart !== -1) {
                  return originalContent.substring(0, tagStart) + shortcodeWithNewlines + originalContent.substring(tagStart);
              }
          }
          
          // Fallback to appending at the end
          return originalContent + shortcodeWithNewlines;
      })();
      
      await updatePost(state.wpConfig, state.selectedPost.id, newContent);
      
      const newPosts = await fetchPosts(state.wpConfig);
      const updatedPost = newPosts.find(p => p.id === state.selectedPost!.id)!;

      dispatch({ type: 'INSERT_SNIPPET_SUCCESS', payload: { posts: newPosts, updatedPost } });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to insert snippet' });
    }
  }, [state]);

  const deleteSnippet = useCallback(async (postId: number, toolId?: number) => {
    if (!state.wpConfig) return;
    
    const postToDeleteFrom = state.posts.find(p => p.id === postId);
    if (!postToDeleteFrom) return;

    dispatch({ type: 'START_DELETING_SNIPPET', payload: postId });

    try {
        let contentHasShortcode = SHORTCODE_DETECTION_REGEX.test(postToDeleteFrom.content.rendered);
        
        if (!contentHasShortcode) {
             throw new Error("Tool shortcode not found in post content. Deletion failed.");
        }
        
        const newContent = postToDeleteFrom.content.rendered.replace(SHORTCODE_REMOVAL_REGEX, '');
        await updatePost(state.wpConfig, postId, newContent);

        if (toolId) {
            await deleteCfTool(state.wpConfig, toolId);
        } else {
            console.warn(`Could not find a toolId for post ${postId}. The shortcode was removed, but the underlying tool post may still exist.`);
        }

        const newPosts = await fetchPosts(state.wpConfig);
        dispatch({ type: 'DELETE_SNIPPET_COMPLETE', payload: { posts: newPosts } });

    } catch (err)      {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to delete snippet' });
    }
  }, [state.wpConfig, state.posts]);

  const setPostSearchQuery = useCallback((query: string) => dispatch({ type: 'SET_POST_SEARCH_QUERY', payload: query }), []);
  
  const setProvider = useCallback((provider: AiProvider) => {
      dispatch({type: 'SET_PROVIDER', payload: provider});
  }, []);

  const setApiKey = useCallback((provider: AiProvider, key: string) => {
      dispatch({type: 'SET_API_KEY', payload: { provider, key }});
      if (state.apiValidationStatuses[provider] === 'valid') {
          dispatch({type: 'SET_VALIDATION_STATUS', payload: { provider, status: 'idle' }});
      }
  }, [state.apiValidationStatuses]);

  const setOpenRouterModel = useCallback((model: string) => {
      dispatch({type: 'SET_OPENROUTER_MODEL', payload: model});
  }, []);

  const saveAiConfigToLocalStorage = useCallback(() => {
    const configToSave = {
        apiKeys: state.apiKeys,
        selectedProvider: state.selectedProvider,
        openRouterModel: state.openRouterModel,
    };
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(configToSave));
  }, [state.apiKeys, state.selectedProvider, state.openRouterModel]);

  const validateAndSaveApiKey = useCallback(async (provider: AiProvider) => {
    dispatch({ type: 'SET_VALIDATION_STATUS', payload: { provider, status: 'validating' } });
    const apiKey = state.apiKeys[provider];
    const model = state.openRouterModel;

    const isValid = await validateApiKey(provider, apiKey, model);

    if (isValid) {
      dispatch({ type: 'SET_VALIDATION_STATUS', payload: { provider, status: 'valid' } });
      saveAiConfigToLocalStorage();
    } else {
      dispatch({ type: 'SET_VALIDATION_STATUS', payload: { provider, status: 'invalid' } });
    }
  }, [state.apiKeys, state.openRouterModel, saveAiConfigToLocalStorage]);
  
  const setTheme = useCallback((theme: Theme) => {
    dispatch({ type: 'SET_THEME', payload: theme });
  }, []);
  
  useEffect(() => {
    saveAiConfigToLocalStorage();
  }, [state.apiKeys, state.selectedProvider, state.openRouterModel, saveAiConfigToLocalStorage]);

  const value = useMemo(() => ({
    state,
    connectToWordPress,
    selectPost,
    setThemeColor,
    setQuizDifficulty,
    setEditableQuizTitle,
    setRegenerationFeedback,
    regenerateQuiz,
    insertSnippet,
    deleteSnippet,
    setPostSearchQuery,
    reset,
    resetToAnalyze,
    setProvider,
    setApiKey,
    setOpenRouterModel,
    validateAndSaveApiKey,
    setTheme,
  }), [
    state, 
    connectToWordPress, 
    selectPost, 
    setThemeColor,
    setQuizDifficulty,
    setEditableQuizTitle,
    setRegenerationFeedback,
    regenerateQuiz, 
    insertSnippet, 
    deleteSnippet, 
    setPostSearchQuery, 
    reset,
    resetToAnalyze,
    setProvider,
    setApiKey,
    setOpenRouterModel,
    validateAndSaveApiKey,
    setTheme
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};