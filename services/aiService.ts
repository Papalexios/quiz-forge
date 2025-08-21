import { GoogleGenAI, Type } from "@google/genai";
import { AppState, AiProvider, QuizDifficulty, QuizData } from '../types';
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
                'anthropic-version': '2023-06-01',
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


const GeminiSchema = {
    type: Type.OBJECT,
    properties: {
        quizTitle: { type: Type.STRING, description: "A compelling, short title for the quiz." },
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
            description: "For 'knowledge-check' quizzes only. An array of result tiers based on score.",
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
    **Persona:** You are a PhD-level curriculum designer and viral engagement strategist. Your work is synonymous with elite, premium quality. You are meticulous, fact-check every detail, and your primary goal is to create an educational tool that is profoundly valuable, accurate, and engaging for the end-user. Mediocrity is not in your vocabulary.

    **Mission:**
    1.  **Deep Analysis:** Perform a deep, comprehensive analysis of the provided blog post title and content. Identify the most critical concepts, nuanced arguments, and key factual takeaways that a reader should remember.
    2.  **Determine Optimal Quiz Type:** Based on your expert analysis, decide if a 'knowledge-check' quiz (for factual, educational, or technical content) or a 'personality' quiz (for guides, listicles, or conceptual/typology content) will provide the most value and engagement.
    3.  **Craft a Masterpiece Quiz:** Generate all necessary data for the chosen quiz type with unparalleled quality.
        - The quiz must be 100% accurate and fact-checked against the provided content.
        - For 'knowledge-check', questions must challenge the user to apply knowledge, not just recall facts. Explanations must be insightful, clear, and provide additional value beyond the original text. They should feel like a mini-lesson from an expert.
        - For 'personality', outcomes must be psychologically sound (within the context of the article), insightful, and avoid generic platitudes. Descriptions should be well-written, relatable, and empower the user.
    4.  **Adhere to Difficulty:** Ensure the questions and options perfectly match the requested difficulty level: '${difficulty}'. 'Challenging' means requiring synthesis of information or understanding of complex, nuanced concepts. 'Easy' means focusing on the most critical, foundational ideas.
    5.  **Perfect JSON Output:** Format your entire response as a single, perfectly-formed JSON object, adhering strictly to the provided schema. No extra text, no apologies, no markdown. Just the JSON.

    **Analysis Material:**
    *   **Post Title:** "${postTitle}"
    *   **Post Content Snippet (first 8000 characters):** "${cleanContent}"

    Your entire response MUST be only the JSON object.
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

        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace <= firstBrace) {
             throw new Error("AI response did not contain a valid JSON object.");
        }
        const jsonString = responseText.substring(firstBrace, lastBrace + 1);
        return JSON.parse(jsonString) as QuizData;

    } catch (error) {
        console.error("AI API error in generateQuizData:", error);
        if (error instanceof SyntaxError) {
             throw new Error(`Failed to parse AI response as JSON. Response snippet: ${responseText.substring(0, 150)}...`);
        }
        throw new Error(`Failed to get quiz data from ${AI_PROVIDERS[selectedProvider].name}. Check console for details.`);
    }
}

