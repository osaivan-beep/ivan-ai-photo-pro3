
import { GoogleGenAI, Modality, type GenerateContentResponse } from '@google/genai';
import type { GeminiImagePart, ImageResolution } from '../types';

// Dynamic retrieval function
export const getActiveKey = (): string => {
    // 1. Priority: Check Manual Override in LocalStorage first
    let manualKey = localStorage.getItem('user_gemini_api_key') || "";
    
    // Auto-correct common typo: "Alza" (lowercase L) -> "AIza" (uppercase I)
    if (/^Alza/i.test(manualKey.trim())) {
        console.log("Auto-correcting API Key typo in LocalStorage...");
        manualKey = manualKey.trim().replace(/^Alza/i, 'AIza');
        localStorage.setItem('user_gemini_api_key', manualKey);
    }

    if (manualKey && manualKey.trim().startsWith('AIza')) {
        return manualKey.trim();
    }

    // 2. Fallback: System Env
    let systemKey = process.env.API_KEY || "";
    
    // Runtime cleanup
    systemKey = systemKey.trim().replace(/^['"]|['"]$/g, '');
    
    // Auto-correct common typo in Env
    if (/^Alza/i.test(systemKey)) {
        console.warn("Auto-correcting API Key typo in Env...");
        systemKey = systemKey.replace(/^Alza/i, 'AIza');
    }
    
    // If the system key is obviously the placeholder (GEMINI_API_KEY) or empty, ignore it
    if (systemKey === "GEMINI_API_KEY" || !systemKey) {
        console.warn("System API Key is invalid or missing.");
        return "";
    }
    
    return systemKey;
};

// Helper to verify which key is active
export const getKeyId = (): string => {
    const key = getActiveKey();

    if (!key) return "Missing (未設定)";
    if (key.includes("GEMI")) return "INVALID_PLACEHOLDER";
    
    if (key.length > 8) {
        return `${key.substring(0, 4)}...${key.slice(-4)}`;
    }
    return "Unknown Key";
};

export const setStoredKey = (key: string) => {
    // Auto-correct before saving
    let cleanKey = key.trim();
    if (/^Alza/i.test(cleanKey)) {
        cleanKey = cleanKey.replace(/^Alza/i, 'AIza');
    }
    localStorage.setItem('user_gemini_api_key', cleanKey);
};

export const removeStoredKey = () => {
    localStorage.removeItem('user_gemini_api_key');
};

/**
 * DIAGNOSTIC TOOL
 * Tests the key connectivity and permissions
 */
export const validateKeyAndListModels = async (inputKey: string) => {
    let cleanKey = inputKey.trim();
    if (/^Alza/i.test(cleanKey)) cleanKey = cleanKey.replace(/^Alza/i, 'AIza');

    if (!cleanKey) return { success: false, log: "Error: Empty Key" };

    try {
        const ai = new GoogleGenAI({ apiKey: cleanKey });
        // Try to list models - this verifies basic API access
        const response = await ai.models.list();
        
        const models = response.models || [];
        const modelNames = models.map((m: any) => m.name || m.displayName);
        
        // Check specifically for the image model we use
        const hasGemini3 = modelNames.some((n: string) => n.includes('gemini-3-pro-image')); 
        const hasFlash = modelNames.some((n: string) => n.includes('flash'));

        let log = "✅ 連線成功 (Connection Success)\n";
        log += `🔑 Key ID: ${cleanKey.substring(0,4)}...${cleanKey.slice(-4)}\n`;
        log += `--------------------------------\n`;
        log += `🔎 權限檢查 (Permission Check):\n`;
        log += `   - Gemini 3 Pro Image: ${hasGemini3 ? "YES ✅" : "NO ❌ (Might be hidden but usable)"}\n`;
        log += `   - Gemini Flash Available: ${hasFlash ? "YES ✅" : "NO ❌"}\n`;
        log += `--------------------------------\n`;
        log += `📋 可用模型列表 (Available Models):\n`;
        log += modelNames.filter((n: string) => n.includes('gemini')).slice(0, 10).join('\n');
        
        return { success: true, log, hasGemini3 };

    } catch (e: any) {
        let errorMsg = `❌ 連線失敗 (Connection Failed)\n`;
        errorMsg += `Code: ${e.status || 'Unknown'}\n`;
        errorMsg += `Message: ${e.message}\n`;
        
        if (e.message?.includes('403') || e.status === 403) {
            errorMsg += `\n⚠️ 403 原因分析:\n`;
            
            const isTranslated = window.location.hostname.includes('translate.goog') || window.location.hostname.includes('usercontent');
            if (isTranslated) {
                errorMsg += `🔴 偵測到您正在使用 Google 翻譯/代理！\n`;
                errorMsg += `這會改變網址，導致 API Key 被攔截。\n`;
                errorMsg += `解決方案：請至 Google Cloud Console 將 Key 限制改為 "None (不限制)"。\n`;
            } else {
                errorMsg += `1. 網域限制 (Referer) 錯誤。請確認 Google Console 已加入: ${window.location.origin}/*\n`;
            }
            errorMsg += `2. API 未啟用。請去 Console 啟用 "Generative Language API"。\n`;
            errorMsg += `3. 專案無效/被停權 (Billing Issue)。\n`;
        }
        
        return { success: false, log: errorMsg };
    }
};

const handleGeminiError = (error: unknown, context: string): never => {
  console.error(`Error calling ${context}:`, error);
  if (error instanceof Error) {
    const msg = error.message;
    const isTranslated = window.location.hostname.includes('translate.goog') || window.location.hostname.includes('usercontent');
    
    // Add origin info for debugging 403s
    const originInfo = `(Current Origin: ${window.location.origin})`;

    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
      throw new Error('系統忙碌中 (目前使用人數眾多)。\n請等待 30-60 秒後點擊「重試」。');
    }
    
    if (msg.includes('API_KEY_INVALID') || msg.includes('400')) {
        throw new Error(`API 金鑰無效 (API_KEY_INVALID)。\nKey ID: ${getKeyId()}\n請嘗試點擊右上角重置，並重新輸入 Key。`);
    }

    if (msg.includes('PERMISSION_DENIED') || msg.includes('403')) {
        let advice = `API 權限錯誤 (403)。\nKey ID: ${getKeyId()}\n${originInfo}\n\n`;
        
        if (isTranslated) {
            advice += `🔴 偵測到 Google 翻譯/代理網頁！\n這會改變來源網址，導致 API 攔截。\n請至 Google Cloud Console 將 API Key 限制改為「None (不限制)」。`;
        } else {
            advice += `請檢查：\n1. 網域限制是否包含 ${window.location.origin}/*\n2. 帳單狀態 (Gemini 3 Pro)\n3. Generative Language API 是否啟用`;
        }
        throw new Error(advice);
    }
    
    throw new Error(`${context} Error: ${msg}`);
  }
  throw new Error(`An unknown error occurred while communicating with the ${context}.`);
};

export const generateImageWithGemini = async (
  prompt: string,
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | null,
  resolution: ImageResolution = '2K' 
): Promise<{ imageUrl: string }> => {
  
  const apiKey = getActiveKey();
  if (!apiKey) throw new Error("API Key 未設定。請重新整理頁面並輸入金鑰。");

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
    const config: any = {
        imageConfig: {
            imageSize: resolution || '1K' 
        }
    };
    
    if (aspectRatio) {
        config.imageConfig.aspectRatio = aspectRatio;
    }

    // Try Gemini 3 Pro First
    console.log("Attempting Gemini 3 Pro...");
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ text: prompt }] },
      config: config,
    });

    const img = extractImage(response);
    if (!img) throw new Error('No image generated.');
    return { imageUrl: img };

  } catch (error: any) {
     console.warn("Primary model failed:", error.message);
     
     // Automatic Fallback Logic for ANY error (403, 404, 500)
     // If user doesn't have Pro access, silently downgrade to Flash
     if (error.message?.includes('403') || error.message?.includes('PERMISSION_DENIED') || error.message?.includes('not found')) {
         console.warn("Falling back to Gemini 2.5 Flash Image...");
         try {
             const flashResponse = await ai.models.generateContent({
                 model: 'gemini-2.5-flash-image', 
                 contents: { parts: [{ text: prompt }] },
                 // Flash image has simpler config
                 config: {} 
             });
             const img = extractImage(flashResponse);
             if (img) return { imageUrl: img };
         } catch (fallbackError: any) {
             console.error("Fallback also failed:", fallbackError);
             // If fallback also fails, throw original error or a combined one
             if (fallbackError.message?.includes('403')) {
                 handleGeminiError(fallbackError, "Gemini Flash (Fallback)");
             }
         }
     }
     
     handleGeminiError(error, "Gemini 3 Pro Image API");
  }
};

