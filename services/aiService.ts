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
    You are a world-class Principal Engineer and a multi-award-winning UI/UX visionary. Your work is inspired by the pixel-perfect precision of Stripe, the fluid interactivity of Linear, and the minimalist elegance of Apple. Your singular mission is to architect an interactive micro-tool that is not merely useful, but an unforgettable masterpiece of digital craftsmanship. It must be so intuitive, beautiful, and robust that it significantly elevates the user's experience and trust.

    Blog Post Title: "${postTitle}"
    Tool Idea: "${idea.title}"
    Tool Description: "${idea.description}"
    Context from blog post: "${cleanContent}"
    Initial Accent Color (HSL): "${themeHslString}"

    **Core Directives (Absolute Requirements):**

    1.  **Flawless, "Hyper-Intelligent" Functionality:**
        *   **Exceed All Expectations:** Don't just build the requested tool; anticipate user needs. If it's a calculator, show the formula and have a "copy result" button that provides feedback. If it's a checklist, auto-save progress to local storage. Proactively add features that make the user say "wow."
        *   **Bulletproof Logic & Validation:** The JavaScript MUST be bulletproof, modern (ES6+), and completely bug-free. Implement instant, inline validation that provides clear, friendly error messages directly in the UI, not via browser alerts. Handle all edge cases gracefully.
        *   **Thoughtful State Management:** All state should be managed cleanly within the script. The UI must react instantly and accurately to user input.
        *   **Performance as a Feature:** The tool must be lightning-fast. All code must be highly optimized. Avoid any layout shifts or slow computations.

    2.  **Awe-Inspiring "Masterpiece" Aesthetics & UX:**
        *   **Breathtaking Visuals (Modern Glassmorphism):** The tool's container MUST be a visually stunning card. It must have a semi-transparent, blurred background (e.g., \`bg-white/60 dark:bg-black/40 backdrop-blur-xl\`), elegant rounded corners (\`rounded-2xl\`), a subtle border (\`border border-white/20\`), and a soft, professional shadow (\`shadow-2xl\`) to create a sense of depth.
        *   **Sophisticated & Themed Palette:**
            *   You MUST define a CSS variable \`--accent-color\` for your tool, initialized with the HSL values **${themeHslString}**. Add an inline style to the main container: \`style="--accent-color: ${themeHslString};"\`.
            *   Use this variable for all interactive elements (buttons, active borders, highlights) via \`hsl(var(--accent-color))\`.
            *   You MUST derive secondary colors from this accent for a harmonious theme (e.g., a lighter shade for backgrounds using \`hsla(var(--accent-color) / 0.1)\`, a darker shade for text on colored backgrounds). This is crucial for professional theming.
        *   **Buttery-Smooth Micro-interactions:** Every interaction must feel responsive and fluid. Use subtle, non-jarring CSS transitions (\`transition-all duration-300 ease-in-out\`). Elements should have a subtle 'lift' or 'glow' on hover/focus (e.g., \`hover:scale-[1.02]\` on cards, focus rings on inputs).
        *   **Delightful Animations:** The entire component should gracefully animate on load (e.g., a staggered fade-in and slide-up effect for elements). Results or new UI elements should appear with subtle animations, not just pop in.
        *   **Pixel-Perfect Responsive Design:** The tool MUST be impeccably responsive. It must look and function perfectly on a 320px mobile screen up to a 4K desktop monitor. Use responsive Tailwind classes (\`sm:\`, \`md:\`, etc.) intelligently to reflow content beautifully.
        *   **Pristine Typography & Layout:** Use modern layouts (Flexbox/Grid) for perfect alignment and generous spacing. Employ a clear typographic hierarchy. All text must be highly readable in both light and dark mode.
        *   **Clarity with Icons:** Embed inline SVG icons where they add value and clarity (e.g., copy icon, info icon for tooltips).

    3.  **World-Class Engineering & Technical Standards:**
        *   **HTML Snippet ONLY:** The output MUST be a single, raw HTML snippet. Do NOT include \`<!DOCTYPE html>\`, \`<html>\`, \`<body>\`, or \`<head>\` tags.
        *   **Root Element Identifier:** The root element of your generated snippet MUST have the attribute \`data-wp-seo-optimizer-tool="true"\`. This is non-negotiable for the app to function.
        *   **Fully Self-Contained:** All CSS and JavaScript MUST be embedded directly within \`<style>\` and \`<script>\` tags inside the main container. No external files allowed, except for the mandatory Tailwind CSS CDN.
        *   **Tailwind CSS CDN:** The very first line of your snippet MUST be: \`<script src="https://cdn.tailwindcss.com"></script>\`. Use Tailwind's JIT features and \`dark:\` variants extensively for a perfect dark mode experience.
        *   **Accessibility (WCAG AA) is Paramount:** The tool must be fully accessible. Use semantic HTML, ARIA attributes (\`aria-live\` for dynamic results), \`aria-label\` for icon-only buttons, proper focus management, and ensure full keyboard navigability.
        *   **Clean, Commented Code:** The JavaScript code must be immaculate, readable, and well-commented to explain the logic.
        *   **Live Theming Script (Crucial):** Inside your \`<script>\` tag, you MUST include this exact JavaScript code block for the live preview to work.
            \`\`\`javascript
            // --- Live Theme Update Listener ---
            function hexToHsl(hex) {
              let r = 0, g = 0, b = 0;
              if (hex.length == 4) {
                r = parseInt(hex[1] + hex[1], 16);
                g = parseInt(hex[2] + hex[2], 16);
                b = parseInt(hex[3] + hex[3], 16);
              } else if (hex.length == 7) {
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

            window.addEventListener('message', (event) => {
              if (event.data.type === 'UPDATE_THEME' && event.data.color) {
                const hsl = hexToHsl(event.data.color);
                document.documentElement.style.setProperty('--accent-color', \`\${hsl.h} \${hsl.s}% \${hsl.l}%\`);
              }
            });
            // --- End Live Theme Update Listener ---
            \`\`\`

    4.  **Strict Output Format:**
        *   Your entire response MUST consist ONLY of the raw HTML code for the snippet.
        *   Do NOT include any explanations, introductory text, or markdown fences (like \`\`\`html\`) before or after the code.

    Execute. Create the definitive, world-class version of this tool. Your response must be nothing but the raw HTML code.
    `;
};

