import { GoogleGenAI, Type } from "@google/genai";
import { AppState, AiProvider, QuizDifficulty, QuizData, KnowledgeCheckQuestion } from '../types';
import { AI_PROVIDERS } from "../constants";

// Helper to strip HTML tags for cleaner prompts
const stripHtml = (html: string): string => {
    if (typeof document !== 'undefined') {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || "";
    }
    return html.replace(/<[^>]*>/g, '');
};

// --- API VALIDATION ---
export async function validateApiKey(provider: AiProvider, apiKey: string, model?: string): Promise<boolean> {
  try {
    switch (provider) {
      case AiProvider.Gemini:
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const geminiResponse = await fetch(geminiUrl);
        return geminiResponse.ok;
      
      case AiProvider.OpenAI:
        const openaiResponse = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        return openaiResponse.ok;

      case AiProvider.Anthropic:
         const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 
                'x-api-key': apiKey,
                'anthropic-version': '203-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model: "claude-3-haiku-20240307",
                max_tokens: 1,
                messages: [{ role: "user", content: "h" }]
            })
        });
        return anthropicResponse.status !== 401;

      case AiProvider.OpenRouter:
         const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model || AI_PROVIDERS.openrouter.defaultModel,
                max_tokens: 1,
                messages: [{ role: "user", content: "h" }]
            })
        });
        return openRouterResponse.status !== 401;

      default:
        return false;
    }
  } catch (error) {
    console.error(`Validation error for ${provider}:`, error);
    return false;
  }
}

// --- DATA SANITIZATION ---
/**
 * A robust data sanitization layer that acts as a quality-control checkpoint.
 * It validates the entire data structure from the AI, fixes potential issues,
 * and provides sensible defaults to prevent "undefined" errors in the UI.
 * If the AI fails to generate valid questions, it injects a fallback "error" quiz
 * to be displayed gracefully in the UI instead of crashing the application.
 */
const sanitizeQuizData = (data: Partial<QuizData>): QuizData => {
    // Basic structure with defaults
    const sanitizedData: QuizData = {
        quizTitle: data.quizTitle || 'Interactive Quiz',
        quizType: data.quizType === 'personality' ? 'personality' : 'knowledge-check',
        questions: [],
        results: data.quizType !== 'personality' ? [] : undefined,
        outcomes: data.quizType === 'personality' ? [] : undefined,
    };

    // Sanitize Questions
    if (Array.isArray(data.questions)) {
        sanitizedData.questions = data.questions
            .filter(q => q && typeof q === 'object' && q.questionText && Array.isArray(q.options) && q.options.length > 1) // Ensure at least 2 options
            .map(q => {
                if (sanitizedData.quizType === 'knowledge-check') {
                    const question = q as Partial<KnowledgeCheckQuestion>;
                    // Ensure correctAnswerIndex is a valid number within bounds
                    let index = question.correctAnswerIndex !== undefined && question.correctAnswerIndex !== null ? parseInt(String(question.correctAnswerIndex), 10) : -1;
                    if (isNaN(index) || index < 0 || index >= (question.options?.length || 0)) {
                        index = 0; // Default to the first option if invalid
                    }
                    return {
                        questionText: String(question.questionText || 'Untitled Question'),
                        options: (question.options || []).map(opt => String(opt || '')),
                        correctAnswerIndex: index,
                        explanation: String(question.explanation || 'No explanation provided.'),
                    };
                }
                // (Future: Add sanitization for personality questions)
                return q;
            });
    }

    // Sanitize Results (for knowledge-check)
    if (sanitizedData.quizType === 'knowledge-check' && Array.isArray(data.results)) {
        sanitizedData.results = data.results.filter(r => r && typeof r.scoreThreshold === 'number' && r.title && r.feedback);
    }

    // Sanitize Outcomes (for personality)
    if (sanitizedData.quizType === 'personality' && Array.isArray(data.outcomes)) {
        sanitizedData.outcomes = data.outcomes.filter(o => o && o.id && o.title && o.description);
    }
    
    // CRITICAL FIX: After initial sanitization, check for empty questions.
    // If the array is empty, inject a graceful fallback quiz instead of throwing an error.
    if (sanitizedData.questions.length === 0) {
        sanitizedData.quizTitle = data.quizTitle || "Quiz Generation Issue";
        sanitizedData.quizType = 'knowledge-check'; // Force to knowledge-check for a simple, universal fallback
        sanitizedData.questions = [{
            questionText: "Our AI couldn't create valid questions from this content.",
            options: ["Try again with creative direction", "Select a different post"],
            correctAnswerIndex: 0,
            explanation: "This can happen with very short or abstract posts. Try giving the AI more specific instructions in the 'Creative Direction' box to guide the generation process."
        }];
        sanitizedData.results = [{
            scoreThreshold: 0,
            title: "Let's Try Again",
            feedback: "Use the controls on the left to regenerate the quiz. Providing a hint in the 'Creative Direction' box often helps the AI produce better results."
        }];
        sanitizedData.outcomes = undefined; // Ensure outcomes are cleared for this fallback
    } else {
        // If we have valid questions, just ensure the result tiers are complete.
        if (sanitizedData.quizType === 'knowledge-check') {
            const hasZeroThreshold = (sanitizedData.results || []).some(r => r.scoreThreshold === 0);
            if (!hasZeroThreshold) {
                // Prepend the mandatory zero-score tier if missing.
                (sanitizedData.results || []).unshift({
                    scoreThreshold: 0,
                    title: 'Just Starting',
                    feedback: 'Every expert starts somewhere! Review the material and try again to improve your score of {score} out of {total}.'
                });
            }
        }
    }

    return sanitizedData as QuizData;
};


