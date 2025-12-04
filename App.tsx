

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { GenerateContentResponse } from '@google/genai';
import { CanvasEditor, type CanvasEditorRef } from './components/CanvasEditor';
import { QuickPrompts } from './components/QuickPrompts';
import { Toolbar } from './components/Toolbar';
import { ThumbnailManager } from './components/ThumbnailManager';
import { ResultDisplay } from './components/ResultDisplay';
import { UploadIcon, SparklesIcon, RedrawIcon, ZoomInIcon, ZoomOutIcon, ArrowsPointingOutIcon, ArrowUpIcon, ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, UserCircleIcon, ShareIcon, CloseIcon, HandIcon, KeyIcon, VideoCameraIcon, RefreshIcon } from './components/Icons';
import { editImageWithGemini, generateImageWithGemini, refinePrompt, getActiveKey, setStoredKey, removeStoredKey, getKeyId } from './services/geminiService';
import type { ApiResult, Language, UploadedImage, GeminiImagePart, TFunction, ImageResolution, UserProfile, FirebaseConfig } from './types';
import { translations } from './lib/translations';
import { PhotoEditor } from './components/PhotoEditor';
import { LayoutEditor } from './components/LayoutEditor';
import { initializeFirebase, isFirebaseConfigured, login, register, logout, getUserProfile, deductCredits, addCreditsByEmail, getAuthInstance, sendPasswordReset } from './services/firebaseService';
import { onAuthStateChanged } from 'firebase/auth';
import { AdminUserList } from './components/AdminUserList';
import { embeddedConfig } from './lib/firebaseConfig';
import { WatermarkModal } from './components/WatermarkModal';
import { VideoPromptModal } from './components/VideoPromptModal';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const ZoomControls = ({ zoom, onZoomChange, onFit, t, isPanMode, onTogglePan }: { zoom: number, onZoomChange: (z: number) => void, onFit: () => void, t: TFunction, isPanMode: boolean, onTogglePan: () => void }) => (
    <div className="flex items-center gap-1 bg-gray-700/50 rounded-lg p-1 px-2 border border-gray-600 h-9">
         <button 
            onClick={onTogglePan} 
            className={`p-1.5 rounded text-gray-300 ${isPanMode ? 'bg-purple-600 text-white' : 'hover:bg-gray-600'}`} 
            title={t('panModeButton')}
        >
            <HandIcon className="w-4 h-4" />
        </button>
        <button onClick={() => onZoomChange(Math.max(0.01, zoom - 0.1))} className="p-1.5 hover:bg-gray-600 rounded text-gray-300" title={t('zoomOutButton')}>
            <ZoomOutIcon className="w-4 h-4" />
        </button>
        <div className="relative group flex items-center">
            <input 
                type="number" 
                value={Math.round(zoom * 100)} 
                onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val > 0) onZoomChange(val / 100);
                }}
                className="w-10 bg-transparent text-center text-sm text-white focus:outline-none appearance-none font-mono"
            />
            <span className="text-xs text-gray-500 pointer-events-none">%</span>
        </div>
        <button onClick={() => onZoomChange(Math.min(10, zoom + 0.1))} className="p-1.5 hover:bg-gray-600 rounded text-gray-300" title={t('zoomInButton')}>
            <ZoomInIcon className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-gray-600 mx-1"></div>
        <button onClick={onFit} className="p-1.5 hover:bg-gray-600 rounded text-gray-300" title={t('resetViewButton')}>
            <ArrowsPointingOutIcon className="w-4 h-4" />
        </button>
    </div>
);