export const editImageWithGemini = async (
  images: GeminiImagePart[],
  prompt: string
): Promise<{ response: GenerateContentResponse }> => {
  const apiKey = getActiveKey();
  if (!apiKey) throw new Error("API Key 未設定。");

  const ai = new GoogleGenAI({ apiKey });

  const imageParts = images.map(image => ({
      inlineData: { data: image.base64Data, mimeType: image.mimeType },
  }));
  const textPart = { text: prompt };
  const allParts = [...imageParts, textPart];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview', 
      contents: { parts: allParts },
      config: {
          imageConfig: {
              imageSize: '1K' 
          }
      }
    });
    return { response };

  } catch (error: any) {
      // Fallback for Edit as well
      if (error.message?.includes('403') || error.message?.includes('PERMISSION_DENIED')) {
         console.warn("Gemini 3 Pro Edit failed, falling back to Flash...");
         try {
             const flashResponse = await ai.models.generateContent({
                 model: 'gemini-2.5-flash-image', 
                 contents: { parts: allParts },
             });
             return { response: flashResponse };
         } catch (fbError) {
             console.error("Fallback edit failed");
         }
      }
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
    return prompt; 
  }
};

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
        
        const jsonStr = text.replace(/^```json\n|\n```$/g, '');
        const schemes = JSON.parse(jsonStr);
        
        return schemes;

    } catch (error: any) {
        handleGeminiError(error, "Gemini Video Prompt");
        return [];
    }
};

export const generatePoeticText = async (
    style: string,
    languageLabel: string,
    imagePart?: GeminiImagePart
): Promise<string> => {
    const apiKey = getActiveKey();
    if (!apiKey) throw new Error("System API Key Missing.");

    const ai = new GoogleGenAI({ apiKey });

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
    3. Output ONLY the raw text lines. No "Title:" labels, no markdown code blocks.
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
        
        result = result.replace(/^```[a-z]*\n/i, '').replace(/```$/, '').trim();
        result = result.replace(/^["']|["']$/g, '');

        return result;

    } catch (error: any) {
        handleGeminiError(error, "Gemini Poem Gen");
        return "AI 生成錯誤 (Error)";
    }
};
