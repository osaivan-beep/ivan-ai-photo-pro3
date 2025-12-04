


import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { TFunction } from '../types';
import { CloseIcon, SparklesIcon, DownloadIcon, TextIcon, SaveIcon, TrashIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon, ArrowDownIcon } from './Icons';
import { generatePoeticText } from '../services/geminiService';

interface WatermarkModalProps {
    onClose: () => void;
    onUseImage: (dataUrl: string) => void;
    t: TFunction;
    userCredits: number;
    onDeductCredits: (amount: number) => void;
}

const FONTS = [
    // Chinese
    { name: '宋體', value: '"Noto Serif SC", serif' },
    { name: '黑體', value: '"Noto Sans SC", sans-serif' },
    { name: '馬善政', value: '"Ma Shan Zheng", cursive' },
    { name: '志莽行', value: '"Zhi Mang Xing", cursive' },
    { name: '龍藏體', value: '"Long Cang", cursive' },
    { name: '快樂體', value: '"ZCOOL KuaiLe", cursive' },
    { name: '流澗毛草', value: '"Liu Jian Mao Cao", cursive' },
    { name: '站酷小薇', value: '"ZCOOL XiaoWei", serif' },
    { name: '慶科黃油', value: '"ZCOOL QingKe HuangYou", sans-serif' },
    { name: '楷體', value: 'KaiTi, "KaiTi", serif' },
    
    // English / Handwriting
    { name: 'Lobster', value: '"Lobster", cursive' },
    { name: 'Caveat', value: '"Caveat", cursive' },
    { name: 'Pacifico', value: '"Pacifico", cursive' },
    { name: 'Dancing', value: '"Dancing Script", cursive' },
    { name: 'Vibes', value: '"Great Vibes", cursive' },
    { name: 'Sacramento', value: '"Sacramento", cursive' },
    { name: 'Indie', value: '"Indie Flower", cursive' },
    { name: 'Shadows', value: '"Shadows Into Light", cursive' },
    { name: 'Amatic', value: '"Amatic SC", cursive' },
    { name: 'Courgette', value: '"Courgette", cursive' },
];

const POETS = [
    // --- 10 Chinese Poets ---
    '李白 (浪漫豪放 - Li Bai)',
    '杜甫 (沉鬱頓挫 - Du Fu)',
    '王維 (空靈禪意 - Wang Wei)',
    '蘇軾 (豪邁豁達 - Su Shi)',
    '李清照 (婉約淒美 - Li Qingzhao)',
    '徐志摩 (現代浪漫 - Xu Zhimo)',
    '林徽因 (清新雋永 - Lin Huiyin)',
    '戴望舒 (雨巷詩人 - Dai Wangshu)',
    '席慕蓉 (溫柔抒情 - Xi Murong)',
    '余光中 (鄉愁詩人 - Yu Guangzhong)',
    
    // --- 10 Western/World Poets ---
    'William Shakespeare (Sonnet - 莎士比亞)',
    'Emily Dickinson (Introspective - 狄金生)',
    'Robert Frost (Nature & Realism - 佛洛斯特)',
    'Walt Whitman (Free Verse - 惠特曼)',
    'Edgar Allan Poe (Gothic - 愛倫坡)',
    'Pablo Neruda (Passion - 聶魯達)',
    'Rabindranath Tagore (Mystic - 泰戈爾)',
    'Rumi (Sufi Mystic - 魯米)',
    'Oscar Wilde (Aestheticism - 王爾德)',
    'Charles Baudelaire (Symbolism - 波特萊爾)',
];

const PRESET_COLORS = ['#D7261E', '#000000', '#FFFFFF', '#D4AF37', '#1E3A8A', '#064E3B', '#5B21B6', '#B91C1C'];

interface SavedTemplate {
    id: string;
    name: string;
    width: number;
    height: number;
    fontSizePercent: number;
    spacing: number;
    noise: number;
    borderThickness: number;
    showBorder: boolean;
    color: string;
    font: string;
    style: 'yin' | 'yang' | 'signature';
    shape: 'square' | 'circle' | 'oval';
    layout: 'grid' | 'single';
    direction: 'vertical' | 'horizontal';
    alignment: 'start' | 'center' | 'end';
}