const GeminiSchema = {
    type: Type.OBJECT,
    properties: {
        quizTitle: { type: Type.STRING, description: "A compelling, short, SEO-optimized title for the quiz." },
        quizType: { type: Type.STRING, enum: ['knowledge-check', 'personality'], description: "The optimal quiz type based on the content." },
        questions: {
            type: Type.ARRAY,
            description: "An array of 3-8 question objects.",
            items: {
                type: Type.OBJECT,
                properties: {
                    questionText: { type: Type.STRING, description: "The text of the question." },
                    options: {
                        type: Type.ARRAY,
                        description: "An array of options. For knowledge-check, these are strings. For personality, they are objects.",
                        items: {
                            oneOf: [
                                { type: Type.STRING }, // For knowledge-check
                                { // For personality
                                    type: Type.OBJECT,
                                    properties: {
                                        text: { type: Type.STRING, description: "The option text." },
                                        pointsFor: { type: Type.STRING, description: "The 'id' of the outcome this option contributes to." }
                                    },
                                     required: ['text', 'pointsFor']
                                }
                            ]
                        }
                    },
                    correctAnswerIndex: { type: Type.INTEGER, description: "For knowledge-check only. The 0-based index of the correct answer." },
                    explanation: { type: Type.STRING, description: "For knowledge-check only. A helpful, insightful explanation of the correct answer." }
                },
                required: ['questionText', 'options']
            }
        },
        results: {
            type: Type.ARRAY,
            description: "For 'knowledge-check' quizzes only. An array of result tiers based on score. MUST include a tier with scoreThreshold: 0.",
            items: {
                type: Type.OBJECT,
                properties: {
                    scoreThreshold: { type: Type.INTEGER, description: "The minimum score to achieve this tier." },
                    title: { type: Type.STRING, description: "The title for this result tier (e.g., 'Novice', 'Expert')." },
                    feedback: { type: Type.STRING, description: "Encouraging feedback. Can include placeholders {score} and {total}." }
                },
                required: ['scoreThreshold', 'title', 'feedback']
            }
        },
        outcomes: {
            type: Type.ARRAY,
            description: "For 'personality' quizzes only. An array of possible personality outcomes.",
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: "A unique identifier for the outcome (e.g., 'strategist')." },
                    title: { type: Type.STRING, description: "The title of the personality type." },
                    description: { type: Type.STRING, description: "A detailed description of the personality type." }
                },
                required: ['id', 'title', 'description']
            }
        }
    },
    required: ['quizTitle', 'quizType', 'questions']
};