const LandingScreen: React.FC<{ onConfigSave: (config: FirebaseConfig) => void; onAuthSuccess: () => void; t: TFunction }> = ({ onConfigSave, onAuthSuccess, t }) => {
    const hasEmbedded = !!embeddedConfig;
    const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');
    const [configStr, setConfigStr] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [systemConfigured, setSystemConfigured] = useState(false);

    useEffect(() => {
        setSystemConfigured(isFirebaseConfigured());
    }, []);

    const handleConfigSubmit = async () => {
        const cleanAdminEmail = adminEmail.trim();
        
        if (cleanAdminEmail !== 'osa.ivan@gmail.com') {
            alert(t('adminEmailValidation'));
            return;
        }
        if (adminPassword.length < 6) {
            alert("Password must be at least 6 characters.");
            return;
        }

        try {
            let clean = configStr.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1').trim();
            clean = clean
                .replace(/：/g, ':')
                .replace(/，/g, ',')
                .replace(/“/g, '"')
                .replace(/”/g, '"')
                .replace(/‘/g, "'")
                .replace(/’/g, "'")
                .replace(/\s+=\s+/g, '=')
                .replace(/項目ID|專案ID|Project ID/g, 'projectId')
                .replace(/應用程式ID|App ID/g, 'appId')
                .replace(/儲存空間值區|Storage Bucket/g, 'storageBucket')
                .replace(/訊息傳送者ID|Messaging Sender ID/g, 'messagingSenderId')
                .replace(/評估ID|Measurement ID/g, 'measurementId')
                .replace(/API 金鑰|API Key/g, 'apiKey')
                .replace(/驗證網域|Auth Domain/g, 'authDomain');

            let objectString: string | null = null;
            let match = clean.match(/\w+\s*=\s*({[\s\S]*?})(;|)/);
            if (match) {
                objectString = match[1];
            } else {
                 match = clean.match(/({[\s\S]*?apiKey[\s\S]*?})/);
                 if (match) {
                     objectString = match[1];
                 }
            }

            if (objectString) {
                const configObj = new Function(`return ${objectString}`)();
                
                if (!configObj.apiKey) {
                     alert(t('setupErrorMissingConfig'));
                     return;
                }
                
                onConfigSave({ ...configObj, adminEmail: cleanAdminEmail });
                setSystemConfigured(true);

                setLoading(true);
                try {
                    try {
                        await register(cleanAdminEmail, adminPassword);
                    } catch (regError: any) {
                        if (regError.code === 'auth/email-already-in-use') {
                            await login(cleanAdminEmail, adminPassword);
                        } else {
                            throw regError;
                        }
                    }
                } catch (authError: any) {
                    console.error(authError);
                    alert(`System initialized, but auto-login failed: ${authError.message}. Please try logging in manually.`);
                    setActiveTab('user');
                    setEmail(cleanAdminEmail);
                } finally {
                    setLoading(false);
                }
            } else {
                // Try Parsing as pure JSON
                try {
                     const json = JSON.parse(clean);
                     if (json.apiKey) {
                         onConfigSave({ ...json, adminEmail: cleanAdminEmail });
                         setSystemConfigured(true);
                         
                         setLoading(true);
                         try {
                            try {
                                await register(cleanAdminEmail, adminPassword);
                            } catch (regError: any) {
                                if (regError.code === 'auth/email-already-in-use') {
                                    await login(cleanAdminEmail, adminPassword);
                                } else {
                                    throw regError;
                                }
                            }
                         } catch (authError: any) {
                             console.error(authError);
                             alert(`System initialized, but auto-login failed: ${authError.message}. Please try logging in manually.`);
                             setActiveTab('user');
                             setEmail(cleanAdminEmail);
                         } finally {
                             setLoading(false);
                         }
                         return;
                     }
                } catch (e) {
                }
                throw new Error("Could not find a valid configuration object.");
            }
        } catch (e) {
            console.error(e);
            alert(`${t('setupErrorInvalidFormat')}\n\nTechnical details: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
    };

    const handleShare = () => {
        try {
            const stored = localStorage.getItem('firebaseConfig');
            if (stored) {
                 const encoded = btoa(stored);
                 const url = `${window.location.origin}${window.location.pathname}?setup=${encoded}`;
                 navigator.clipboard.writeText(url);
                 alert(t('shareLinkCopied'));
            } else {
                alert('Configuration not found. Please initialize first.');
            }
        } catch (e) {
            alert('Failed to generate link.');
        }
    };

    const handleAuthSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await login(email.trim(), password);
            onAuthSuccess();
        } catch (err: any) {
            console.error(err);
            const errorMessage = err.message || '';
            
            if (err.code === 'auth/operation-not-allowed') {
                setError('⚠️ 操作失敗：請至 Firebase Console > Authentication > Sign-in method 開啟「Email/Password」登入功能。');
            } else if (errorMessage.includes('identity-toolkit-api-has-not-been-used-in-project') || errorMessage.includes('PROJECT_NOT_FOUND')) {
                setError('⚠️ 設定正確！但 Google 系統生效需要時間。\n請等待約 3-5 分鐘後，再次嘗試登入。\n(請確保 Identity Toolkit API 已啟用)');
            } else if (err.code === 'auth/email-already-in-use') {
                setError('此 Email 已被註冊。');
            } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
                setError('帳號或密碼錯誤。');
            } else if (err.code === 'auth/weak-password') {
                setError('密碼強度不足 (需 6 位以上)。');
            } else if (err.code === 'auth/user-not-found') {
                setError('找不到此帳號。請聯絡管理員開通。');
            } else {
                setError(errorMessage);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
             <div className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl border border-gray-700 overflow-hidden flex flex-col md:flex-row">
                <div className="bg-gradient-to-br from-purple-900 to-indigo-900 p-8 md:w-5/12 flex flex-col justify-center items-center text-center">
                    <SparklesIcon className="w-20 h-20 text-purple-300 mb-6" />
                    <h1 className="text-3xl font-bold text-white mb-2">{t('landingTitle' as any) || 'Ivan Ai Photo Pro 3'}</h1>
                    <p className="text-purple-200">{t('landingSubtitle' as any) || 'Professional AI Editor'}</p>
                    {hasEmbedded && (
                        <div className="mt-4 px-3 py-1 bg-green-900/50 border border-green-500/30 rounded-full text-xs text-green-300">
                             {t('systemConfiguredEmbedded')}
                        </div>
                    )}
                </div>

                <div className="p-8 md:w-7/12 bg-gray-800">
                    <div className="flex border-b border-gray-700 mb-6">
                        <button 
                            className={`flex-1 pb-3 text-sm font-medium transition-colors ${activeTab === 'user' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-500 hover:text-gray-300'}`}
                            onClick={() => setActiveTab('user')}
                        >
                            {t('userLoginTab')}
                        </button>
                        {!hasEmbedded && (
                            <button 
                                className={`flex-1 pb-3 text-sm font-medium transition-colors ${activeTab === 'admin' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-500 hover:text-gray-300'}`}
                                onClick={() => setActiveTab('admin')}
                            >
                                {t('adminSetupTab')}
                            </button>
                        )}
                    </div>

                    {activeTab === 'user' ? (
                        <div>
                             {!systemConfigured && !hasEmbedded ? (
                                 <div className="text-center py-8">
                                     <div className="bg-yellow-900/30 text-yellow-200 p-4 rounded-lg border border-yellow-700/50 mb-4">
                                         {t('systemNotReady')}
                                     </div>
                                 </div>
                             ) : (
                                <form onSubmit={handleAuthSubmit} className="space-y-4 animate-fade-in">
                                    <h2 className="text-xl font-bold text-white mb-4">
                                        {t('loginTitle')}
                                    </h2>
                                    {error && <div className="bg-red-900/50 text-red-200 p-3 rounded text-sm border border-red-700 whitespace-pre-line">{error}</div>}
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-1">{t('emailLabel')}</label>
                                        <input 
                                            type="email" required
                                            className="w-full bg-gray-900 text-white p-3 rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
                                            value={email} onChange={e => setEmail(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <div className="flex justify-between">
                                            <label className="block text-gray-400 text-sm mb-1">{t('passwordLabel')}</label>
                                        </div>
                                        <input 
                                            type="password" required
                                            className="w-full bg-gray-900 text-white p-3 rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
                                            value={password} onChange={e => setPassword(e.target.value)}
                                        />
                                    </div>
                                    <button 
                                        type="submit" 
                                        disabled={loading}
                                        className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {loading ? '...' : t('loginButton')}
                                    </button>
                                </form>
                             )}
                        </div>
                    ) : (
                        <div className="animate-fade-in">
                             <h2 className="text-xl font-bold text-white mb-2">{t('setupTitle')}</h2>
                             <textarea className="w-full h-32 bg-gray-900 text-gray-200 p-3 rounded-lg border border-gray-600 font-mono text-xs" placeholder={t('firebaseConfigPlaceholder')} value={configStr} onChange={(e) => setConfigStr(e.target.value)} />
                             <button onClick={handleConfigSubmit} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg mt-4">{t('saveConfigButton')}</button>
                        </div>
                    )}
                </div>
             </div>
        </div>
    )
}

const PermissionErrorModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full border border-red-500/50 p-6">
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-red-400">⚠️ Database Permission Error</h3>
                <button onClick={onClose}><CloseIcon className="w-6 h-6 text-gray-400"/></button>
            </div>
            <p className="text-gray-300 mb-4 text-sm">
                The app cannot read/write to the database. This usually means the Firestore Rules are not set correctly.
            </p>
            <button onClick={onClose} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 rounded-lg">
                I Fixed It, Try Again
            </button>
        </div>
    </div>
);

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('zh');
  const [appState, setAppState] = useState<'landing' | 'app'>('landing');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [firebaseInitialized, setFirebaseInitialized] = useState(false);
  const [showWatermarkModal, setShowWatermarkModal] = useState(false);
  const [showVideoPromptModal, setShowVideoPromptModal] = useState(false);

  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState<number>(10);
  const [brushColor, setBrushColor] = useState<string>('#ef4444');
  const [prompt, setPrompt] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<string>('3:2');
  const [resolution, setResolution] = useState<ImageResolution>('2K');
  const [allQuickPrompts, setAllQuickPrompts] = useState<Record<string, string[]>>({});
  const [apiResult, setApiResult] = useState<ApiResult>({ text: null, imageUrl: null });
  const [loading, setLoading] = useState<boolean>(false);
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isPanMode, setIsPanMode] = useState(false);
  const [isLayoutEditorOpen, setIsLayoutEditorOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<UploadedImage | null>(null);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);

  const canvasRef = useRef<CanvasEditorRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef({ startX: 0, startY: 0, startPan: { x: 0, y: 0 } });
  const pinchStartRef = useRef<{ dist: number; mid: { x: number; y: number; }; zoom: number; pan: { x: number; y: number; }; } | null>(null);

  const t: TFunction = useCallback((key) => {
    return translations[lang][key] || translations.en[key];
  }, [lang]);

  useEffect(() => {
    setAllQuickPrompts(translations[lang].defaultQuickPrompts);
  }, [lang]);

  const selectedImage = uploadedImages.find(img => img.id === selectedImageId) || null;
  
  const fitImageToScreen = useCallback(() => {
    if (!imageContainerRef.current || !selectedImage) return;
    const img = new Image();
    img.onload = () => {
        if (!imageContainerRef.current) return;
        const container = imageContainerRef.current;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // padding
        const pW = containerWidth * 0.9;
        const pH = containerHeight * 0.9;
        
        const scale = Math.min(pW / img.naturalWidth, pH / img.naturalHeight);
        setZoom(scale);
        setPan({ x: 0, y: 0 });
    }
    img.src = selectedImage.dataUrl;
  }, [selectedImage]);

  useEffect(() => { if (selectedImageId) fitImageToScreen(); }, [selectedImageId, fitImageToScreen]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const setupStr = params.get('setup');
    if (setupStr) {
        try {
            const configStr = atob(setupStr);
            if (configStr.includes('apiKey')) {
                localStorage.setItem('firebaseConfig', configStr);
                window.history.replaceState({}, '', window.location.pathname);
                window.location.reload();
                return;
            }
        } catch (e) {}
    }
    if (isFirebaseConfigured()) { try { initializeFirebase(); setFirebaseInitialized(true); } catch (e) { console.error(e); } }
  }, []);

  useEffect(() => {
    if (!firebaseInitialized) return;
    const auth = getAuthInstance();
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const profile = await getUserProfile(user.uid);
                setUserProfile(profile);
                setAppState('app');
            } catch (e: any) {
                if (e.code === 'permission-denied') setShowPermissionHelp(true);
            }
        } else {
            setUserProfile(null);
            setAppState('landing');
        }
    });
    return () => unsubscribe();
  }, [appState, firebaseInitialized]);

  const handleConfigSave = (config: FirebaseConfig) => { try { initializeFirebase(config); setFirebaseInitialized(true); } catch (e: any) { alert(e.message); } };
  const refreshUserProfile = async () => { if (userProfile) { try { const updated = await getUserProfile(userProfile.uid); setUserProfile(updated); } catch(e) {} } };

  // Error Handling Wrapper
  const handleApiError = (e: any) => {
      console.error(e);
      const msg = e.message || '';
      
      if (msg.includes('permission-denied')) {
          setShowPermissionHelp(true);
      } else {
          // 一般錯誤 (含 Rate Limit) 直接顯示紅色警告
          setError(msg);
      }
  };

  const handleRefinePrompt = async () => {
    const cost = 3;
    if (!prompt) return;
    if (!userProfile || userProfile.credits < cost) { alert(t('notEnoughCredits')); return; }

    setIsRefining(true);
    let imagePart: GeminiImagePart | null = null;
    if (selectedImage) {
        try {
            const dataUrl = canvasRef.current ? canvasRef.current.toDataURL() : selectedImage.dataUrl;
            const [header, base64Data] = dataUrl.split(',');
            imagePart = { base64Data, mimeType: header.match(/:(.*?);/)?.[1] || 'image/png' };
        } catch (e) {}
    }

    try {
        const enhancedPrompt = await refinePrompt(prompt, imagePart, lang);
        if (enhancedPrompt && enhancedPrompt !== prompt) {
            await deductCredits(userProfile.uid, cost);
            setUserProfile(prev => prev ? { ...prev, credits: prev.credits - cost } : null);
            setPrompt(enhancedPrompt);
        }
    } catch (e: any) {
         handleApiError(e);
    } finally { setIsRefining(false); }
  };

  const handleDeductCredits = async (amount: number) => {
      if (userProfile) {
          try {
            await deductCredits(userProfile.uid, amount);
            setUserProfile(prev => prev ? { ...prev, credits: prev.credits - amount } : null);
          } catch(e) {}
      }
  }
  
  const handleAddWatermarkImage = (dataUrl: string) => {
      const newImage: UploadedImage = { id: `watermark-${Date.now()}`, file: new File([], "watermark.png"), dataUrl };
      setUploadedImages(prev => [...prev, newImage]);
      setSelectedImageId(newImage.id);
      setShowWatermarkModal(false);
  };

  const handleGenerate = useCallback(async () => {
    const cost = 5;
    if (!prompt) { setError('Please enter a prompt.'); return; }
    if (!userProfile || userProfile.credits < cost) { setError(t('notEnoughCredits')); return; }

    let capturedCanvasData: string | null = null;
    if (selectedImage && !apiResult.imageUrl) {
        if (canvasRef.current) { capturedCanvasData = canvasRef.current.toDataURL('image/png'); } 
        else { capturedCanvasData = selectedImage.dataUrl; }
    }
    const previousResultUrl = apiResult.imageUrl;

    setLoading(true);
    setError(null);
    setWarning(null);
    setApiResult({ text: null, imageUrl: null });

    try {
      let effectiveAspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | null = null;
      if (!selectedImage) {
          if (aspectRatio === '3:2') effectiveAspectRatio = '4:3';
          else if (aspectRatio === '2:3') effectiveAspectRatio = '3:4';
          else effectiveAspectRatio = aspectRatio as any;
      }

      let resultImageUrl = '';

      if (!selectedImage) {
        // Pass resolution (ImageResolution) to the generation service
        const result = await generateImageWithGemini(prompt, effectiveAspectRatio, resolution);
        resultImageUrl = result.imageUrl;
      } else {
        let baseImagePart: GeminiImagePart;
        if (previousResultUrl) {
            const [header, base64Data] = previousResultUrl.split(',');
            baseImagePart = { base64Data, mimeType: header.match(/:(.*?);/)?.[1] || 'image/png' };
        } else {
            if (!capturedCanvasData) throw new Error('Canvas data missing.');
            const base64Data = capturedCanvasData.split(',')[1];
            baseImagePart = { base64Data, mimeType: 'image/png' };
        }
        
        const imagesToSend: GeminiImagePart[] = [baseImagePart];
        const editPrefix = "Edit instruction: ";
        const finalPrompt = `${editPrefix}${prompt}\n\n${t('instructionalPrompt')}`;
        
        const result = await editImageWithGemini(imagesToSend, finalPrompt);
        const response = result.response;

        if (response.candidates && response.candidates[0]?.content?.parts) {
          const part = response.candidates[0].content.parts.find(p => p.inlineData);
          if (part?.inlineData) {
            resultImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          }
        }
      }

      if (resultImageUrl) {
            await deductCredits(userProfile.uid, cost);
            setUserProfile(prev => prev ? { ...prev, credits: prev.credits - cost } : null);
            setApiResult({ text: null, imageUrl: resultImageUrl });
      } else {
          throw new Error('No image generated.');
      }

    } catch (e: any) {
      handleApiError(e);
      setApiResult({ text: null, imageUrl: previousResultUrl });
    } finally {
      setLoading(false);
    }
  }, [selectedImage, prompt, uploadedImages, selectedImageId, t, apiResult.imageUrl, aspectRatio, userProfile, resolution]);

  const handleFiles = useCallback((files: FileList) => {
      const newImages: UploadedImage[] = [];
      Array.from(files).forEach(file => {
          if (file.type.startsWith('image/')) {
              const reader = new FileReader();
              reader.onload = (e) => {
                  if (e.target?.result) {
                      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                      setUploadedImages(prev => [...prev, {
                          id,
                          file,
                          dataUrl: e.target!.result as string
                      }]);
                      if (!selectedImageId) {
                          setSelectedImageId(id);
                      }
                  }
              };
              reader.readAsDataURL(file);
          }
      });
  }, [selectedImageId]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) { handleFiles(e.target.files); e.target.value = ''; } };
  const handleUploadClick = () => fileInputRef.current?.click();
  const handleImageSelect = (id: string) => { if(id !== selectedImageId) { setSelectedImageId(id); setApiResult({ text: null, imageUrl: null }); setError(null); setWarning(null); } }
  
  const handleImageDelete = (id: string) => {
      setUploadedImages(prev => prev.filter(img => img.id !== id));
      if (selectedImageId === id) {
          setSelectedImageId(null);
          setApiResult({ text: null, imageUrl: null });
      }
  };
  
  const handleImageReorder = (reorderedImages: UploadedImage[]) => setUploadedImages(reorderedImages);
  const handleClearResult = () => { setApiResult({ text: null, imageUrl: null }); setError(null); setWarning(null); };
  
  // Pan Handlers
  const handlePanByControl = useCallback((dx: number, dy: number) => { setPan(p => ({ x: p.x + dx, y: p.y + dy })); }, []);
  
  const handlePanStart = useCallback((clientX: number, clientY: number) => {
    panStartRef.current = { startX: clientX, startY: clientY, startPan: { ...pan } };
    setIsPanning(true);
  }, [pan]);

  const handlePanMove = useCallback((clientX: number, clientY: number) => {
    if (!isPanning) return;
    const dx = clientX - panStartRef.current.startX;
    const dy = clientY - panStartRef.current.startY;
    setPan({
        x: panStartRef.current.startPan.x + dx,
        y: panStartRef.current.startPan.y + dy
    });
  }, [isPanning]);
  
  const handlePanEnd = useCallback(() => setIsPanning(false), []);
  const resetView = useCallback(() => { fitImageToScreen(); }, [fitImageToScreen]);
  const onMouseDown = (e: React.MouseEvent) => { if (e.button !== 0) return; e.preventDefault(); handlePanStart(e.clientX, e.clientY); };
  const onMouseMove = (e: React.MouseEvent) => { e.preventDefault(); handlePanMove(e.clientX, e.clientY); };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
        setIsPanning(false);
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        pinchStartRef.current = {
            dist: Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY),
            mid: { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 },
            zoom: zoom,
            pan: pan,
            
        };
    } else if (e.touches.length === 1) {
        handlePanStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2 && pinchStartRef.current) {
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          const newDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
          const scale = newDist / pinchStartRef.current.dist;
          const newZoom = Math.max(0.1, Math.min(10, pinchStartRef.current.zoom * scale));
          
          setZoom(newZoom);
      } else if (e.touches.length === 1) {
          handlePanMove(e.touches[0].clientX, e.touches[0].clientY);
      }
  };

  const onTouchEnd = () => {
      pinchStartRef.current = null;
      handlePanEnd();
  };

  const handleEditResult = () => {
    if (apiResult.imageUrl) {
        const newImage: UploadedImage = {
            id: `edited-${Date.now()}`,
            file: new File([], "edited_image.png"), 
            dataUrl: apiResult.imageUrl
        };
        setUploadedImages(prev => [...prev, newImage]);
        setSelectedImageId(newImage.id);
        setApiResult({ text: null, imageUrl: null });
    }
  };
  
  const handleLayoutComplete = (dataUrl: string) => {
      const newImage: UploadedImage = {
          id: `layout-${Date.now()}`,
          file: new File([], "layout.png"),
          dataUrl: dataUrl
      };
      setUploadedImages(prev => [...prev, newImage]);
      setSelectedImageId(newImage.id);
      setIsLayoutEditorOpen(false);
  }
  
  const handleOpenPhotoEditor = (id: string) => { const img = uploadedImages.find(i => i.id === id); if (img) setEditingImage(img); };
  const handleSavePhotoEditor = (id: string, dataUrl: string) => { setUploadedImages(prev => prev.map(img => img.id === id ? { ...img, dataUrl } : img)); setEditingImage(null); };

  if (appState === 'landing') return <LandingScreen onConfigSave={handleConfigSave} onAuthSuccess={() => {}} t={t} />;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans relative">
      {showWatermarkModal && (
        <WatermarkModal 
            onClose={() => setShowWatermarkModal(false)} 
            onUseImage={handleAddWatermarkImage} 
            t={t} 
            userCredits={userProfile?.credits || 0}
            onDeductCredits={handleDeductCredits}
        />
      )}
      {showVideoPromptModal && selectedImage && (
        <VideoPromptModal 
            imageSrc={selectedImage.dataUrl} 
            onClose={() => setShowVideoPromptModal(false)} 
            t={t} 
            lang={lang} 
            userCredits={userProfile?.credits || 0}
            onDeductCredits={handleDeductCredits}
        />
      )}
      {showPermissionHelp && <PermissionErrorModal onClose={() => setShowPermissionHelp(false)} />}
      
      {isLayoutEditorOpen && <LayoutEditor onComplete={handleLayoutComplete} onClose={() => setIsLayoutEditorOpen(false)} t={t} />}
      {editingImage && (
        <PhotoEditor 
            image={editingImage} 
            onSave={handleSavePhotoEditor} 
            onClose={() => setEditingImage(null)} 
            t={t} 
            userCredits={userProfile?.credits || 0}
            onDeductCredits={handleDeductCredits}
        />
      )}

      <div className="container mx-auto p-4 lg:p-8">
        <header className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="text-center md:text-left">
                <h1 className="text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
                    {t('title')} 
                    <span className="text-xs bg-green-900 text-green-200 px-2 py-1 rounded border border-green-700 align-middle ml-2 font-bold shadow-sm animate-pulse">
                        PRO 3
                    </span>
                </h1>
                <p className="text-gray-400 mt-2">{t('subtitle')} (Gemini 3 Powered)</p>
            </div>
            
            <div className="flex items-center gap-4 bg-gray-800 p-3 rounded-xl border border-gray-700">
                <div className="flex flex-col items-end">
                    <span className="text-xs text-gray-400">{userProfile?.email}</span>
                    <span className="text-sm font-bold text-yellow-400 flex items-center gap-1">
                        <SparklesIcon className="w-4 h-4" /> {userProfile?.credits || 0} {t('creditsLabel')}
                    </span>
                    {/* Display Key ID for verification */}
                    <span className="text-[10px] text-gray-500 font-mono mt-1" title="Active Key ID">
                        v3.4 | Key: {getKeyId()}
                    </span>
                </div>
                <button onClick={() => logout()} className="text-xs bg-red-900/50 hover:bg-red-900 text-red-200 px-2 py-1 rounded">
                    {t('logoutButton')}
                </button>
                <div className="flex gap-2 border-l border-gray-600 pl-4 items-center">
                    <button onClick={() => setLang('en')} className={`px-2 py-1 text-xs rounded-md ${lang === 'en' ? 'bg-purple-600 text-white' : 'bg-gray-700'}`}>EN</button>
                    <button onClick={() => setLang('zh')} className={`px-2 py-1 text-xs rounded-md ${lang === 'zh' ? 'bg-purple-600 text-white' : 'bg-gray-700'}`}>中文</button>
                </div>
            </div>
        </header>

        {userProfile?.isAdmin && (
            <div className="mb-6 bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg">
                <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsAdminPanelOpen(!isAdminPanelOpen)}>
                    <h3 className="font-bold text-blue-300 flex items-center gap-2"><UserCircleIcon className="w-5 h-5"/> {t('adminPanelTitle')}</h3>
                    <span className="text-xl">{isAdminPanelOpen ? '−' : '+'}</span>
                </div>
                {isAdminPanelOpen && (
                    <div className="mt-4 animate-fade-in">
                        <AdminUserList t={t} onCreditsUpdated={refreshUserProfile} />
                    </div>
                )}
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col gap-4 bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700">
             <div className="flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-bold text-gray-300">
                    {apiResult.imageUrl && !loading ? t('resultTitle') : t('canvasTitle')}
                  </h2>
                  {!apiResult.imageUrl && !loading && selectedImage && (
                        <ZoomControls 
                            zoom={zoom} 
                            onZoomChange={setZoom} 
                            onFit={fitImageToScreen} 
                            t={t} 
                            isPanMode={isPanMode}
                            onTogglePan={() => setIsPanMode(!isPanMode)}
                        />
                  )}
              </div>

              {apiResult.imageUrl && !loading && (
                <button onClick={handleClearResult} className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg">
                    <RedrawIcon className="w-4 h-4"/> {t('backToEditorButton')}
                </button>
              )}
            </div>

            {apiResult.imageUrl || loading ? (
                 <ResultDisplay
                    loading={loading}
                    error={error}
                    apiResult={apiResult}
                    t={t}
                    onEditResult={handleEditResult}
                    onUpdateResult={(url) => setApiResult(prev => ({ ...prev, imageUrl: url }))}
                    originalImageSrc={selectedImage?.dataUrl || null}
                 />
            ) : (
                 <div className={`relative w-full aspect-[4/3] bg-gray-900 rounded-lg overflow-hidden border-2 border-dashed border-gray-700 group ${isPanMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}>
                    <div 
                        ref={imageContainerRef}
                        className="w-full h-full flex items-center justify-center overflow-hidden touch-none"
                        onMouseDown={onMouseDown}
                        onMouseMove={onMouseMove}
                        onMouseUp={() => setIsPanning(false)}
                        onMouseLeave={() => setIsPanning(false)}
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                    >
                    {!selectedImage ? (
                        <div className="flex flex-col items-center text-gray-500 cursor-pointer hover:text-gray-400 transition-colors" onClick={handleUploadClick}>
                            <UploadIcon className="w-16 h-16 mb-4" />
                            <p className="text-lg font-medium">{t('uploadTitle')}</p>
                            <p className="text-sm">{t('uploadSubtitle')}</p>
                        </div>
                    ) : (
                        <div style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`, transition: isPanning || pinchStartRef.current ? 'none' : 'transform 0.1s ease-out' }} className="relative">
                            <CanvasEditor
                                ref={canvasRef}
                                imageSrc={selectedImage.dataUrl}
                                brushSize={brushSize}
                                brushColor={brushColor}
                                enableDrawing={!isPanMode}
                            />
                        </div>
                    )}
                    </div>
                     <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        multiple
                        className="hidden"
                    />
                </div>
            )}

            {!apiResult.imageUrl && (
                <Toolbar
                    brushSize={brushSize}
                    onBrushSizeChange={setBrushSize}
                    brushColor={brushColor}
                    onBrushColorChange={setBrushColor}
                    onClear={() => canvasRef.current?.reset()}
                    t={t}
                />
            )}
            
            <ThumbnailManager
                images={uploadedImages}
                selectedImageId={selectedImageId}
                onSelect={handleImageSelect}
                onDelete={handleImageDelete}
                onAddImage={handleUploadClick}
                onReorder={handleImageReorder}
                onEdit={handleOpenPhotoEditor}
                onOpenWatermarkGenerator={() => setShowWatermarkModal(true)}
                t={t}
            />
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 flex flex-col gap-4">
                 <div className="flex justify-between items-center">
                    <label className="block text-sm font-medium text-gray-300">
                        <span className="flex items-center gap-2">
                            <SparklesIcon className="w-4 h-4 text-purple-400" />
                            {t('promptLabel')}
                        </span>
                    </label>
                    <div className="flex gap-2">
                        {selectedImage && (
                            <button
                                onClick={() => setShowVideoPromptModal(true)}
                                className="text-xs bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-full transition-all flex items-center gap-1"
                                title={t('videoPromptButton')}
                            >
                                <VideoCameraIcon className="w-4 h-4"/> {t('videoPromptButton')}
                            </button>
                        )}
                        <button
                            onClick={handleRefinePrompt}
                            disabled={!prompt || isRefining}
                            className="text-xs bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-full transition-all flex items-center gap-1 disabled:opacity-50"
                        >
                            {isRefining ? t('refiningButton') : t('enhancePromptButton')}
                        </button>
                    </div>
                </div>
                
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={selectedImage ? t('promptPlaceholder') : t('textToImagePromptPlaceholder')}
                className="w-full h-32 p-4 bg-gray-900 border border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-gray-200 placeholder-gray-500 transition-all text-sm leading-relaxed"
              />
              
              {!selectedImage && (
                   <p className="text-xs text-gray-500 italic">
                        {t('textToImagePromptHelperText')}
                   </p>
              )}
               {selectedImage && (
                   <p className="text-xs text-gray-500 italic">
                        {t('promptHelperText')}
                   </p>
              )}

              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">{t('aspectRatioLabel')}</label>
                      <select
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2.5"
                      >
                         <option value="1:1">{t('ratio11')}</option>
                         <option value="3:2">{t('ratio32')}</option>
                         <option value="4:3">{t('ratio43')}</option>
                         <option value="16:9">{t('ratio169')}</option>
                         <option value="2:3">{t('ratio23')}</option>
                         <option value="3:4">{t('ratio34')}</option>
                         <option value="9:16">{t('ratio916')}</option>
                      </select>
                  </div>
                  {!selectedImage && (
                      <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">{t('resolutionLabel')}</label>
                          <select
                            value={resolution}
                            onChange={(e) => setResolution(e.target.value as ImageResolution)}
                            className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2.5"
                          >
                             <option value="1K">1K</option>
                             <option value="2K">2K</option>
                          </select>
                      </div>
                  )}
              </div>
              <div className="text-right mt-1">
                   <span className="text-xs text-yellow-500 font-bold">
                       {t('cost1K')}
                   </span>
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading || (!selectedImage && !prompt)}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2
                  ${loading 
                    ? 'bg-gray-600 cursor-not-allowed text-gray-400' 
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
                  }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('generatingButton')}
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-6 h-6" />
                    {t('generateButton')}
                  </>
                )}
              </button>

              {warning && (
                  <div className="p-3 bg-yellow-900/30 border border-yellow-500/50 rounded-xl text-yellow-200 text-sm animate-fade-in">
                      <p className="font-bold flex items-center gap-2">
                          <span className="text-xl">⚠️</span> Note / 備註
                      </p>
                      <p className="mt-1 mb-2">{warning}</p>
                  </div>
              )}

              {error && (
                <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-xl text-red-200 text-sm">
                  <div className="flex justify-between items-start">
                      <div>
                          <p className="font-bold flex items-center gap-2">
                            <span className="text-xl">⚠️</span> {t('errorTitle')}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap">{error}</p>
                      </div>
                      <button onClick={() => setError(null)} className="text-red-400 hover:text-white"><CloseIcon className="w-5 h-5"/></button>
                  </div>
                   
                   {/* Rate Limit Retry Button - Check for rate limit keywords */}
                   {(error.includes('Rate Limit') || error.includes('429') || error.includes('系統忙碌')) && (
                       <button onClick={handleGenerate} className="mt-2 flex items-center gap-1 text-xs bg-red-700 hover:bg-red-600 px-3 py-1.5 rounded text-white font-bold transition-colors shadow-sm">
                           <RefreshIcon className="w-3 h-3" /> Retry / 重試
                       </button>
                   )}
                </div>
              )}
            </div>

            <div className="bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 flex-grow overflow-y-auto max-h-[500px]">
                 <QuickPrompts
                    prompts={allQuickPrompts}
                    onPromptClick={setPrompt}
                    onPromptsChange={setAllQuickPrompts}
                    t={t}
                />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;