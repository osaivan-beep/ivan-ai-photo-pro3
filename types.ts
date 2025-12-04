
import type { translations } from './lib/translations';

export interface ApiResult {
  text: string | null;
  imageUrl: string | null;
}

export type Language = 'en' | 'zh';

export interface UploadedImage {
  id: string;
  file: File;
  dataUrl: string;
}

export interface GeminiImagePart {
  base64Data: string;
  mimeType: string;
}

export type ImageResolution = '1K' | '2K' | '4K';

export interface UserProfile {
  uid: string;
  email: string | null;
  credits: number;
  isAdmin: boolean;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  adminEmail?: string;
}

type TranslationObject = typeof translations.en;
export type StringTranslationKeys = {
  [K in keyof TranslationObject]: TranslationObject[K] extends string ? K : never;
}[keyof TranslationObject];

export type TFunction = (key: StringTranslationKeys) => string;

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}
