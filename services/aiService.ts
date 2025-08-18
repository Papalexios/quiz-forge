
import { GoogleGenAI, Type } from "@google/genai";
import { AppState, ToolIdea, AiProvider } from '../types';
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
        // A cheap call to list models to verify the key
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
                messages: [{ role: "user", content: "h" }] // minimal request
            })
        });
        // 401 is invalid auth, anything else might be a different issue but key is likely ok.
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


// --- IDEA GENERATION ---
const getIdeaPrompt = (postTitle: string, postContent: string): string => {
    const cleanContent = stripHtml(postContent).substring(0, 8000);
    return `
    Analyze the following blog post.
    Title: "${postTitle}"
    Content: "${cleanContent}"

    Your task is to suggest three distinct, state-of-the-art, interactive HTML tool ideas that would be highly valuable and engaging for the reader of this post. These tools must be directly related to the post's content and significantly enhance its utility. The tools should be practical and implementable with self-contained HTML, CSS, and JavaScript.

    For each idea:
    1.  Provide a short, catchy title.
    2.  Provide a one-sentence description of what the tool does. IMPORTANT: This description must be a single line of text and must not contain any newline characters.
    3.  Suggest a relevant icon name from this list: [calculator, chart, list, idea].

    Respond with ONLY a valid JSON object in the format: { "ideas": [{ "title": "...", "description": "...", "icon": "..." }] }
    Ensure the JSON is well-formed and contains no unescaped control characters within strings.
    `;
};


export async function suggestToolIdeas(state: AppState, postTitle: string, postContent: string): Promise<ToolIdea[]> {
    const { selectedProvider, apiKeys } = state;
    const apiKey = apiKeys[selectedProvider];
    const prompt = getIdeaPrompt(postTitle, postContent);
    let responseText = ''; // Used for error reporting

    try {
        if (selectedProvider === AiProvider.Gemini) {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: AI_PROVIDERS.gemini.defaultModel,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: { ideas: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, description: { type: Type.STRING }, icon: { type: Type.STRING } } } } }
                    },
                },
            });
            responseText = response.text;
        } else {
            responseText = await callGenericChatApi(state, prompt, true);
        }

        // Clean the response to ensure it's valid JSON, stripping markdown fences or other text.
        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');

        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
             throw new Error("AI response did not contain a valid JSON object.");
        }
        
        let jsonString = responseText.substring(firstBrace, lastBrace + 1);

        // Sanitize the string to remove control characters like newlines which can break JSON.parse.
        jsonString = jsonString.replace(/[\r\n\t]/g, ' ');

        const result = JSON.parse(jsonString);
        
        // Robustly find the array of ideas, regardless of the key name (e.g., "ideas", " ", "tools").
        const ideasArray = Object.values(result).find(value => Array.isArray(value)) as any[];

        if (ideasArray) {
            // Filter to ensure the items in the array match the ToolIdea structure.
            const validIdeas = ideasArray.filter(item =>
                typeof item === 'object' && item !== null &&
                'title' in item && 'description' in item && 'icon' in item
            );

            if (validIdeas.length > 0) {
                return validIdeas.slice(0, 3);
            }
        }
        
        throw new Error("AI did not return valid tool ideas in the expected format.");
    } catch (error) {
        console.error("AI API error in suggestToolIdeas:", error);
         if (error instanceof SyntaxError) {
             throw new Error(`Failed to parse AI response as JSON. The model may have returned an invalid format. Response snippet: ${responseText.substring(0, 150)}...`);
        }
        throw new Error(`Failed to get suggestions from ${AI_PROVIDERS[selectedProvider].name}. Check the console for details.`);
    }
}

// --- NEW UTILITY FUNCTION for HTML Generation ---
function hexToHsl(hex: string): { h: number, s: number, l: number } {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex[1] + hex[2], 16);
        g = parseInt(hex[3] + hex[4], 16);
        b = parseInt(hex[5] + hex[6], 16);
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


