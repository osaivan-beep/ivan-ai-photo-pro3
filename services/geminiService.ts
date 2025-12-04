
import { GoogleGenAI, Modality, type GenerateContentResponse } from '@google/genai';
import type { GeminiImagePart, ImageResolution } from '../types';

// Dynamic retrieval function
export const getActiveKey = (): string => {
    // Business Mode: Use the system configured (Paid) API Key exclusively.
    // This ensures stability for all users.
    // CRITICAL SECURITY NOTE: You MUST set "Website Restrictions" in Google Cloud Console
    // to allow only 'https://osaivan-beep.github.io/*' to use this key.
    const systemKey = process.env.API_KEY;
    
    if (!systemKey) {
        console.error("System API Key is missing! Check your .env file or GitHub Secrets.");
        return "";
    }
    
    return systemKey;
};

// Deprecated functions kept as no-ops to prevent build errors in other files referencing them
export const setStoredKey = (key: string) => {};
export const removeStoredKey = () => {};

const handleGeminiError = (error: unknown, context: string): never => {
  console.error(`Error calling ${context}:`, error);
  if (error instanceof Error) {
    const msg = error.message;
    
    // 偵測額度不足 (429)
    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
      throw new Error('系統忙碌中 (目前使用人數眾多)。\n請等待 30-60 秒後點擊「重試」。');
    }
    
    // 偵測權限錯誤 (403) - 通常是 Domain 限制導致，或是 Key 無效
    if (msg.includes('PERMISSION_DENIED') || msg.includes('403') || msg.includes('API_KEY_INVALID')) {
        throw new Error('API 金鑰權限錯誤。請確認 Google Cloud Console 的網域限制設定。');
    }
    
    // 一般錯誤
    throw new Error(`${context} Error: ${msg}`);
  }
  throw new Error(`An unknown error occurred while communicating with the ${context}.`);
};

export const generateImageWithGemini = async (
  prompt: string,
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | null,
  resolution: ImageResolution = '2K' // Add resolution support
): Promise<{ imageUrl: string }> => {
  
  const apiKey = getActiveKey();
  if (!apiKey) throw new Error("System API Key Missing. Please check configuration.");

  const ai = new GoogleGenAI({ apiKey });
  
  const extractImage = (response: any) => {
      let resultImageUrl = '';
      if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
          for (const part of response.candidates[0].content.parts) {
              if (part.inlineData) {
                  resultImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                  break; 
              }
          }
      }
      return resultImageUrl;
  };

  try {
    // Using Gemini 3 Pro Image Preview
    const config: any = {
        imageConfig: {
            // Map '1K', '2K', '4K' directly. Default to '1K' if unspecified.
            imageSize: resolution || '1K' 
        }
    };
    
    if (aspectRatio) {
        config.imageConfig.aspectRatio = aspectRatio;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ text: prompt }] },
      config: config,
    });

    const img = extractImage(response);
    if (!img) throw new Error('No image generated.');
    return { imageUrl: img };

  } catch (error: any) {
     handleGeminiError(error, "Gemini 3 Pro Image API");
  }
};

export const editImageWithGemini = async (
  images: GeminiImagePart[],
  prompt: string
): Promise<{ response: GenerateContentResponse }> => {
  const apiKey = getActiveKey();
  if (!apiKey) throw new Error("System API Key Missing.");

  const ai = new GoogleGenAI({ apiKey });

  const imageParts = images.map(image => ({
      inlineData: { data: image.base64Data, mimeType: image.mimeType },
  }));
  const textPart = { text: prompt };
  const allParts = [...imageParts, textPart];

  try {
    // Gemini 3 Pro also handles editing
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview', 
      contents: { parts: allParts },
      // Note: Image editing might have limitations on resolution depending on the preview version
      config: {
          imageConfig: {
              imageSize: '1K' // Default to 1K for editing to ensure speed/stability unless requested otherwise
          }
      }
    });
    return { response };

  } catch (error: any) {
      handleGeminiError(error, "Gemini 3 Pro API");
  }
};

export const refinePrompt = async (
    prompt: string, 
    image: GeminiImagePart | null = null, 
    language: string = 'en'
): Promise<string> => {
  const apiKey = getActiveKey();
  if (!apiKey) return prompt;

  const ai = new GoogleGenAI({ apiKey });
  try {
    let systemInstruction = "";
    if (image) {
         systemInstruction = "You are an expert prompt engineer for AI image editing. I will provide you with an image and a user request. Your task is to analyze the image's subject, style, and composition, and then write a detailed, descriptive prompt that incorporates the user's request into the scene naturally. The output should be a single paragraph description of the final desired image. Output ONLY the refined prompt text.";
    } else {
         systemInstruction = "You are an expert prompt engineer for AI image generation. Rewrite the user's prompt to be more descriptive, detailed, and effective for an AI image generator. Keep the core intent but enhance the artistic style and lighting descriptions. Output ONLY the refined prompt text without any explanations.";
    }
    if (language === 'zh') {
        systemInstruction += " Please output the result in Traditional Chinese (繁體中文).";
    }

    const contents = [];
    if (image) {
        contents.push({
            inlineData: { data: image.base64Data, mimeType: image.mimeType }
        });
        contents.push({ text: `User Request: ${prompt}` });
    } else {
        contents.push({ text: prompt });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: { role: 'user', parts: contents },
      config: { systemInstruction: systemInstruction, temperature: 0.7 }
    });
    return response.text?.trim() || prompt;
  } catch (error: any) {
    console.error("Refine Prompt Error:", error);
    // For rate limits during refinement, just return original prompt silently to avoid disrupting flow
    return prompt; 
  }
};