export const WatermarkModal: React.FC<WatermarkModalProps> = ({ onClose, onUseImage, t, userCredits, onDeductCredits }) => {
    // Mode: 'editor' or 'ai-generator'
    const [mode, setMode] = useState<'editor' | 'ai-generator'>('editor');

    // Editor State
    const [text, setText] = useState('伊凡水墨');
    const [width, setWidth] = useState(300);
    const [height, setHeight] = useState(350);
    const [fontSizePercent, setFontSizePercent] = useState(90); // %
    const [spacing, setSpacing] = useState(10); // px
    const [noise, setNoise] = useState(0); // %
    const [borderThickness, setBorderThickness] = useState(6);
    const [showBorder, setShowBorder] = useState(false);
    const [color, setColor] = useState('#D7261E'); // Default Red for seals
    
    const [font, setFont] = useState(FONTS[2].value); // Ma Shan Zheng
    const [style, setStyle] = useState<'yin' | 'yang' | 'signature'>('yin');
    const [shape, setShape] = useState<'square' | 'circle' | 'oval'>('square');
    const [layout, setLayout] = useState<'grid' | 'single'>('grid'); // Grid = Auto/Multiline
    const [direction, setDirection] = useState<'vertical' | 'horizontal'>('vertical');
    const [alignment, setAlignment] = useState<'start' | 'center' | 'end'>('center');

    // User Templates State
    const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>(() => {
        try {
            const stored = localStorage.getItem('ivan-watermark-templates');
            return stored ? JSON.parse(stored) : [];
        } catch(e) { return []; }
    });

    const canvasRef = useRef<HTMLCanvasElement>(null);

    // AI Generator State
    const [refImage, setRefImage] = useState<string | null>(null);
    const [writerStyle, setWriterStyle] = useState(POETS[0]);
    const [language, setLanguage] = useState('純中文 (只產出中文)');
    const [generatedText, setGeneratedText] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    // Initial Draw
    useEffect(() => {
        drawSeal();
    }, [text, width, height, fontSizePercent, spacing, noise, borderThickness, showBorder, color, font, style, shape, layout, direction, alignment]);

    const drawSeal = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set high resolution for rendering
        const scale = 2; 
        canvas.width = width * scale;
        canvas.height = height * scale;
        ctx.scale(scale, scale);

        // Clear
        ctx.clearRect(0, 0, width, height);

        // 1. Draw Background & Clip Shape
        if (style !== 'signature') {
            ctx.beginPath();
            if (shape === 'square') {
                const r = 4;
                ctx.moveTo(r, 0);
                ctx.lineTo(width - r, 0);
                ctx.quadraticCurveTo(width, 0, width, r);
                ctx.lineTo(width, height - r);
                ctx.quadraticCurveTo(width, height, width - r, height);
                ctx.lineTo(r, height);
                ctx.quadraticCurveTo(0, height, 0, height - r);
                ctx.lineTo(0, r);
                ctx.quadraticCurveTo(0, 0, r, 0);
            } else if (shape === 'circle') {
                ctx.arc(width / 2, height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
            } else if (shape === 'oval') {
                ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
            }
            ctx.clip();
        }

        // 2. Styles (Colors & Borders)
        if (style === 'yin') {
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = '#ffffff'; 
        } else if (style === 'yang') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0)'; 
            ctx.clearRect(0,0,width,height); 
            ctx.fillStyle = color; 
            if (showBorder) {
                ctx.lineWidth = borderThickness;
                ctx.strokeStyle = color;
                ctx.stroke();
            }
        } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0)';
            ctx.clearRect(0,0,width,height);
            ctx.fillStyle = color;
        }

        // 3. Prepare Text Layout with Auto-Wrap Logic
        let lines: string[] = [];
        const cleanedText = text.trim();

        if (layout === 'single') {
             lines = [cleanedText.replace(/\n/g, ' ')];
        } else {
            // Grid / Auto Wrap Logic
            if (cleanedText.includes('\n')) {
                // Respect manual newlines
                lines = cleanedText.split('\n');
            } else {
                // Auto-flow logic
                const chars = Array.from(cleanedText);
                const totalChars = chars.length;
                if (totalChars === 0) {
                    lines = [""];
                } else {
                    const ar = width / height;
                    if (direction === 'vertical') {
                        // Calculate optimal columns for vertical layout
                        let cols = Math.round(Math.sqrt(totalChars * ar));
                        cols = Math.max(1, cols);
                        const charsPerCol = Math.ceil(totalChars / cols);
                        
                        for (let i = 0; i < cols; i++) {
                            const start = i * charsPerCol;
                            if (start < totalChars) {
                                const end = Math.min(start + charsPerCol, totalChars);
                                lines.push(cleanedText.slice(start, end));
                            }
                        }
                    } else {
                        // Calculate optimal rows for horizontal layout
                        let rows = Math.round(Math.sqrt(totalChars / ar));
                        rows = Math.max(1, rows);
                        const charsPerRow = Math.ceil(totalChars / rows);
                        
                        for (let i = 0; i < rows; i++) {
                            const start = i * charsPerRow;
                            if (start < totalChars) {
                                const end = Math.min(start + charsPerRow, totalChars);
                                lines.push(cleanedText.slice(start, end));
                            }
                        }
                    }
                }
            }
        }
            
        if (lines.length > 1) lines = lines.filter(l => l.length > 0);
        if (lines.length === 0) lines = [""];

        // 4. Calculate Font Size
        const padding = style === 'signature' ? 10 : (showBorder ? borderThickness + 10 : 20);
        const safeWidth = width - padding * 2;
        const safeHeight = height - padding * 2;

        let baseFontSize = 40;

        if (direction === 'vertical') {
            const numCols = lines.length;
            const maxCharsInCol = Math.max(...lines.map(l => Array.from(l).length));
            const wPerCol = safeWidth / numCols;
            const hPerChar = safeHeight / maxCharsInCol;
            baseFontSize = Math.min(wPerCol, hPerChar) * (fontSizePercent / 100);
        } else {
            const numRows = lines.length;
            const maxCharsInRow = Math.max(...lines.map(l => Array.from(l).length));
            const hPerRow = safeHeight / numRows;
            const wPerChar = safeWidth / maxCharsInRow;
            baseFontSize = Math.min(hPerRow, wPerChar) * (fontSizePercent / 100);
        }
        
        baseFontSize = Math.max(10, baseFontSize);

        ctx.font = `${baseFontSize}px ${font}`;
        ctx.textBaseline = 'middle';
        
        // 5. Render Text with Alignment
        if (direction === 'vertical') {
            // Vertical Text: Columns right to left, Chars top to bottom
            const totalBlockWidth = lines.length * baseFontSize + (lines.length - 1) * spacing;
            const startX = (width + totalBlockWidth) / 2 - baseFontSize / 2;

            lines.forEach((line, lineIndex) => {
                const chars = Array.from(line);
                const totalColHeight = chars.length * baseFontSize + (chars.length - 1) * spacing;
                
                let startY;
                if (alignment === 'start') { // Top
                    startY = padding + baseFontSize / 2;
                } else if (alignment === 'end') { // Bottom
                    startY = height - padding - totalColHeight + baseFontSize / 2;
                } else { // Center
                    startY = (height - totalColHeight) / 2 + baseFontSize / 2;
                }
                
                const colX = startX - lineIndex * (baseFontSize + spacing);

                // For vertical, individual characters are centered horizontally in the column
                ctx.textAlign = 'center'; 

                chars.forEach((char, charIndex) => {
                    const charY = startY + charIndex * (baseFontSize + spacing);
                    ctx.fillText(char, colX, charY);
                });
            });

        } else {
            // Horizontal Text: Rows top to bottom
            const totalBlockHeight = lines.length * baseFontSize + (lines.length - 1) * spacing;
            const startY = (height - totalBlockHeight) / 2 + baseFontSize / 2;

            lines.forEach((line, lineIndex) => {
                const lineY = startY + lineIndex * (baseFontSize + spacing);
                
                let lineX;
                if (alignment === 'start') { // Left
                    ctx.textAlign = 'left';
                    lineX = padding;
                } else if (alignment === 'end') { // Right
                    ctx.textAlign = 'right';
                    lineX = width - padding;
                } else { // Center
                    ctx.textAlign = 'center';
                    lineX = width / 2;
                }

                ctx.fillText(line, lineX, lineY);
            });
        }

        // 6. Noise Effect (Aging)
        if (noise > 0 && style !== 'signature') {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            const noiseAmount = (noise / 100) * (width * height * 0.1); 
            for (let i = 0; i < noiseAmount; i++) {
                const x = Math.random() * width;
                const y = Math.random() * height;
                const size = Math.random() * 1.5;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    };

    const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => setRefImage(event.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleAiGenerate = async () => {
        const cost = 5;
        if (userCredits < cost) {
            alert(t('notEnoughCredits') + `\n(Need ${cost} credits)`);
            return;
        }

        setAiLoading(true);
        setGeneratedText('');
        try {
            let imagePart = undefined;
            if (refImage) {
                const [header, base64Data] = refImage.split(',');
                const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
                imagePart = { base64Data, mimeType };
            }

            const result = await generatePoeticText(writerStyle, language, imagePart);
            if (result) {
                setGeneratedText(result);
                onDeductCredits(cost);
            } else {
                setGeneratedText("生成失敗。請檢查網絡或重試。\n(Generation Failed)");
            }
        } catch (error) {
            console.error("AI Generation Error", error);
            setGeneratedText("發生錯誤 (Error)");
        } finally {
            setAiLoading(false);
        }
    };

    const applyTemplate = (tmpl: Partial<SavedTemplate>) => {
        if (tmpl.width) setWidth(tmpl.width);
        if (tmpl.height) setHeight(tmpl.height);
        if (tmpl.fontSizePercent) setFontSizePercent(tmpl.fontSizePercent);
        if (tmpl.spacing !== undefined) setSpacing(tmpl.spacing);
        if (tmpl.noise !== undefined) setNoise(tmpl.noise);
        if (tmpl.borderThickness) setBorderThickness(tmpl.borderThickness);
        if (tmpl.showBorder !== undefined) setShowBorder(tmpl.showBorder);
        if (tmpl.color) setColor(tmpl.color);
        if (tmpl.font) setFont(tmpl.font);
        if (tmpl.style) setStyle(tmpl.style);
        if (tmpl.shape) setShape(tmpl.shape);
        if (tmpl.layout) setLayout(tmpl.layout);
        if (tmpl.direction) setDirection(tmpl.direction);
        if (tmpl.alignment) setAlignment(tmpl.alignment);
    };

    const applyPreset = (type: 'yin-square' | 'sign-square' | 'sign-oval' | 'sign-square-2' | 'classic-round' | 'modern-tech' | 'vertical-calligraphy' | 'aged-seal') => {
        if (type === 'yin-square') {
            applyTemplate({ style:'yin', shape:'square', font: FONTS[2].value, layout:'grid', direction:'vertical', alignment:'center', color:'#D7261E', width:250, height:300, fontSizePercent:90, showBorder:false, noise:0 });
        } else if (type === 'sign-square') {
            applyTemplate({ style:'yang', shape:'square', font: FONTS[3].value, layout:'grid', direction:'vertical', alignment:'center', color:'#D7261E', width:250, height:300, fontSizePercent:90, showBorder:true, borderThickness:6, noise:0 });
        } else if (type === 'sign-oval') {
            applyTemplate({ style:'yang', shape:'oval', font: FONTS[4].value, layout:'grid', direction:'vertical', alignment:'center', color:'#D7261E', width:200, height:300, fontSizePercent:90, showBorder:true, borderThickness:6, noise:0 });
        } else if (type === 'sign-square-2') {
             applyTemplate({ style:'signature', shape:'square', font: FONTS[6].value, layout:'single', direction:'horizontal', alignment:'center', color:'#000000', width:300, height:100, fontSizePercent:90, noise:0 });
        } else if (type === 'classic-round') {
            applyTemplate({ style:'yang', shape:'circle', font: FONTS[0].value, layout:'grid', direction:'vertical', alignment:'center', color:'#B91C1C', width:300, height:300, fontSizePercent:85, showBorder:true, borderThickness:8, noise:5 });
        } else if (type === 'modern-tech') {
            applyTemplate({ style:'yang', shape:'square', font: FONTS[1].value, layout:'single', direction:'horizontal', alignment:'start', color:'#1E3A8A', width:350, height:100, fontSizePercent:80, showBorder:true, borderThickness:4, noise:0 });
        } else if (type === 'vertical-calligraphy') {
            applyTemplate({ style:'yang', shape:'square', font: FONTS[2].value, layout:'grid', direction:'vertical', alignment:'start', color:'#000000', width:120, height:400, fontSizePercent:90, showBorder:false, noise:0 });
        } else if (type === 'aged-seal') {
            applyTemplate({ style:'yin', shape:'square', font: FONTS[5].value, layout:'grid', direction:'vertical', alignment:'center', color:'#8B0000', width:280, height:280, fontSizePercent:95, showBorder:false, noise:40 });
        }
    };

    const handleDeleteTemplate = (id: string) => {
        if (!confirm(t('wm_confirmDelete'))) return;
        const updated = savedTemplates.filter(t => t.id !== id);
        setSavedTemplates(updated);
        localStorage.setItem('ivan-watermark-templates', JSON.stringify(updated));
    };
    
    const handleDownload = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const url = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = url;
            link.download = `watermark-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    if (mode === 'ai-generator') {
        return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/95 backdrop-blur-md">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col text-gray-800 max-h-[90vh]">
                     <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                             <SparklesIcon className="w-5 h-5 text-purple-600" />
                             {t('aiInspirationTitle')}
                        </h3>
                        <button onClick={() => setMode('editor')}><CloseIcon className="w-6 h-6 text-gray-400"/></button>
                     </div>
                     <div className="p-6 space-y-6 overflow-y-auto">
                         <div>
                             <label className="block text-sm font-semibold text-gray-700 mb-2">{t('uploadReferenceImage')}</label>
                             <div 
                                className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-50 bg-gray-100 overflow-hidden relative group transition-colors"
                                onClick={() => document.getElementById('ref-upload')?.click()}
                             >
                                 {refImage ? (
                                     <>
                                         <img src={refImage} className="w-full h-full object-cover opacity-90" />
                                         <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center text-white text-sm font-medium">
                                             更換圖片
                                         </div>
                                     </>
                                 ) : (
                                     <div className="text-gray-400 text-sm flex flex-col items-center gap-2">
                                         <span className="text-3xl font-light text-gray-300">+</span>
                                         <span>點擊上傳圖片</span>
                                     </div>
                                 )}
                                 <input id="ref-upload" type="file" className="hidden" onChange={handleRefImageUpload} accept="image/*" />
                             </div>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                             <div>
                                 <label className="block text-sm font-semibold text-gray-700 mb-2">{t('selectWriterStyle')}</label>
                                 <select className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 outline-none" value={writerStyle} onChange={e => setWriterStyle(e.target.value)}>
                                     {POETS.map(p => <option key={p} value={p}>{p}</option>)}
                                 </select>
                             </div>
                             <div>
                                 <label className="block text-sm font-semibold text-gray-700 mb-2">{t('selectLanguage')}</label>
                                 <select className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 outline-none" value={language} onChange={e => setLanguage(e.target.value)}>
                                     <option>純中文 (只產出中文)</option>
                                     <option>中英文 (同時產出中英文)</option>
                                 </select>
                             </div>
                         </div>
                         <button 
                            onClick={handleAiGenerate}
                            disabled={aiLoading}
                            className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-lg transition-all transform active:scale-95 flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                         >
                             {aiLoading ? (
                                 <>
                                    <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                                    AI 正在創作詩詞...
                                 </>
                             ) : (
                                 <>
                                    <SparklesIcon className="w-5 h-5"/>
                                    {t('startGenerate')} (消耗 5 點數)
                                 </>
                             )}
                         </button>
                         {generatedText && (
                             <div className="bg-gray-50 rounded-lg border border-gray-200 animate-fade-in flex flex-col overflow-hidden">
                                 <div className="p-3 bg-gray-100 border-b border-gray-200 text-xs text-gray-500 font-bold uppercase tracking-wider">
                                     生成結果
                                 </div>
                                 <div className="p-6 max-h-48 overflow-y-auto">
                                     <p className="text-center font-serif text-gray-800 text-lg leading-loose whitespace-pre-wrap">
                                         {generatedText}
                                     </p>
                                 </div>
                                 <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                                     <button onClick={() => setMode('editor')} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
                                         取消
                                     </button>
                                     <button 
                                        onClick={() => { 
                                            setText(generatedText); 
                                            setMode('editor'); 
                                            applyPreset('yin-square');
                                        }} 
                                        className="px-6 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-sm transition-colors"
                                     >
                                         {t('useThisText')}
                                     </button>
                                 </div>
                             </div>
                         )}
                     </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/95 backdrop-blur-sm overflow-hidden">
             <div className="bg-white w-full h-full md:max-w-6xl md:h-[90vh] md:rounded-xl shadow-2xl flex flex-col md:flex-row overflow-hidden relative">
                
                {/* Header for Mobile */}
                <div className="md:hidden p-4 border-b flex justify-between items-center bg-white flex-shrink-0 z-10">
                    <h3 className="font-bold text-gray-800">{t('watermarkTitle')}</h3>
                    <button onClick={onClose}><CloseIcon className="w-6 h-6 text-gray-600"/></button>
                </div>
                <button onClick={onClose} className="hidden md:block absolute top-4 right-4 z-20 bg-gray-100 p-2 rounded-full hover:bg-gray-200 shadow-sm"><CloseIcon className="w-6 h-6 text-gray-600"/></button>

                {/* Left Panel: Preview (Fixed at top on mobile) */}
                <div className="w-full h-[35vh] md:w-7/12 md:h-full p-4 md:p-8 bg-gray-50 flex flex-col items-center justify-center relative shadow-inner md:shadow-none flex-shrink-0 md:flex-shrink-1">
                    <div className="hidden md:block text-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-800 tracking-tight">{t('watermarkTitle')}</h2>
                    </div>
                    {/* Preview Canvas Area */}
                    <div className="w-full h-full flex items-center justify-center border border-gray-200 rounded-xl bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAADFJREFUOE9jZGBgEGHAD97gk2Y4QwMDFmF0WXD//3+G/////4ctJq8F6NYx4jUAAQYAdyY3wX7LP6IAAAAASUVORK5CYII=')] relative shadow-sm overflow-hidden">
                         <canvas ref={canvasRef} style={{ width: `${width}px`, height: `${height}px`, maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                         <span className="absolute bottom-2 right-2 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded shadow-sm">{width}px x {height}px</span>
                    </div>
                </div>

                {/* Right Panel: Settings (Scrollable) */}
                <div className="w-full flex-grow md:w-5/12 md:h-full bg-white border-t md:border-l border-gray-200 flex flex-col overflow-hidden">
                    {/* Header Desktop */}
                    <div className="hidden md:flex p-5 pr-16 border-b border-gray-200 justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-gray-800">{t('styleFineTuning')}</h3>
                    </div>
                    
                    <div className="flex-grow p-5 md:p-6 overflow-y-auto space-y-6 custom-scrollbar">
                        
                        {/* 1. Text Input Area (Moved here for mobile visibility) */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                            <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                                <label className="font-bold text-gray-700 flex items-center gap-2 text-sm">
                                    <TextIcon className="w-4 h-4 text-gray-500"/>
                                    {t('textContentEdit')}
                                </label>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setMode('ai-generator')} 
                                        className="text-xs bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 py-1.5 rounded-full flex items-center gap-1 hover:shadow-md transition-all active:scale-95 font-semibold"
                                    >
                                        <SparklesIcon className="w-3 h-3"/> {t('aiInspirationTitle')}
                                    </button>
                                </div>
                            </div>
                            <textarea 
                                className="w-full border border-gray-300 rounded-lg p-3 text-lg font-serif resize-none focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 transition-shadow leading-relaxed"
                                rows={3}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="輸入文字..."
                            />
                            {/* In-Editor Alignment Controls */}
                            <div className="flex justify-end mt-2">
                                 <div className="flex bg-gray-100 rounded-lg p-0.5 border border-gray-200">
                                     <button onClick={() => setAlignment('start')} className={`p-1.5 rounded-md transition-all ${alignment === 'start' ? 'bg-white shadow text-purple-600' : 'text-gray-400 hover:text-gray-600'}`} title={direction === 'vertical' ? t('alignTop') : t('alignLeft')}>
                                         {direction === 'vertical' ? <ArrowUpIcon className="w-3 h-3"/> : <ArrowLeftIcon className="w-3 h-3"/>}
                                     </button>
                                     <button onClick={() => setAlignment('center')} className={`p-1.5 rounded-md transition-all ${alignment === 'center' ? 'bg-white shadow text-purple-600' : 'text-gray-400 hover:text-gray-600'}`} title={t('alignCenter')}>
                                         <div className="w-2 h-2 rounded-full bg-current mx-auto opacity-70"></div>
                                     </button>
                                     <button onClick={() => setAlignment('end')} className={`p-1.5 rounded-md transition-all ${alignment === 'end' ? 'bg-white shadow text-purple-600' : 'text-gray-400 hover:text-gray-600'}`} title={direction === 'vertical' ? t('alignBottom') : t('alignRight')}>
                                         {direction === 'vertical' ? <ArrowDownIcon className="w-3 h-3"/> : <ArrowRightIcon className="w-3 h-3"/>}
                                     </button>
                                 </div>
                            </div>
                        </div>

                        {/* 2. Templates */}
                        <div>
                            {savedTemplates.length > 0 && (
                                <div className="mb-4">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">{t('wm_myTemplates')}</label>
                                    <div className="grid grid-cols-4 gap-3">
                                        {savedTemplates.map(tmpl => (
                                            <div key={tmpl.id} className="relative group">
                                                <button onClick={() => applyTemplate(tmpl)} className="w-full p-2 border rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all flex flex-col items-center gap-2">
                                                    <div className="w-8 h-8 rounded bg-gray-200 shadow-sm flex items-center justify-center text-xs font-bold text-gray-500">
                                                        {tmpl.name.charAt(0)}
                                                    </div>
                                                    <span className="text-[10px] text-gray-600 font-medium truncate w-full text-center">{tmpl.name}</span>
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tmpl.id); }}
                                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <TrashIcon className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">{t('wm_systemTemplates')}</label>
                            <div className="grid grid-cols-4 gap-3">
                                 <button onClick={() => applyPreset('yin-square')} className="group p-2 border rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all flex flex-col items-center gap-2">
                                     <div className="w-8 h-8 rounded bg-red-700 shadow-sm group-hover:scale-110 transition-transform"></div>
                                     <span className="text-[10px] text-gray-600 font-medium">陰刻方</span>
                                 </button>
                                 <button onClick={() => applyPreset('sign-square')} className="group p-2 border rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all flex flex-col items-center gap-2">
                                     <div className="w-8 h-8 rounded border-2 border-red-700 shadow-sm group-hover:scale-110 transition-transform"></div>
                                     <span className="text-[10px] text-gray-600 font-medium">陽刻方</span>
                                 </button>
                                 <button onClick={() => applyPreset('sign-oval')} className="group p-2 border rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all flex flex-col items-center gap-2">
                                     <div className="w-6 h-8 rounded-[1rem] border-2 border-red-700 shadow-sm group-hover:scale-110 transition-transform"></div>
                                     <span className="text-[10px] text-gray-600 font-medium">陽刻圓</span>
                                 </button>
                                 <button onClick={() => applyPreset('sign-square-2')} className="group p-2 border rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all flex flex-col items-center gap-2">
                                     <div className="w-10 h-6 bg-black rounded-sm shadow-sm group-hover:scale-110 transition-transform"></div>
                                     <span className="text-[10px] text-gray-600 font-medium">手寫</span>
                                 </button>
                                 
                                 <button onClick={() => applyPreset('classic-round')} className="group p-2 border rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all flex flex-col items-center gap-2">
                                     <div className="w-8 h-8 rounded-full border-2 border-red-800 shadow-sm group-hover:scale-110 transition-transform"></div>
                                     <span className="text-[10px] text-gray-600 font-medium">古典圓章</span>
                                 </button>
                                 <button onClick={() => applyPreset('modern-tech')} className="group p-2 border rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all flex flex-col items-center gap-2">
                                     <div className="w-10 h-6 border-2 border-blue-900 rounded-sm shadow-sm group-hover:scale-110 transition-transform"></div>
                                     <span className="text-[10px] text-gray-600 font-medium">現代科技</span>
                                 </button>
                                 <button onClick={() => applyPreset('vertical-calligraphy')} className="group p-2 border rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all flex flex-col items-center gap-2">
                                     <div className="w-4 h-10 bg-transparent border-r border-black border-dashed shadow-sm group-hover:scale-110 transition-transform"></div>
                                     <span className="text-[10px] text-gray-600 font-medium">直式書法</span>
                                 </button>
                                 <button onClick={() => applyPreset('aged-seal')} className="group p-2 border rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all flex flex-col items-center gap-2">
                                     <div className="w-8 h-8 bg-red-900 opacity-80 rounded-sm shadow-sm group-hover:scale-110 transition-transform" style={{backgroundImage: 'radial-gradient(#fff 10%, transparent 10%)', backgroundSize: '4px 4px'}}></div>
                                     <span className="text-[10px] text-gray-600 font-medium">做舊古印</span>
                                 </button>
                            </div>
                        </div>

                        {/* 3. Controls (Font, Color, Sliders) */}
                        <div className="space-y-6">
                            {/* Layout & Direction */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                     <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">{t('watermarkLayoutLabel')}</label>
                                     <div className="flex bg-gray-100 rounded-lg p-1">
                                         <button onClick={() => setLayout('grid')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${layout === 'grid' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{t('layoutGrid')}</button>
                                         <button onClick={() => setLayout('single')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${layout === 'single' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{t('layoutSingle')}</button>
                                     </div>
                                </div>
                                <div>
                                     <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">{t('watermarkDirectionLabel')}</label>
                                     <div className="flex bg-gray-100 rounded-lg p-1">
                                         <button onClick={() => setDirection('vertical')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${direction === 'vertical' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{t('dirVertical')}</button>
                                         <button onClick={() => setDirection('horizontal')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${direction === 'horizontal' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{t('dirHorizontal')}</button>
                                     </div>
                                </div>
                            </div>

                            {/* Font & Color */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">字型</label>
                                    <select 
                                        value={font} 
                                        onChange={(e) => setFont(e.target.value)}
                                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-purple-500 outline-none"
                                    >
                                        {FONTS.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">顏色</label>
                                    <div className="flex flex-wrap gap-3 items-center">
                                        {PRESET_COLORS.map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setColor(c)}
                                                className={`w-8 h-8 rounded-full shadow-sm transition-transform transform hover:scale-110 ${color === c ? 'ring-2 ring-offset-2 ring-purple-500' : ''}`}
                                                style={{ backgroundColor: c, border: c === '#FFFFFF' ? '1px solid #e5e7eb' : 'none' }}
                                            />
                                        ))}
                                        <div className="relative w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center overflow-hidden bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 cursor-pointer hover:opacity-90">
                                            <input 
                                                type="color" 
                                                value={color} 
                                                onChange={e => setColor(e.target.value)} 
                                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sliders */}
                            <div className="space-y-5">
                                {[
                                    { label: t('watermarkWidthLabel'), val: width, set: setWidth, min: 50, max: 800, unit: 'px' },
                                    { label: t('watermarkHeightLabel'), val: height, set: setHeight, min: 50, max: 800, unit: 'px' },
                                    { label: t('watermarkSizeLabel'), val: fontSizePercent, set: setFontSizePercent, min: 20, max: 150, unit: '%' },
                                    { label: t('watermarkSpaceLabel'), val: spacing, set: setSpacing, min: -20, max: 50, unit: 'px' },
                                    { label: t('watermarkNoiseLabel'), val: noise, set: setNoise, min: 0, max: 100, unit: '%' },
                                ].map((slider, idx) => (
                                    <div key={idx} className="group">
                                        <div className="flex justify-between mb-1.5 items-center">
                                            <span className="text-xs font-medium text-gray-600">{slider.label}</span>
                                            <div className="flex items-center gap-1">
                                                <input 
                                                    type="number" 
                                                    value={slider.val} 
                                                    onChange={(e) => slider.set(Number(e.target.value))}
                                                    className="w-12 text-xs bg-gray-100 border border-gray-300 rounded px-1 py-0.5 text-right focus:outline-none focus:border-purple-500 text-gray-900 font-bold"
                                                />
                                                <span className="text-xs text-gray-400 font-mono w-4">{slider.unit}</span>
                                            </div>
                                        </div>
                                        <input 
                                            type="range" 
                                            min={slider.min} max={slider.max} 
                                            value={slider.val} 
                                            onChange={e => slider.set(Number(e.target.value))}
                                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600 hover:accent-purple-700"
                                        />
                                    </div>
                                ))}
                            </div>
                            
                            {/* Border Settings */}
                            {style !== 'signature' && (
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={showBorder} onChange={e => setShowBorder(e.target.checked)} className="rounded text-purple-600 focus:ring-purple-500" />
                                            <span className="text-sm text-gray-700 font-medium">{t('watermarkBorderLabel')}</span>
                                        </label>
                                    </div>
                                    {showBorder && (
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-gray-500 whitespace-nowrap">{t('watermarkThicknessLabel')}</span>
                                            <input 
                                                type="range" 
                                                min="1" max="20" 
                                                value={borderThickness} 
                                                onChange={e => setBorderThickness(Number(e.target.value))} 
                                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                            />
                                            <div className="flex items-center gap-1">
                                                <input 
                                                    type="number" 
                                                    value={borderThickness} 
                                                    onChange={(e) => setBorderThickness(Number(e.target.value))}
                                                    className="w-10 text-xs bg-gray-100 border border-gray-300 rounded px-1 py-0.5 text-right focus:outline-none focus:border-purple-500 text-gray-900 font-bold"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Footer Buttons */}
                    <div className="p-5 bg-white border-t border-gray-200 flex gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] mt-auto flex-shrink-0">
                         <button onClick={handleDownload} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors flex justify-center items-center gap-2 border border-gray-300">
                             <DownloadIcon className="w-5 h-5"/> {t('downloadButton')}
                         </button>
                         <button onClick={() => {
                             if (canvasRef.current) onUseImage(canvasRef.current.toDataURL());
                         }} className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg transform active:scale-95">
                             {t('useThisText')}
                         </button>
                    </div>
                </div>
             </div>
        </div>
    );
};