const getQuizDataGenerationPrompt = (postTitle: string, postContent: string, difficulty: QuizDifficulty): string => {
    const cleanContent = stripHtml(postContent).substring(0, 8000);
    return `
    **Objective:** Generate a premium quality, engaging, and factually accurate quiz based on the provided blog post content.
    **Instructions:**
    1.  **Analyze Content:** Read the post title and content to identify key concepts and facts.
    2.  **Create a Title:** Generate a catchy, engaging, and SEO-optimized title for the quiz in the 'quizTitle' field.
    3.  **Choose Quiz Type:** Decide between 'knowledge-check' (for factual content) or 'personality' (for conceptual content).
    4.  **Generate Quiz (CRITICAL REQUIREMENT):** You MUST create between 3 and 8 high-quality questions. The 'questions' array in the JSON output CANNOT be empty.
        - **For Knowledge-Check:** Questions must test understanding, not just recall. Provide insightful, expert-level explanations for correct answers. The correctAnswerIndex must be a valid, 0-based number.
        - **For Personality:** Create meaningful outcomes with well-written descriptions.
    5.  **Create Results Tiers (CRITICAL):** For 'knowledge-check' quizzes, you MUST provide at least two result tiers. One of these tiers MUST have a 'scoreThreshold' of 0. This is the fallback for a user who gets no questions right. Example: { "scoreThreshold": 0, "title": "Novice", "feedback": "Keep learning!" }.
    6.  **Set Difficulty:** Adhere strictly to the requested difficulty: '${difficulty}'.
    7.  **Output:** Respond with ONLY a valid JSON object matching the provided schema. Do not include any other text or markdown.
    **Content for Analysis:**
    *   **Title:** "${postTitle}"
    *   **Content:** "${cleanContent}"
    `;
};


export async function generateQuizData(state: AppState, postTitle: string, postContent: string, difficulty: QuizDifficulty): Promise<QuizData> {
    const { selectedProvider, apiKeys } = state;
    const apiKey = apiKeys[selectedProvider];
    const prompt = getQuizDataGenerationPrompt(postTitle, postContent, difficulty);
    
    let responseText = '';
    try {
        if (selectedProvider === AiProvider.Gemini) {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: AI_PROVIDERS.gemini.defaultModel,
                contents: prompt,
                config: { responseMimeType: "application/json", responseSchema: GeminiSchema },
            });
            responseText = response.text;
        } else {
            responseText = await callGenericChatApi(state, prompt, true);
        }
    } catch (apiError) {
        console.error("AI API error in generateQuizData:", apiError);
        // Gracefully handle API errors by returning a fallback quiz.
        // This prevents a disruptive error screen for recoverable issues like network timeouts or invalid keys.
        return sanitizeQuizData({});
    }
    
    try {
        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace <= firstBrace) {
             return sanitizeQuizData({});
        }
        const jsonString = responseText.substring(firstBrace, lastBrace + 1);
        const parsedData = JSON.parse(jsonString);
        return sanitizeQuizData(parsedData);
    } catch (e) {
        console.error("Failed to parse AI response:", e);
        return sanitizeQuizData({});
    }
}

const getQuizRegenerationPrompt = (postTitle: string, postContent: string, previousQuizData: QuizData, userFeedback: string): string => {
    const cleanContent = stripHtml(postContent).substring(0, 8000);
    return `
    **Objective:** Revise the provided quiz JSON based on user feedback, maintaining elite quality.
    **Instructions:**
    1.  **Analyze Feedback:** Understand the user's creative direction.
    2.  **Revise Content (CRITICAL REQUIREMENT):** Surgically edit the quiz to align with the feedback. The final 'questions' array in the JSON output CANNOT be empty and must contain at least 3 questions.
    3.  **Maintain Quality:** Ensure the 'quizTitle' is catchy and engaging. For knowledge-check quizzes, ensure the 'correctAnswerIndex' is a valid number and there is a result tier with a 'scoreThreshold' of 0.
    4.  **Output:** Respond with ONLY the revised, valid JSON object matching the schema. No extra text.
    **Original Context:**
    *   **Title:** "${postTitle}"
    *   **Content:** "${cleanContent}"
    **Previous Quiz JSON:**
    \`\`\`json
    ${JSON.stringify(previousQuizData, null, 2)}
    \`\`\`
    **User Feedback:**
    "${userFeedback}"
    `;
}