export interface WatermarkParams {
    text: string;
    subText?: string;
    style: string;
    theme?: string;
    icon?: string;
    color?: string;
}

export const generateWatermark = async (params: WatermarkParams): Promise<string> => {
    return ""; 
};

// NEW: Video Prompt Structure
export interface VideoPromptResultScheme {
    title: string;
    tags: string[];
    visual_prompt: string;
    camera_atmosphere: string;
    audio_prompt: string;
}

export const generateVideoPrompt = async (
    image: GeminiImagePart, 
    params: { userInput: string, camera: string },
    language: string = 'en'
): Promise<VideoPromptResultScheme[]> => {
    const apiKey = getActiveKey();
    if (!apiKey) throw new Error("System API Key Missing.");

    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `
    You are a professional AI Film Director and Prompt Engineer.
    
    Task:
    Analyze the provided image and the user's request (if any) to create 3 distinct video generation concepts.
    
    Inputs:
    1. Image (Visual Reference)
    2. User Idea: "${params.userInput}" (If empty, infer from image)
    3. Required Camera Movement: "${params.camera}" (Must be applied to all schemes if specified)
    
    Output 3 Schemes:
    1. Cinematic / Realistic (Documentary or Movie style)
    2. Dynamic / High Motion (Action or Fast-paced style)
    3. Creative / Abstract (Dreamy, artistic, or emotional style)
    
    Output Format:
    Strictly return a JSON array with 3 objects. No markdown formatting.
    Structure:
    [
      {
        "title": "Short Creative Title",
        "tags": ["Tag1", "Tag2", "Tag3"],
        "visual_prompt": "Detailed description of the subject, action, and key visual elements.",
        "camera_atmosphere": "Specific camera movement instructions, lighting, and mood.",
        "audio_prompt": "Sound design, ambient noise, and specific sound effects."
      },
      ...
    ]
    
    Language Requirement:
    ${language === 'zh' ? 'All content MUST be in Traditional Chinese (繁體中文), except for specific technical terms if needed.' : 'All content must be in English.'}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                role: 'user',
                parts: [
                    { inlineData: { data: image.base64Data, mimeType: image.mimeType } },
                    { text: "Generate the video prompt schemes." }
                ]
            },
            config: { 
                systemInstruction: systemInstruction, 
                temperature: 0.7,
                responseMimeType: "application/json"
            }
        });
        
        const text = response.text?.trim();
        if (!text) throw new Error("Empty response");
        
        // Clean markdown if present (though responseMimeType should handle it)
        const jsonStr = text.replace(/^```json\n|\n```$/g, '');
        const schemes = JSON.parse(jsonStr);
        
        return schemes;

    } catch (error: any) {
        handleGeminiError(error, "Gemini Video Prompt");
        return [];
    }
};

// NEW: Generate Poetic Text for Watermark
export const generatePoeticText = async (
    style: string,
    languageLabel: string,
    imagePart?: GeminiImagePart
): Promise<string> => {
    const apiKey = getActiveKey();
    if (!apiKey) throw new Error("System API Key Missing.");

    const ai = new GoogleGenAI({ apiKey });

    // Determine specific language instructions
    let languageInstruction = "";
    let formatInstruction = "";

    if (languageLabel.includes("純中文")) {
        languageInstruction = "Use Traditional Chinese (繁體中文).";
        formatInstruction = `
        Format:
        Line 1: Title (2-4 chars)
        Line 2: Poem line 1 (5 or 7 chars)
        Line 3: Poem line 2
        Line 4: Poem line 3
        Line 5: Poem line 4
        `;
    } else if (languageLabel.includes("中英文")) {
        languageInstruction = "Use Traditional Chinese AND English translation.";
        formatInstruction = `
        Format:
        Line 1: Title (Chinese)
        Line 2: Title (English)
        Line 3: Poem line 1 (Chinese)
        Line 4: Poem line 1 (English Translation)
        Line 5: Poem line 2 (Chinese)
        Line 6: Poem line 2 (English Translation)
        ...and so on.
        `;
    } else {
        languageInstruction = `Use ${languageLabel}.`;
        formatInstruction = "Format: Title on line 1, then poem lines.";
    }

    const promptContent = `
    Role: You are a famous poet emulating the style of: ${style}.
    Task: Analyze the attached image visually and write a poem about it.
    
    Strict Instructions:
    1. ${languageInstruction}
    2. ${formatInstruction}
    3. Output ONLY the raw text lines. No "Title:" labels, no markdown code blocks (like \`\`\`). DO NOT add "Here is the poem:"
    4. Be creative, visual, and capture the mood of the image.
    `;

    const parts: any[] = [];
    
    if (imagePart) {
        parts.push({ 
            inlineData: { 
                data: imagePart.base64Data, 
                mimeType: imagePart.mimeType 
            } 
        });
    }
    
    parts.push({ text: promptContent });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { 
                role: 'user', 
                parts: parts 
            },
            config: { 
                temperature: 0.9,
            }
        });
        
        let result = response.text?.trim();
        if (!result) return "AI 未能生成內容，請重試。\n(AI failed to generate content)";
        
        // Clean up markdown
        result = result.replace(/^```[a-z]*\n/i, '').replace(/```$/, '').trim();
        // Remove quotes
        result = result.replace(/^["']|["']$/g, '');

        return result;

    } catch (error: any) {
        handleGeminiError(error, "Gemini Poem Gen");
    }
};
