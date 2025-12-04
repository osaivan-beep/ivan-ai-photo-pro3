
import React, { useState } from 'react';
import type { TFunction } from '../types';
import { KeyIcon, ArrowRightIcon, SparklesIcon } from './Icons';

interface ApiKeyWelcomeModalProps {
    onSave: (apiKey: string) => void;
    t: TFunction;
}

export const ApiKeyWelcomeModal: React.FC<ApiKeyWelcomeModalProps> = ({ onSave, t }) => {
    const [inputKey, setInputKey] = useState('');

    const handleSave = () => {
        if (inputKey.trim().length > 10) {
            onSave(inputKey.trim());
        } else {
            alert("請輸入有效的 Google Gemini API Key (通常以 AIza 開頭)");
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/95 backdrop-blur-md animate-fade-in">
            <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-purple-500/30 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-6 text-center">
                    <div className="inline-block p-3 bg-white/10 rounded-full mb-4">
                        <SparklesIcon className="w-10 h-10 text-yellow-300" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">建立您的專屬 AI 引擎</h2>
                    <p className="text-purple-200 text-sm">Bring Your Own Key (BYOK)</p>
                </div>
                
                <div className="p-8 space-y-6">
                    <div className="text-gray-300 text-sm leading-relaxed">
                        <p className="mb-4">
                            歡迎使用 Ivan Ai Photo！為了提供最先進的 AI 繪圖與修圖功能，本平台採用<strong>去中心化模式</strong>。
                        </p>
                        <p className="mb-4">
                            您需要輸入自己的 <strong>Google Gemini API Key</strong>。這讓您可以直接連結 Google 伺服器，速度更快、更安全，且無需擔心共用額度問題。
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-gray-400 pl-2 text-xs">
                            <li>完全免費 (使用 Google 提供的免費層級)</li>
                            <li>您的 Key 僅儲存在您的瀏覽器中</li>
                            <li>我們不會(也無法)儲存或查看您的 Key</li>
                        </ul>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">第一步：免費取得金鑰</label>
                        <a 
                            href="https://aistudio.google.com/app/apikey" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-between w-full p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-blue-300 transition-colors text-sm group border border-gray-600 hover:border-blue-400"
                        >
                            <span>前往 Google AI Studio 申請</span>
                            <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </a>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">第二步：貼上金鑰</label>
                        <div className="relative">
                            <KeyIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                            <input 
                                type="text" 
                                value={inputKey}
                                onChange={(e) => setInputKey(e.target.value)}
                                placeholder="在此貼上 API Key (AIza...)"
                                className="w-full bg-gray-900 text-white pl-10 pr-4 py-3 rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none transition-all"
                            />
                        </div>
                    </div>

                    <button 
                        onClick={handleSave}
                        disabled={inputKey.length < 10}
                        className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-xl shadow-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        啟動 AI 引擎
                    </button>
                </div>
            </div>
        </div>
    );
};