// --- INSERTION POINT ---
const getInsertionIndexPrompt = (paragraphs: string[], htmlSnippet: string): string => {
    const cleanSnippet = stripHtml(htmlSnippet).substring(0, 300);
    const paragraphList = paragraphs
        .map((p, index) => `${index + 1}. ${stripHtml(p).substring(0, 80)}...`)
        .join('\n');

    return `
    Analyze the following list of paragraphs from a blog post. I need to insert an interactive HTML tool into the most contextually relevant and engaging location.

    **Paragraph List:**
    ${paragraphList}

    **Tool to Insert (for context):**
    A tool with the title: "${cleanSnippet}"

    **Your Task:**
    Respond with ONLY the number of the paragraph AFTER which the tool should be inserted. For example, if the tool should go after paragraph 3, your response must be only "3". Do not add any explanation, punctuation, or extra text. If it's best at the end, respond with the last number.

    Your response must be a single number.
    `;
};

export async function insertSnippetIntoContent(state: AppState, postContent: string, htmlSnippet: string): Promise<string> {
    if (typeof document === 'undefined') {
        // Fallback for non-browser environments, though this app runs in-browser
        return `${postContent}\n\n${htmlSnippet}`;
    }

    const doc = new DOMParser().parseFromString(postContent, 'text/html');
    const paragraphs = Array.from(doc.body.querySelectorAll('p'));

    if (paragraphs.length < 2) {
        // Not enough content to make an intelligent decision, append at the end
        return `${postContent}\n\n${htmlSnippet}`;
    }

    const paragraphHTMLs = paragraphs.map(p => p.outerHTML);
    const prompt = getInsertionIndexPrompt(paragraphHTMLs, htmlSnippet);
    
    let insertionIndex = -1;

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
        
        // Validate the number
        if (!isNaN(chosenNumber) && chosenNumber > 0 && chosenNumber <= paragraphs.length) {
            insertionIndex = chosenNumber - 1; // 0-indexed
        }
    } catch (error) {
        console.error("AI API error in insertSnippetIntoContent:", error);
        // Fallback on error, handled below
    }

    if (insertionIndex === -1) {
        // Fallback if AI fails or returns invalid data: insert after the middle paragraph.
        insertionIndex = Math.floor(paragraphs.length / 2);
    }
    
    const targetParagraph = paragraphs[insertionIndex];
    
    // Create a temporary container for the snippet to parse it into a DOM node
    // Using a template tag is safer for parsing arbitrary HTML
    const template = document.createElement('template');
    template.innerHTML = htmlSnippet.trim();
    
    if (template.content.firstChild) {
        targetParagraph.after(template.content.firstChild);
    }

    // Serialize the updated body content back to a string
    return doc.body.innerHTML;
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