export async function regenerateQuizData(state: AppState, postTitle: string, postContent: string, previousQuizData: QuizData, userFeedback: string): Promise<QuizData> {
    const { selectedProvider, apiKeys } = state;
    const apiKey = apiKeys[selectedProvider];
    const prompt = getQuizRegenerationPrompt(postTitle, postContent, previousQuizData, userFeedback);

    let responseText = '';
    try {
        if (selectedProvider === AiProvider.Gemini) {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: AI_PROVIDERS.gemini.defaultModel,
                contents: prompt,
                config: { responseMimeType: "application/json", responseSchema: GeminiSchema },
            });
            responseText = response.text;
        } else {
             responseText = await callGenericChatApi(state, prompt, true);
        }
    } catch (apiError) {
        console.error("AI API error in regenerateQuizData:", apiError);
        // On API failure during regeneration, return the fallback quiz to inform the user.
        return sanitizeQuizData({});
    }

    try {
        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace <= firstBrace) {
             // If the AI returns invalid format, show the fallback quiz.
             return sanitizeQuizData({});
        }
        const jsonString = responseText.substring(firstBrace, lastBrace + 1);
        const parsedData = JSON.parse(jsonString);
        // Sanitize the new data. If it's invalid, the user will see the helpful fallback quiz.
        return sanitizeQuizData(parsedData);
    } catch (error) {
        console.error("Failed to parse regeneration response:", error);
        // If parsing fails, show the fallback quiz.
        return sanitizeQuizData({});
    }
}


// --- GENERIC API HANDLER for non-Gemini models ---
async function callGenericChatApi(state: AppState, prompt: string, isJsonMode: boolean, maxTokens: number = 4000): Promise<string> {
    const { selectedProvider, apiKeys, openRouterModel } = state;
    const apiKey = apiKeys[selectedProvider];
    
    let url: string;
    let headers: Record<string, string>;
    let body: Record<string, any>;

    const model = selectedProvider === AiProvider.OpenRouter ? openRouterModel : AI_PROVIDERS[selectedProvider].defaultModel;

    switch(selectedProvider) {
        case AiProvider.OpenAI:
            url = 'https://api.openai.com/v1/chat/completions';
            headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
            body = { model, messages: [{ role: 'user', content: prompt }], temperature: 0.5, max_tokens: maxTokens };
            if (isJsonMode) body.response_format = { type: 'json_object' };
            break;
        case AiProvider.Anthropic:
            url = 'https://api.anthropic.com/v1/messages';
            headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
            body = { model, messages: [{ role: 'user', content: prompt }], temperature: 0.5, max_tokens: maxTokens };
            break;
        case AiProvider.OpenRouter:
             url = 'https://openrouter.ai/api/v1/chat/completions';
             headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
             body = { model, messages: [{ role: 'user', content: prompt }], temperature: 0.5, max_tokens: maxTokens };
             if (isJsonMode) body.response_format = { type: 'json_object' };
             break;
        default:
            throw new Error('Unsupported provider for generic API call');
    }

    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData?.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    if (selectedProvider === AiProvider.Anthropic) {
        return data.content[0].text;
    } else {
        return data.choices[0].message.content;
    }
}