// --- HTML GENERATION ---
const getHtmlGenerationPrompt = (postTitle: string, postContent: string, idea: ToolIdea, themeColor: string): string => {
    const cleanContent = stripHtml(postContent).substring(0, 4000);
    const themeHsl = hexToHsl(themeColor);
    const themeHslString = `${themeHsl.h} ${themeHsl.s}% ${themeHsl.l}%`;
    
    return `
    **Persona:** You are a world-class senior front-end engineer and UI/UX designer from a top-tier digital agency. Your work is known for being modern, beautiful, highly interactive, and featured on sites like Awwwards. You are an expert in creating premium, self-contained web components using Tailwind CSS.

    **Mission:** Generate a single, complete, self-contained HTML snippet for an interactive tool. This snippet will be injected directly into a Shadow DOM. The final output must be **ONLY the raw HTML code** and nothing else.

    **Tool Request:**
    *   **Blog Post Title:** "${postTitle}"
    *   **Tool Idea:** "${idea.title}"
    *   **Description:** "${idea.description}"
    *   **Content Context:** "${cleanContent}"
    *   **Primary Accent Color (HSL):** ${themeHslString}

    **Design & UX Principles (Follow these strictly):**
    1.  **Aesthetic:** Modern, premium, and clean. Use generous spacing, soft shadows (e.g., \`shadow-lg\`, \`shadow-xl\`), rounded corners (\`rounded-xl\`, \`rounded-2xl\`), and subtle gradients where appropriate. The UI should feel polished and high-quality.
    2.  **Interactivity:** The tool must be highly interactive and provide immediate feedback. Use subtle transitions and animations (\`transition-all\`, \`duration-300\`) on hover/focus states to make the UI feel alive.
    3.  **Typography:** Use a clean, readable font stack. Ensure clear visual hierarchy with varying font sizes and weights (e.g., \`text-lg\`, \`font-bold\`, \`text-slate-500\`).
    4.  **Dark Mode:** Dark mode is a first-class citizen. Every element MUST be perfectly styled for both light and dark modes using Tailwind's \`dark:\` variants. The dark theme should be sleek and elegant.
    5.  **Responsiveness:** The layout must be fully responsive and look excellent on all screen sizes, from mobile to desktop.
    6.  **Accessibility:** Adhere to WCAG AA standards. Use semantic HTML, ARIA attributes where necessary, and ensure all interactive elements are keyboard-navigable and have clear focus states (e.g., \`focus:ring-2\`).

    **Technical Implementation Mandates:**

    1.  **NO WRAPPERS:** Your response MUST be the raw HTML snippet itself. Do NOT include \`\`\`html\`, \`<html>\`, \`<head>\`, or \`<body>\`.
    
    2.  **SCRIPT & STYLE ORDER:** The very first elements in your response, in this exact order, must be:
        *   A. The Tailwind CSS script: \`<script src="https://cdn.tailwindcss.com"></script>\`
        *   B. A single \`<style>\` block.

    3.  **STYLE BLOCK CONTENT:** The \`<style>\` block MUST contain:
        *   A \`:host\` rule to ensure proper block layout: \`:host { display: block; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; }\`
        *   CSS variables for theming. Define them inside the main container class (\`.tool-container\`). The primary accent color MUST be defined as \`--accent-color: ${themeHslString};\`. You may define other variables if needed (e.g., for background colors).
        *   Use the accent color variable like this in Tailwind classes: \`bg-[hsl(var(--accent-color))]\`, \`text-[hsl(var(--accent-color))]\`, \`ring-[hsl(var(--accent-color))]\`.

    4.  **HTML STRUCTURE:**
        *   The root element of your tool must have the class \`tool-container\` and should be a \`div\` or \`section\`.
        *   The entire tool must be contained within this single snippet.

    5.  **JAVASCRIPT:**
        *   All necessary JavaScript MUST be contained within a single \`<script>\` tag placed at the very end of the HTML snippet.
        *   The script should be modern, efficient, well-commented, and bug-free.
        *   Add event listeners inside the script; do not use inline \`onclick\` attributes.

    Now, generate the complete, premium HTML snippet for the "${idea.title}" tool.
    `;
};

