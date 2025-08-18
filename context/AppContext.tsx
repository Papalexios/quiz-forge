
import React, { createContext, useReducer, useContext, useCallback, useMemo, useEffect } from 'react';
import { AppState, Step, WordPressConfig, WordPressPost, ToolIdea, AiProvider, ApiKeys, ApiValidationStatuses, ApiValidationStatus } from '../types';
import { fetchPosts, updatePost } from '../services/wordpressService';
import { validateApiKey, suggestToolIdeas, insertSnippetIntoContent, generateHtmlSnippetStream } from '../services/aiService';

type Action =
  | { type: 'RESET' }
  | { type: 'RESET_TO_ANALYZE' }
  | { type: 'START_LOADING'; payload?: 'ideas' | 'snippet' | 'insert' }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CONFIGURE_SUCCESS'; payload: { config: WordPressConfig; posts: WordPressPost[] } }
  | { type: 'SELECT_POST'; payload: WordPressPost }
  | { type: 'GET_IDEAS_SUCCESS'; payload: ToolIdea[] }
  | { type: 'SELECT_IDEA'; payload: ToolIdea }
  | { type: 'SET_THEME_COLOR'; payload: string }
  | { type: 'GENERATE_SNIPPET_START' }
  | { type: 'GENERATE_SNIPPET_CHUNK'; payload: string }
  | { type: 'GENERATE_SNIPPET_COMPLETE' }
  | { type: 'INSERT_SNIPPET_SUCCESS'; payload: { posts: WordPressPost[]; updatedPost: WordPressPost } }
  | { type: 'START_DELETING_SNIPPET'; payload: number }
  | { type: 'DELETE_SNIPPET_COMPLETE'; payload: { posts: WordPressPost[] } }
  | { type: 'SET_POST_SEARCH_QUERY', payload: string }
  | { type: 'SET_PROVIDER', payload: AiProvider }
  | { type: 'SET_API_KEY', payload: { provider: AiProvider, key: string } }
  | { type: 'SET_OPENROUTER_MODEL', payload: string }
  | { type: 'SET_VALIDATION_STATUS', payload: { provider: AiProvider, status: ApiValidationStatus } };


const WP_CONFIG_KEY = 'wp_config';
const WP_POSTS_KEY = 'wp_posts';
const AI_CONFIG_KEY = 'ai_config';

const initialApiKeys: ApiKeys = { gemini: '', openai: '', anthropic: '', openrouter: '' };
const initialValidationStatuses: ApiValidationStatuses = { gemini: 'idle', openai: 'idle', anthropic: 'idle', openrouter: 'idle' };

const initialState: AppState = {
  currentStep: Step.Configure,
  status: 'idle',
  error: null,
  deletingPostId: null,
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
  // Generation State
  toolIdeas: [],
  selectedIdea: null,
  generatedSnippet: '',
  themeColor: '#3b82f6',
};

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'RESET':
      sessionStorage.removeItem(WP_POSTS_KEY);
      sessionStorage.removeItem(WP_CONFIG_KEY);
      // Keep API keys on reset
      return { ...initialState, apiKeys: state.apiKeys, apiValidationStatuses: state.apiValidationStatuses, selectedProvider: state.selectedProvider, openRouterModel: state.openRouterModel };
    case 'RESET_TO_ANALYZE':
      return {
        ...state,
        currentStep: Step.Analyze,
        status: 'idle',
        error: null,
        deletingPostId: null,
        selectedPost: null,
        toolIdeas: [],
        selectedIdea: null,
        generatedSnippet: '',
      };
    case 'START_LOADING':
      return { ...state, status: 'loading', error: null };
    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.payload, deletingPostId: null };
    case 'CONFIGURE_SUCCESS':
      return {
        ...state,
        status: 'idle',
        currentStep: Step.Analyze,
        wpConfig: action.payload.config,
        posts: action.payload.posts,
        filteredPosts: action.payload.posts,
      };
    case 'SELECT_POST':
      return { ...state, selectedPost: action.payload, toolIdeas: [], generatedSnippet: '' };
    case 'GET_IDEAS_SUCCESS':
      return { ...state, status: 'idle', toolIdeas: action.payload };
    case 'SELECT_IDEA':
      return { ...state, selectedIdea: action.payload, currentStep: Step.Generate };
    case 'SET_THEME_COLOR':
        return { ...state, themeColor: action.payload };
    case 'GENERATE_SNIPPET_START':
        return { ...state, status: 'loading', generatedSnippet: '', error: null };
    case 'GENERATE_SNIPPET_CHUNK':
        return { ...state, generatedSnippet: state.generatedSnippet + action.payload };
    case 'GENERATE_SNIPPET_COMPLETE':
        return { ...state, status: 'idle' };
    case 'INSERT_SNIPPET_SUCCESS':
        const filteredAfterInsert = action.payload.posts.filter(post => post.title.rendered.toLowerCase().includes(state.postSearchQuery.toLowerCase()));
        return { 
            ...state, 
            status: 'success',
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
            toolIdeas: state.selectedPost?.id === state.deletingPostId ? [] : state.toolIdeas,
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
    default:
      return state;
  }
};