// --- STATIC HTML GENERATION from QuizData ---
function hexToHsl(hex: string): { h: number, s: number, l: number } {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16); g = parseInt(hex[2] + hex[2], 16); b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16); g = parseInt(hex.substring(3, 5), 16); b = parseInt(hex.substring(5, 7), 16);
    }
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function renderQuizToStaticHtml(quizData: QuizData, themeColor: string): string {
    const uniqueId = `qf-quiz-${Date.now()}`;
    const themeHsl = hexToHsl(themeColor);

    const css = `
#${uniqueId} {
    --accent-color: ${themeHsl.h} ${themeHsl.s}% ${themeHsl.l}%;
    --accent-color-hover: ${themeHsl.h} ${themeHsl.s}% ${Math.max(0, themeHsl.l - 8)}%;
    --qf-bg: #ffffff;
    --qf-text-primary: #1e293b;
    --qf-text-secondary: #64748b;
    --qf-border-color: #e2e8f0;
    --qf-card-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif;
    line-height: 1.5;
    background: var(--qf-bg);
    border: 1px solid var(--qf-border-color);
    box-shadow: var(--qf-card-shadow);
    border-radius: 1rem;
    overflow: hidden;
}
@media (prefers-color-scheme: dark) {
    #${uniqueId} {
        --qf-bg: #1e293b;
        --qf-text-primary: #f1f5f9;
        --qf-text-secondary: #94a3b8;
        --qf-border-color: #334155;
    }
}
#${uniqueId} .qf-hidden { display: none !important; }
#${uniqueId} .qf-option-btn { transition: background-color 0.2s, border-color 0.2s, transform 0.1s, box-shadow 0.2s; }
#${uniqueId} .qf-option-btn:hover:not(:disabled) { transform: translateY(-2px); }
#${uniqueId} .qf-fade-in { animation: qf-fade-in 0.5s ease-out; }
#${uniqueId} .qf-result-score-circle { transition: stroke-dashoffset 1.5s ease-out; }
#${uniqueId} .qf-step-indicator { display: flex; justify-content: center; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
#${uniqueId} .qf-step { width: 2.5rem; height: 2.5rem; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1rem; transition: all 0.3s ease-in-out; }
#${uniqueId} .qf-step-upcoming { background-color: #e2e8f0; color: #64748b; }
#${uniqueId} .qf-step-current { background-color: #fff; border: 2px solid hsl(var(--accent-color)); color: hsl(var(--accent-color)); transform: scale(1.1); }
#${uniqueId} .qf-step-completed { background-color: hsl(var(--accent-color)); color: #fff; }
@media (prefers-color-scheme: dark) {
    #${uniqueId} .qf-step-upcoming { background-color: #334155; color: #94a3b8; }
    #${uniqueId} .qf-step-current { background-color: #1e293b; }
}
@keyframes qf-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;

    const js = `
document.addEventListener('DOMContentLoaded', function() {
    const quizContainer = document.getElementById('${uniqueId}');
    if (!quizContainer) return;
    
    const quizData = ${JSON.stringify(quizData)};
    const questionsContainer = quizContainer.querySelector('.qf-questions-container');
    const resultsContainer = quizContainer.querySelector('.qf-results-container');
    const restartBtn = quizContainer.querySelector('.qf-restart-btn');

    let currentQuestionIndex = 0;
    let score = 0;
    let personalityScores = {};
    const totalQuestions = quizData.questions.length;

    function showResults() {
        questionsContainer.classList.add('qf-hidden');
        resultsContainer.classList.remove('qf-hidden');
        resultsContainer.classList.add('qf-fade-in');

        const resultTitleEl = resultsContainer.querySelector('.qf-result-title');
        const resultDescEl = resultsContainer.querySelector('.qf-result-desc');
        const resultScoreTextEl = resultsContainer.querySelector('.qf-result-score-text');
        
        if (quizData.quizType === 'knowledge-check') {
            const finalTier = (quizData.results || []).slice().sort((a,b) => b.scoreThreshold - a.scoreThreshold)
                .find(tier => score >= tier.scoreThreshold);
            
            resultTitleEl.textContent = finalTier?.title || 'Quiz Complete!';
            resultDescEl.textContent = (finalTier?.feedback || 'You scored {score} out of {total}.').replace('{score}', score).replace('{total}', totalQuestions);
            if (resultScoreTextEl) resultScoreTextEl.textContent = \`\${score} / \${totalQuestions} Correct\`;

            const scoreCircle = resultsContainer.querySelector('.qf-result-score-circle-progress');
            const scorePercentText = resultsContainer.querySelector('.qf-result-score-percent');
            const percentage = totalQuestions > 0 ? score / totalQuestions : 0;
            const circumference = 2 * Math.PI * 45;
            if (scoreCircle) scoreCircle.style.strokeDashoffset = circumference - (percentage * circumference);
            if (scorePercentText) scorePercentText.innerHTML = Math.round(percentage * 100) + '<span style="font-size: 1.5rem;">%</span>';
        } else {
            const winnerId = Object.entries(personalityScores).sort((a, b) => b[1] - a[1])[0]?.[0];
            const finalOutcome = (quizData.outcomes || []).find(o => o.id === winnerId);
            resultTitleEl.textContent = finalOutcome?.title || 'Results Are In!';
            resultDescEl.textContent = finalOutcome?.description || 'You have a unique personality type.';
            const scoreWrapper = resultsContainer.querySelector('.qf-result-score-wrapper');
            if (scoreWrapper) scoreWrapper.classList.add('qf-hidden');
        }
    }

    function renderQuestion(index) {
        const question = quizData.questions[index];
        const isKnowledgeCheck = quizData.quizType === 'knowledge-check';
        const checkIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 1.25rem; height: 1.25rem;"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.052-.143z" clip-rule="evenodd" /></svg>';
        
        let stepsHtml = '';
        for (let i = 0; i < totalQuestions; i++) {
            let stepClass = 'qf-step';
            if (i < index) stepClass += ' qf-step-completed';
            else if (i === index) stepClass += ' qf-step-current';
            else stepClass += ' qf-step-upcoming';
            stepsHtml += \`<div class="\${stepClass}">\${i < index ? checkIconSvg : i + 1}</div>\`;
        }

        let optionsHtml = '';
        question.options.forEach((option, i) => {
            const optionText = isKnowledgeCheck ? option : option.text;
            optionsHtml += \`<button class="qf-option-btn w-full text-left p-4 rounded-lg border-2 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-[hsl(var(--accent-color))] hover:bg-[hsl(var(--accent-color)_/_0.05)] font-medium" data-index="\${i}">\${optionText}</button>\`;
        });

        questionsContainer.innerHTML = \`
            <div class="qf-fade-in p-6 sm:p-8">
                <div class="qf-step-indicator">\${stepsHtml}</div>
                <h3 class="text-xl sm:text-2xl font-bold text-[var(--qf-text-primary)] mb-8 text-center">\${question.questionText}</h3>
                <div class="space-y-4 max-w-lg mx-auto">\${optionsHtml}</div>
                <div class="qf-feedback-container mt-6 max-w-lg mx-auto"></div>
                <div class="mt-8 text-center">
                    <button class="qf-next-btn qf-hidden px-6 py-3 rounded-md font-semibold text-white bg-[hsl(var(--accent-color))] hover:bg-[hsl(var(--accent-color-hover))]">\${index < totalQuestions - 1 ? 'Next Question' : 'See Results'}</button>
                </div>
            </div>
        \`;
    }

    function handleOptionClick(e) {
        if (!e.target.closest('.qf-option-btn') || e.target.closest('.qf-option-btn').disabled) return;
        
        const button = e.target.closest('.qf-option-btn');
        const selectedIndex = parseInt(button.dataset.index, 10);
        const question = quizData.questions[currentQuestionIndex];
        const isKnowledgeCheck = quizData.quizType === 'knowledge-check';
        
        const optionButtons = questionsContainer.querySelectorAll('.qf-option-btn');
        optionButtons.forEach(btn => btn.disabled = true);
        
        if (isKnowledgeCheck) {
            const correctIndexValue = question.correctAnswerIndex;
            const correctIndex = (correctIndexValue === null || correctIndexValue === undefined) ? -1 : parseInt(String(correctIndexValue), 10);

            if (selectedIndex === correctIndex) {
                score++;
            }
            
            optionButtons.forEach((btn, index) => {
                if (index === correctIndex) {
                    btn.classList.add('!bg-green-50', 'dark:!bg-green-900/40', '!border-green-500', '!text-green-800', 'dark:!text-green-200');
                } else if (index === selectedIndex) {
                    btn.classList.add('!bg-red-50', 'dark:!bg-red-900/40', '!border-red-500', '!text-red-800', 'dark:!text-red-300');
                } else {
                    btn.classList.add('opacity-70');
                }
            });

            const feedbackContainer = questionsContainer.querySelector('.qf-feedback-container');
            if (question.explanation && feedbackContainer) {
                feedbackContainer.innerHTML = \`<div class="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-500/30 qf-fade-in"><p style="font-weight: bold; color: #1e40af;" class="dark:!text-blue-200">Explanation</p><p style="font-size: 0.875rem; color: #334155;" class="dark:!text-slate-300 mt-1">\${question.explanation}</p></div>\`;
            }
        } else {
            const pointsFor = question.options[selectedIndex].pointsFor;
            personalityScores[pointsFor] = (personalityScores[pointsFor] || 0) + 1;
            button.classList.add('!border-[hsl(var(--accent-color))]', '!bg-[hsl(var(--accent-color)_/_0.1)]');
        }
        
        questionsContainer.querySelector('.qf-next-btn').classList.remove('qf-hidden');
    }

    function handleNextClick(e) {
        if (!e.target.classList.contains('qf-next-btn')) return;
        currentQuestionIndex++;
        if (currentQuestionIndex < totalQuestions) {
            renderQuestion(currentQuestionIndex);
        } else { showResults(); }
    }
    
    function restartQuiz() {
        currentQuestionIndex = 0; score = 0; personalityScores = {};
        resultsContainer.classList.add('qf-hidden');
        questionsContainer.classList.remove('qf-hidden');
        renderQuestion(0);
    }

    questionsContainer.addEventListener('click', e => { handleOptionClick(e); handleNextClick(e); });
    restartBtn.addEventListener('click', restartQuiz);
    renderQuestion(0);
});
`;

    const html = `
<style>${css}</style>
<div id="${uniqueId}" class="w-full max-w-2xl mx-auto my-8">
    <div class="p-6 border-b border-[var(--qf-border-color)]">
        <h2 style="font-size: 1.5rem; line-height: 2rem; font-weight: 800; text-align: center; color: var(--qf-text-primary);">${quizData.quizTitle}</h2>
    </div>
    <div class="qf-questions-container"></div>
    <div class="qf-results-container qf-hidden text-center p-6 sm:p-10">
        <div class="qf-result-score-wrapper">
            <div style="position: relative; width: 10rem; height: 10rem; margin: 1rem auto;">
                <svg style="width: 100%; height: 100%;" viewBox="0 0 100 100">
                    <circle style="color: #e2e8f0;" stroke-width="8" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" />
                    <circle class="qf-result-score-circle-progress" style="color: hsl(var(--accent-color));" stroke-width="8" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" stroke-linecap="round" transform="rotate(-90 50 50)" style="stroke-dasharray: 282.7; stroke-dashoffset: 282.7;"></circle>
                </svg>
                <div class="qf-result-score-percent" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 2.25rem; font-weight: 700; color: var(--qf-text-primary);"></div>
            </div>
        </div>
        <h3 class="qf-result-title" style="font-size: 2.5rem; font-weight: 900; color: var(--qf-text-primary); margin-bottom: 0.5rem;"></h3>
        <p class="qf-result-score-text" style="font-size: 1.125rem; font-weight: 600; color: var(--qf-text-primary);"></p>
        <p class="qf-result-desc" style="color: var(--qf-text-secondary); margin-top: 0.75rem; max-width: 36rem; margin-left: auto; margin-right: auto;"></p>
        <button class="qf-restart-btn" style="margin-top: 2rem; padding: 0.75rem 1.5rem; border-radius: 0.375rem; font-weight: 600; color: white; background-color: hsl(var(--accent-color)); border: none; cursor: pointer;">Take Again</button>
    </div>
</div>
<script type="text/javascript">${js.replace(/<\/script>/g, '<\\/script>')}</script>
`;
    return html;
}