// --- INSERTION POINT ---
const getInsertionIndexPrompt = (contentBlocks: string[], htmlSnippet: string): string => {
    const cleanSnippet = stripHtml(htmlSnippet).substring(0, 300);
    const blockList = contentBlocks
        .map((block, index) => `${index + 1}. ${block}`)
        .join('\n');

    return `
    You are an expert UX designer and content strategist. Your task is to find the perfect placement for an interactive HTML tool within a blog post to maximize user engagement and contextual relevance.

    Below is a simplified structure of the blog post, represented by a numbered list of its main content blocks (paragraphs, headings, lists, etc.).

    **Blog Post Structure:**
    ${blockList}

    **Tool to Insert:**
    An interactive tool related to: "${cleanSnippet}"

    **Your Goal:**
    Analyze the flow and content of the blog post structure. Determine the single best location to insert the tool. A perfect location is one that is:
    1.  **Contextually Relevant:** The tool should appear right after the content it relates to is discussed.
    2.  **Engaging, Not Disruptive:** It should feel like a natural part of the content, not an interruption. Placing it after a section introduction or summary is often effective.
    3.  **Visually Balanced:** Avoid placing it between a heading and its first paragraph, or in the middle of a very short list. Placing it between two substantial paragraphs is a safe and effective choice.

    **Your Response:**
    You must respond with ONLY the number of the content block AFTER which the tool should be inserted. For example, if the best spot is after block number 3, your response must be only "3". Do not add any explanation, punctuation, or extra text. If the very end of the post is the most logical place, respond with the last number (${contentBlocks.length}).

    Your response must be a single integer.
    `;
};

export async function insertSnippetIntoContent(state: AppState, postContent: string, htmlSnippet: string): Promise<string> {
    const doc = new DOMParser().parseFromString(postContent, 'text/html');
    const contentBlocks = Array.from(doc.body.querySelectorAll('p, h2, h3, h4, ul, ol, blockquote'));

    let insertionIndex;
    if (contentBlocks.length < 2) {
        insertionIndex = contentBlocks.length - 1; // Append at the end if post is short
    } else {
        const blockRepresentations = contentBlocks.map(el => {
            const tagName = el.tagName.toLowerCase();
            const text = stripHtml(el.outerHTML).substring(0, 250);
            return `[${tagName}] ${text}...`;
        });

        const prompt = getInsertionIndexPrompt(blockRepresentations, htmlSnippet);
        insertionIndex = -1;

        try {
            let responseText: string;
            if (state.selectedProvider === AiProvider.Gemini) {
                const ai = new GoogleGenAI({ apiKey: state.apiKeys.gemini });
                const response = await ai.models.generateContent({
                    model: AI_PROVIDERS.gemini.defaultModel,
                    contents: prompt,
                });
                responseText = response.text.trim();
            } else {
                responseText = await callGenericChatApi(state, prompt, false);
            }

            const chosenNumber = parseInt(responseText.replace(/\D/g, ''), 10);
            if (!isNaN(chosenNumber) && chosenNumber > 0 && chosenNumber <= contentBlocks.length) {
                insertionIndex = chosenNumber - 1; // 0-indexed
            }
        } catch (error) {
            console.error("AI API error in insertSnippetIntoContent:", error);
        }

        if (insertionIndex === -1) {
            insertionIndex = Math.floor(contentBlocks.length / 2); // Default fallback
        }
    }
    
    const finalSnippet = createWebComponentWrapper(htmlSnippet);
    const template = document.createElement('template');
    template.innerHTML = finalSnippet.trim();
    
    if (template.content.firstChild) {
         if (insertionIndex >= 0 && contentBlocks[insertionIndex]) {
            contentBlocks[insertionIndex].after(template.content);
        } else {
            // If no suitable insertion point, append to the body
            doc.body.appendChild(template.content);
        }
    }

    return doc.body.innerHTML;
}


function createWebComponentWrapper(shadowDomHtml: string): string {
    const uniqueId = `tool-embed-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    // Escape backticks and backslashes for JS template literal
    const escapedHtml = shadowDomHtml.replace(/\\/g, '\\\\').replace(/`/g, '\\`');

    const script = `
        <script>
            (function() {
                if (customElements.get('${uniqueId}')) return;
                const template = document.createElement('template');
                template.innerHTML = \`${escapedHtml}\`;
                customElements.define('${uniqueId}', class extends HTMLElement {
                    constructor() {
                        super();
                        this.attachShadow({ mode: 'open' });
                        this.shadowRoot.appendChild(template.content.cloneNode(true));
                    }
                });
            })();
        </script>
    `;

    return `
        <div data-wp-seo-optimizer-tool="true" style="margin: 2.5em 0; clear: both;">
            <${uniqueId}></${uniqueId}>
            ${script}
        </div>
    `;
}