const getQuizRegenerationPrompt = (postTitle: string, postContent: string, previousQuizData: QuizData, userFeedback: string): string => {
    const cleanContent = stripHtml(postContent).substring(0, 8000);
    return `
    **Persona:** You are a PhD-level curriculum designer and viral engagement strategist, now acting as a senior editor refining a draft. Your commitment to elite quality is unwavering.

    **Mission:**
    1.  **Review Previous Version:** You have already generated the quiz JSON provided below.
    2.  **Internalize Feedback:** The user has provided specific creative direction. You must deeply understand the user's intent and intelligently revise the quiz content to perfectly align with this feedback, elevating it to a new level of quality.
    3.  **Maintain Structural Integrity:** The quiz type and overall structure should remain the same unless the feedback explicitly requests a fundamental change. Your focus is on a surgical, high-impact revision of the content (questions, options, explanations, outcomes).
    4.  **Perfect JSON Output:** Format your entire revised response as a single, perfectly-formed JSON object, adhering strictly to the original schema. No extra text, no comments, no markdown.

    **Original Blog Post Context:**
    *   **Post Title:** "${postTitle}"
    *   **Post Content Snippet (first 8000 characters):** "${cleanContent}"

    **Previous Quiz JSON (The Draft):**
    \`\`\`json
    ${JSON.stringify(previousQuizData, null, 2)}
    \`\`\`

    **User's Creative Direction (The Mandate):**
    "${userFeedback}"

    Your entire response MUST be only the revised JSON object.
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

        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace <= firstBrace) {
             throw new Error("AI response did not contain a valid JSON object for regeneration.");
        }
        const jsonString = responseText.substring(firstBrace, lastBrace + 1);
        return JSON.parse(jsonString) as QuizData;

    } catch (error) {
        console.error("AI API error in regenerateQuizData:", error);
        if (error instanceof SyntaxError) {
             throw new Error(`Failed to parse AI response as JSON. Response snippet: ${responseText.substring(0, 150)}...`);
        }
        throw new Error(`Failed to get quiz data from ${AI_PROVIDERS[selectedProvider].name}. Check console for details.`);
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
    --accent-color-light: ${themeHsl.h} ${themeHsl.s}% ${Math.min(100, themeHsl.l + 30)}%;
    --qf-bg: #ffffff;
    --qf-bg-alt: #f8fafc;
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
        --qf-bg-alt: #0f172a;
        --qf-text-primary: #f1f5f9;
        --qf-text-secondary: #94a3b8;
        --qf-border-color: #334155;
    }
}
#${uniqueId} .qf-hidden { display: none !important; }
#${uniqueId} .qf-option-btn { transition: background-color 0.2s, border-color 0.2s, transform 0.1s, box-shadow 0.2s; }
#${uniqueId} .qf-option-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: var(--qf-card-shadow); }
#${uniqueId} .qf-fade-in { animation: qf-fade-in 0.5s ease-out; }
#${uniqueId} .qf-progress-bar { transition: width 0.5s ease-in-out; }
#${uniqueId} .qf-result-score-circle { transition: stroke-dashoffset 1s ease-out; }
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

    function showResults() {
        questionsContainer.classList.add('qf-hidden');
        resultsContainer.classList.remove('qf-hidden');
        resultsContainer.classList.add('qf-fade-in');

        const resultTitleEl = resultsContainer.querySelector('.qf-result-title');
        const resultDescEl = resultsContainer.querySelector('.qf-result-desc');
        
        if (quizData.quizType === 'knowledge-check') {
            const finalTier = quizData.results.slice().sort((a,b) => b.scoreThreshold - a.scoreThreshold)
                .find(tier => score >= tier.scoreThreshold);
            
            resultTitleEl.textContent = finalTier?.title || 'Quiz Complete!';
            resultDescEl.textContent = finalTier?.feedback.replace('{score}', score).replace('{total}', quizData.questions.length) 
                || \`You scored \${score} out of \${quizData.questions.length}.\`;

            const scoreCircle = resultsContainer.querySelector('.qf-result-score-circle-progress');
            const scoreText = resultsContainer.querySelector('.qf-result-score-text');
            const percentage = quizData.questions.length > 0 ? score / quizData.questions.length : 0;
            const circumference = 2 * Math.PI * 45;
            scoreCircle.style.strokeDashoffset = circumference - (percentage * circumference);
            scoreText.textContent = Math.round(percentage * 100) + '%';
        } else {
            const winnerId = Object.entries(personalityScores).sort((a, b) => b[1] - a[1])[0]?.[0];
            const finalOutcome = quizData.outcomes.find(o => o.id === winnerId);
            resultTitleEl.textContent = finalOutcome?.title || 'Results Are In!';
            resultDescEl.textContent = finalOutcome?.description || 'You have a unique personality type.';
            resultsContainer.querySelector('.qf-result-score-wrapper').classList.add('qf-hidden');
        }
    }

    function renderQuestion(index) {
        const question = quizData.questions[index];
        const isKnowledgeCheck = quizData.quizType === 'knowledge-check';
        const progressPercentage = quizData.questions.length > 0 ? ((index + 1) / quizData.questions.length) * 100 : 0;
        
        let optionsHtml = '';
        question.options.forEach((option, i) => {
            const optionText = isKnowledgeCheck ? option : option.text;
            optionsHtml += \`<button class="qf-option-btn w-full text-left p-4 rounded-lg border-2 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:border-[hsl(var(--accent-color))] hover:bg-[hsl(var(--accent-color)_/_0.05)] font-medium" data-index="\${i}">\${optionText}</button>\`;
        });

        questionsContainer.innerHTML = \`
            <div class="qf-fade-in">
                <div class="w-full bg-slate-200 dark:bg-slate-700/50 rounded-full h-2.5">
                    <div class="qf-progress-bar bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full" style="width: \${(index / quizData.questions.length) * 100}%"></div>
                </div>
                <div class="text-sm text-slate-500 dark:text-slate-400 my-4 text-center">Question \${index + 1} of \${quizData.questions.length}</div>
                <h3 class="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6 text-center">\${question.questionText}</h3>
                <div class="space-y-3">\${optionsHtml}</div>
                <div class="qf-feedback-container mt-4"></div>
                <div class="mt-6 text-right">
                    <button class="qf-next-btn qf-hidden px-5 py-2.5 rounded-md font-semibold text-white bg-[hsl(var(--accent-color))] hover:bg-[hsl(var(--accent-color-hover))]">\${index < quizData.questions.length - 1 ? 'Next Question' : 'See Results'}</button>
                </div>
            </div>
        \`;
         setTimeout(() => {
            const bar = questionsContainer.querySelector('.qf-progress-bar');
            if(bar) bar.style.width = progressPercentage + '%';
        }, 100);
    }

    function handleOptionClick(e) {
        if (!e.target.closest('.qf-option-btn')) return;
        const button = e.target.closest('.qf-option-btn');
        const selectedIndex = parseInt(button.dataset.index, 10);
        const question = quizData.questions[currentQuestionIndex];
        const isKnowledgeCheck = quizData.quizType === 'knowledge-check';
        
        const optionButtons = questionsContainer.querySelectorAll('.qf-option-btn');
        optionButtons.forEach(btn => btn.disabled = true);
        
        if (isKnowledgeCheck) {
            const typedQuestion = question;
            if (selectedIndex === typedQuestion.correctAnswerIndex) {
                score++;
                button.classList.add('!bg-green-100', 'dark:!bg-green-900/50', '!border-green-500', '!text-green-800', 'dark:!text-green-200');
            } else {
                button.classList.add('!bg-red-100', 'dark:!bg-red-900/50', '!border-red-500', '!text-red-800', 'dark:!text-red-300');
                optionButtons[typedQuestion.correctAnswerIndex]?.classList.add('!bg-green-100', 'dark:!bg-green-900/50', '!border-green-500', '!text-green-800', 'dark:!text-green-200');
            }
            const feedbackContainer = questionsContainer.querySelector('.qf-feedback-container');
            if (typedQuestion.explanation && feedbackContainer) {
                feedbackContainer.innerHTML = \`<div class="p-4 bg-slate-100 dark:bg-slate-900/50 rounded-md qf-fade-in"><p class="font-bold text-slate-800 dark:text-slate-200">Explanation</p><p class="text-sm text-slate-600 dark:text-slate-300 mt-1">\${typedQuestion.explanation}</p></div>\`;
            }
        } else {
            const typedQuestion = question;
            const pointsFor = typedQuestion.options[selectedIndex].pointsFor;
            personalityScores[pointsFor] = (personalityScores[pointsFor] || 0) + 1;
            button.classList.add('!border-[hsl(var(--accent-color))]', '!bg-[hsl(var(--accent-color)_/_0.1)]', 'ring-2', 'ring-[hsl(var(--accent-color))]');
        }
        
        questionsContainer.querySelector('.qf-next-btn').classList.remove('qf-hidden');
    }

    function handleNextClick(e) {
        if (!e.target.classList.contains('qf-next-btn')) return;
        currentQuestionIndex++;
        if (currentQuestionIndex < quizData.questions.length) {
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
<script src="https://cdn.tailwindcss.com"></script>
<style>${css}</style>
<div id="${uniqueId}" class="w-full max-w-2xl mx-auto my-8">
    <div class="p-6">
        <h2 class="text-2xl font-extrabold text-center text-slate-900 dark:text-slate-100">${quizData.quizTitle}</h2>
    </div>
    <div class="qf-questions-container p-6 pt-0"></div>
    <div class="qf-results-container qf-hidden text-center p-6">
        <div class="qf-result-score-wrapper relative w-32 h-32 mx-auto mb-4">
            <svg class="w-full h-full" viewBox="0 0 100 100">
                <circle class="text-slate-200 dark:text-slate-700" stroke-width="8" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" />
                <circle class="qf-result-score-circle-progress text-[hsl(var(--accent-color))]" stroke-width="8" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" stroke-linecap="round" transform="rotate(-90 50 50)" style="stroke-dasharray: 282.7; stroke-dashoffset: 282.7;"></circle>
            </svg>
            <div class="qf-result-score-text absolute inset-0 flex items-center justify-center text-3xl font-bold text-slate-800 dark:text-slate-100"></div>
        </div>
        <h3 class="qf-result-title text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2"></h3>
        <p class="qf-result-desc text-slate-600 dark:text-slate-300 mb-6"></p>
        <button class="qf-restart-btn px-6 py-3 rounded-md font-semibold text-white bg-[hsl(var(--accent-color))] hover:bg-[hsl(var(--accent-color-hover))]">Restart Quiz</button>
    </div>
</div>
<script type="text/javascript">${js}</script>
`;
    return html;
}