const AppContext = createContext<{
  state: AppState;
  connectToWordPress: (config: WordPressConfig) => Promise<void>;
  selectPost: (post: WordPressPost) => Promise<void>;
  selectIdea: (idea: ToolIdea) => void;
  setThemeColor: (color: string) => void;
  generateSnippet: () => Promise<void>;
  insertSnippet: () => Promise<void>;
  deleteSnippet: (postId: number) => Promise<void>;
  setPostSearchQuery: (query: string) => void;
  reset: () => void;
  resetToAnalyze: () => void;
  setProvider: (provider: AiProvider) => void;
  setApiKey: (provider: AiProvider, key: string) => void;
  setOpenRouterModel: (model: string) => void;
  validateAndSaveApiKey: (provider: AiProvider) => Promise<void>;
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
        };
    } catch (e) {
      console.error("Failed to load state from storage", e);
    }
    return init;
  });
  
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);
  const resetToAnalyze = useCallback(() => dispatch({ type: 'RESET_TO_ANALYZE' }), []);

  const connectToWordPress = useCallback(async (config: WordPressConfig) => {
    dispatch({ type: 'START_LOADING' });
    try {
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

  const selectPost = useCallback(async (post: WordPressPost) => {
    dispatch({ type: 'SELECT_POST', payload: post });
    dispatch({ type: 'START_LOADING' });
    try {
      const ideas = await suggestToolIdeas(state, post.title.rendered, post.content.rendered);
      dispatch({ type: 'GET_IDEAS_SUCCESS', payload: ideas });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to generate ideas' });
    }
  }, [state]);
  
  const selectIdea = useCallback((idea: ToolIdea) => dispatch({ type: 'SELECT_IDEA', payload: idea }), []);

  const setThemeColor = useCallback((color: string) => dispatch({ type: 'SET_THEME_COLOR', payload: color }), []);
  
  const generateSnippet = useCallback(async () => {
    if (!state.selectedPost || !state.selectedIdea) return;
    dispatch({ type: 'GENERATE_SNIPPET_START' });
    try {
      const stream = generateHtmlSnippetStream(state, state.selectedPost.title.rendered, state.selectedPost.content.rendered, state.selectedIdea, state.themeColor);
      for await (const chunk of stream) {
        dispatch({ type: 'GENERATE_SNIPPET_CHUNK', payload: chunk });
      }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to generate snippet' });
    } finally {
      dispatch({ type: 'GENERATE_SNIPPET_COMPLETE' });
    }
  }, [state]);

  const insertSnippet = useCallback(async () => {
    if (!state.wpConfig || !state.selectedPost || !state.generatedSnippet) return;
    dispatch({ type: 'START_LOADING' });
    try {
      const newContent = await insertSnippetIntoContent(state, state.selectedPost.content.rendered, state.generatedSnippet);
      await updatePost(state.wpConfig, state.selectedPost.id, newContent);
      
      const newPosts = await fetchPosts(state.wpConfig);
      const updatedPost = newPosts.find(p => p.id === state.selectedPost!.id)!;

      dispatch({ type: 'INSERT_SNIPPET_SUCCESS', payload: { posts: newPosts, updatedPost } });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to insert snippet' });
    }
  }, [state]);

  const deleteSnippet = useCallback(async (postId: number) => {
    if (!state.wpConfig) return;
    
    const postToDeleteFrom = state.posts.find(p => p.id === postId);
    if (!postToDeleteFrom) return;

    dispatch({ type: 'START_DELETING_SNIPPET', payload: postId });

    try {
        const doc = new DOMParser().parseFromString(postToDeleteFrom.content.rendered, 'text/html');
        const toolSnippet = doc.querySelector('[data-wp-seo-optimizer-tool="true"]');
        
        if (toolSnippet) {
            // For backwards compatibility, find and remove an adjacent Tailwind script tag from older snippets.
            // New snippets have the script tag inside the tool, so this logic won't affect them.
            const findAndRemoveAdjacentScript = (startNode: Node | null, direction: 'previous' | 'next') => {
                let currentNode = startNode;
                 // Traverse past any whitespace text nodes.
                while (currentNode && currentNode.nodeType === Node.TEXT_NODE && /^\s*$/.test(currentNode.textContent || '')) {
                    currentNode = direction === 'previous' ? currentNode.previousSibling : currentNode.nextSibling;
                }
                // If the adjacent node is the Tailwind script, remove it.
                if (currentNode && currentNode.nodeType === Node.ELEMENT_NODE) {
                    const element = currentNode as Element;
                    if (element.tagName.toLowerCase() === 'script' && (element as HTMLScriptElement).src.includes('cdn.tailwindcss.com')) {
                        element.remove();
                        return true; // Script found and removed
                    }
                }
                return false; // Script not found
            };
            
            // Check previous sibling first, then next sibling if not found.
            if (!findAndRemoveAdjacentScript(toolSnippet.previousSibling, 'previous')) {
                findAndRemoveAdjacentScript(toolSnippet.nextSibling, 'next');
            }
            
            // Finally, remove the main tool container.
            toolSnippet.remove();
        }
        
        const newContent = doc.body.innerHTML;
        
        await updatePost(state.wpConfig, postId, newContent);

        const newPosts = await fetchPosts(state.wpConfig);

        dispatch({ type: 'DELETE_SNIPPET_COMPLETE', payload: { posts: newPosts } });

    } catch (err) {
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
  
  // Effect to save AI configuration to localStorage whenever it changes
  useEffect(() => {
    saveAiConfigToLocalStorage();
  }, [state.apiKeys, state.selectedProvider, state.openRouterModel, saveAiConfigToLocalStorage]);


  const value = useMemo(() => ({
    state,
    connectToWordPress,
    selectPost,
    selectIdea,
    setThemeColor,
    generateSnippet,
    insertSnippet,
    deleteSnippet,
    setPostSearchQuery,
    reset,
    resetToAnalyze,
    setProvider,
    setApiKey,
    setOpenRouterModel,
    validateAndSaveApiKey,
  }), [
    state, 
    connectToWordPress, 
    selectPost, 
    selectIdea, 
    setThemeColor, 
    generateSnippet, 
    insertSnippet, 
    deleteSnippet, 
    setPostSearchQuery, 
    reset,
    resetToAnalyze,
    setProvider,
    setApiKey,
    setOpenRouterModel,
    validateAndSaveApiKey
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