// --- GENERIC API HANDLER for OpenAI, Anthropic, OpenRouter ---
async function callGenericChatApi(state: AppState, prompt: string, isJsonMode: boolean): Promise<string> {
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
            body = { model, messages: [{ role: 'user', content: prompt }], temperature: 0.5, max_tokens: 4000 };
            if (isJsonMode) body.response_format = { type: 'json_object' };
            break;
        case AiProvider.Anthropic:
            url = 'https://api.anthropic.com/v1/messages';
            headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
            body = { model, messages: [{ role: 'user', content: prompt }], temperature: 0.5, max_tokens: 4000 };
            break;
        case AiProvider.OpenRouter:
             url = 'https://openrouter.ai/api/v1/chat/completions';
             headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
             body = { model, messages: [{ role: 'user', content: prompt }], temperature: 0.5 };
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

// --- STREAMING IMPLEMENTATIONS ---

async function* streamSse(stream: ReadableStream<Uint8Array>, provider: 'openai' | 'anthropic' | 'openrouter'): AsyncGenerator<string> {
    const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            break;
        }

        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last, possibly incomplete line

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.substring(6);
                if (data.trim() === '[DONE]') {
                    return;
                }
                try {
                    const parsed = JSON.parse(data);
                    let chunk = '';
                    if (provider === 'anthropic') {
                        if (parsed.type === 'content_block_delta') {
                            chunk = parsed.delta.text;
                        }
                    } else { // OpenAI and OpenRouter
                        chunk = parsed.choices[0]?.delta?.content || '';
                    }
                    if (chunk) {
                        yield chunk;
                    }
                } catch (e) {
                    // Ignore parsing errors for non-json lines
                }
            }
        }
    }
}


export async function* generateHtmlSnippetStream(state: AppState, postTitle: string, postContent: string, idea: ToolIdea, themeColor: string): AsyncGenerator<string> {
    const { selectedProvider, apiKeys, openRouterModel } = state;
    const apiKey = apiKeys[selectedProvider];
    const prompt = getHtmlGenerationPrompt(postTitle, postContent, idea, themeColor);

    try {
        if (selectedProvider === AiProvider.Gemini) {
            const ai = new GoogleGenAI({ apiKey });
            const stream = await ai.models.generateContentStream({
                model: AI_PROVIDERS.gemini.defaultModel,
                contents: prompt,
            });
            for await (const chunk of stream) {
                yield chunk.text;
            }
        } else {
            let url: string;
            let headers: Record<string, string>;
            let body: Record<string, any>;

            const model = selectedProvider === AiProvider.OpenRouter ? openRouterModel : AI_PROVIDERS[selectedProvider].defaultModel;

            switch (selectedProvider) {
                case AiProvider.OpenAI:
                    url = 'https://api.openai.com/v1/chat/completions';
                    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
                    body = { model, messages: [{ role: 'user', content: prompt }], temperature: 0.5, max_tokens: 4000, stream: true };
                    break;
                case AiProvider.Anthropic:
                    url = 'https://api.anthropic.com/v1/messages';
                    headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
                    body = { model, messages: [{ role: 'user', content: prompt }], temperature: 0.5, max_tokens: 4000, stream: true };
                    break;
                case AiProvider.OpenRouter:
                    url = 'https://openrouter.ai/api/v1/chat/completions';
                    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
                    body = { model, messages: [{ role: 'user', content: prompt }], temperature: 0.5, stream: true };
                    break;
                default:
                    throw new Error('Unsupported provider for streaming');
            }

            const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
            if (!response.ok || !response.body) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData?.error?.message || 'Unknown error'}`);
            }
            
            yield* streamSse(response.body, selectedProvider);
        }
    } catch (error) {
        console.error("AI API error in generateHtmlSnippetStream:", error);
        throw new Error(`Failed to generate HTML from ${AI_PROVIDERS[selectedProvider].name}.`);
    }
}
