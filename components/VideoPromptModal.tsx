






import React, { useState } from 'react';
import type { TFunction } from '../types';
import { CloseIcon, VideoCameraIcon, SparklesIcon, SaveIcon, RefreshIcon, ArrowRightIcon } from './Icons';
import { generateVideoPrompt, type VideoPromptResultScheme } from '../services/geminiService';

interface VideoPromptModalProps {
    imageSrc: string;
    onClose: () => void;
    t: TFunction;
    lang: 'en' | 'zh';
    userCredits: number;
    onDeductCredits: (amount: number) => void;
}

const SCHEME_COLORS = [
    { border: 'border-blue-500/30', bg: 'bg-blue-900/10', title: 'text-blue-200' },
    { border: 'border-green-500/30', bg: 'bg-green-900/10', title: 'text-green-200' },
    { border: 'border-pink-500/30', bg: 'bg-pink-900/10', title: 'text-pink-200' },
];

export const VideoPromptModal: React.FC<VideoPromptModalProps> = ({ imageSrc, onClose, t, lang, userCredits, onDeductCredits }) => {
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<VideoPromptResultScheme[]>([]);
    
    // Inputs
    const [userInput, setUserInput] = useState('');
    const [camera, setCamera] = useState('vp_cam_none');
    
    // UI Helpers
    const [copyState, setCopyState] = useState<string | null>(null);

    const handleGenerate = async () => {
        const cost = 5;
        if (userCredits < cost) {
            alert(t('notEnoughCredits'));
            return;
        }

        setLoading(true);
        setResults([]);
        
        try {
            const [header, base64Data] = imageSrc.split(',');
            const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
            
            const params = {
                userInput: userInput,
                camera: t(camera as any),
            };

            const data = await generateVideoPrompt({ base64Data, mimeType }, params, lang);
            
            if (data && data.length > 0) {
                setResults(data);
                onDeductCredits(cost);
            } else {
                alert("生成失敗，請重試 (Generation Failed)");
            }
        } catch (e) {
            console.error(e);
            alert("Error generating prompts. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopyState(id);
        setTimeout(() => setCopyState(null), 2000);
    };

    const QuickChip = ({ text }: { text: string }) => (
        <button 
            onClick={() => setUserInput(text)}
            className="text-[10px] sm:text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded-md transition-colors truncate max-w-[150px]"
        >
            {text}
        </button>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-hidden">
            <div className="w-full h-full max-w-7xl flex flex-col bg-[#0f111a] rounded-xl shadow-2xl overflow-hidden border border-gray-800">
                
                {/* Header */}
                <div className="p-6 pb-2 flex justify-between items-start bg-gradient-to-b from-[#1a1d2d] to-[#0f111a]">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-2">
                            {t('vp_header')}
                        </h1>
                        <p className="text-gray-400 text-sm md:text-base max-w-2xl">
                            {t('vp_subheader')}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
                        <CloseIcon className="w-8 h-8 text-gray-400 hover:text-white" />
                    </button>
                </div>

                <div className="flex-grow flex flex-col lg:flex-row overflow-hidden">
                    {/* Left: Preview & Controls */}
                    <div className="w-full lg:w-1/3 p-6 flex flex-col gap-6 overflow-y-auto border-r border-gray-800/50 bg-[#0f111a]">
                        
                        {/* Image Preview */}
                        <div className="relative group rounded-xl overflow-hidden border border-gray-700 bg-black aspect-video flex items-center justify-center">
                            <img src={imageSrc} alt="Reference" className="w-full h-full object-contain" />
                            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded">
                                已選圖片
                            </div>
                        </div>

                        {/* Input Controls */}
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between mb-1">
                                    <label className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                                        <SparklesIcon className="w-3 h-3 text-purple-400"/>
                                        {t('vp_userInput')}
                                    </label>
                                    <span className="text-xs text-gray-500">{t('quickPromptsLabel')}</span>
                                </div>
                                <textarea 
                                    value={userInput}
                                    onChange={(e) => setUserInput(e.target.value)}
                                    placeholder={t('vp_userInputPlaceholder')}
                                    className="w-full h-24 bg-[#1a1d2d] border border-gray-700 rounded-lg p-3 text-gray-200 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
                                />
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <QuickChip text={t('vp_chip1')} />
                                    <QuickChip text={t('vp_chip2')} />
                                    <QuickChip text={t('vp_chip3')} />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-semibold text-gray-300 block mb-2">{t('vp_camera')}</label>
                                <select 
                                    value={camera}
                                    onChange={(e) => setCamera(e.target.value)}
                                    className="w-full bg-[#1a1d2d] border border-gray-700 rounded-lg p-3 text-gray-200 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                >
                                    {['vp_cam_none', 'vp_cam_pan', 'vp_cam_tilt', 'vp_cam_zoom', 'vp_cam_orbit', 'vp_cam_dolly', 'vp_cam_fpv', 'vp_cam_follow', 'vp_cam_orbit_in', 'vp_cam_orbit_out'].map(c => (
                                        <option key={c} value={c}>{t(c as any)}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-4 bg-[#1a1d2d] p-3 rounded-lg border border-gray-700">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                                        <RefreshIcon className="w-4 h-4 text-gray-300"/>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-400">{t('vp_video_length')}</span>
                                        <span className="text-sm font-bold text-white">6 {t('vp_seconds')}</span>
                                    </div>
                                </div>
                                <div className="h-8 w-px bg-gray-600 mx-2"></div>
                                <button 
                                    onClick={handleGenerate}
                                    disabled={loading}
                                    className="flex-grow bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 px-6 rounded-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                                    ) : (
                                        <>
                                            <SparklesIcon className="w-5 h-5" />
                                            {t('vp_generate')}
                                        </>
                                    )}
                                </button>
                            </div>
                            <p className="text-right text-xs text-yellow-500 font-medium mt-1">{t('vp_cost')}</p>
                        </div>
                    </div>

                    {/* Right: Results Area */}
                    <div className="w-full lg:w-2/3 bg-[#0a0b10] p-6 overflow-y-auto">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="h-px flex-grow bg-gray-800"></div>
                            <h3 className="text-gray-400 text-sm uppercase tracking-widest font-semibold">{t('vp_result_title')}</h3>
                            <div className="h-px flex-grow bg-gray-800"></div>
                        </div>

                        {!loading && results.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50 min-h-[400px]">
                                <VideoCameraIcon className="w-24 h-24 mb-4 stroke-1" />
                                <p className="text-lg">Ready to Generate</p>
                            </div>
                        )}

                        {results.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {results.map((scheme, idx) => {
                                    const style = SCHEME_COLORS[idx % SCHEME_COLORS.length];
                                    const schemeTitleKey = `vp_scheme${idx + 1}` as any;
                                    
                                    return (
                                        <div key={idx} className={`relative flex flex-col rounded-2xl border ${style.border} ${style.bg} p-0 overflow-hidden transition-all hover:border-opacity-100 border-opacity-50 group`}>
                                            
                                            {/* Card Header */}
                                            <div className="p-4 border-b border-gray-700/30 backdrop-blur-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 opacity-70">
                                                        {t(schemeTitleKey).split('—')[0] || `Scheme ${idx+1}`}
                                                    </span>
                                                    <span className="bg-gray-800/80 text-gray-300 text-[10px] px-2 py-0.5 rounded-full border border-gray-600">6s</span>
                                                </div>
                                                <h3 className={`text-lg font-bold ${style.title} leading-tight mb-2`}>
                                                    {scheme.title}
                                                </h3>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {scheme.tags.map((tag, i) => (
                                                        <span key={i} className="text-[10px] bg-black/40 text-gray-300 px-2 py-1 rounded border border-white/5">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Content Sections */}
                                            <div className="p-4 space-y-5 flex-grow">
                                                
                                                {/* Visual */}
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-wide">
                                                        <VideoCameraIcon className="w-3 h-3" />
                                                        {t('vp_visual_prompt')}
                                                    </div>
                                                    <p className="text-gray-300 text-sm leading-relaxed font-light">
                                                        {scheme.visual_prompt}
                                                    </p>
                                                </div>

                                                {/* Camera */}
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-wide">
                                                        <RefreshIcon className="w-3 h-3" />
                                                        {t('vp_camera_atmos')}
                                                    </div>
                                                    <p className="text-gray-300 text-sm leading-relaxed font-light">
                                                        {scheme.camera_atmosphere}
                                                    </p>
                                                </div>

                                                {/* Audio */}
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-wide">
                                                        <SparklesIcon className="w-3 h-3" />
                                                        {t('vp_audio_prompt')}
                                                    </div>
                                                    <p className="text-gray-300 text-sm leading-relaxed font-light">
                                                        {scheme.audio_prompt}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Footer Actions */}
                                            <div className="p-4 pt-0 mt-auto">
                                                <button 
                                                    onClick={() => handleCopy(`${scheme.visual_prompt}\n\nCamera: ${scheme.camera_atmosphere}\n\nAudio: ${scheme.audio_prompt}`, `full-${idx}`)}
                                                    className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold py-2 rounded-lg transition-all border border-gray-700 group-hover:border-gray-500"
                                                >
                                                    {copyState === `full-${idx}` ? (
                                                        <span className="text-green-400">{t('shareLinkCopied')}</span>
                                                    ) : (
                                                        <>
                                                            <SaveIcon className="w-3 h-3" />
                                                            {t('copyButton')}
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
