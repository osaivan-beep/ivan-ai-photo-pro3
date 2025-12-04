


import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { TFunction, UploadedImage, StringTranslationKeys } from '../types';
import { CloseIcon, DownloadIcon, SaveIcon, RedrawIcon, MirrorIcon, FlipVerticalIcon, CropIcon, ZoomInIcon, ZoomOutIcon, ArrowsPointingOutIcon, SwapVerticalIcon, TextIcon, TrashIcon, RotateIcon, ImageIcon, LightBrushIcon, UndoIcon, SharpenIcon, BlurIcon, EraserIcon, EyeIcon, BrushIcon, PlusIcon, EyeSlashIcon, SunIcon, MagicEraserIcon, SparklesIcon, SaturationIcon, ContrastIcon, FilmIcon, UserCircleIcon, CompareIcon, LeafIcon, ArrowUpIcon, ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, SplitViewIcon, RadialGradientIcon, LinearGradientIcon, InvertIcon } from './Icons';
import { LightBrushPanel, type LightBrushSettings, type LightBrushMode } from './LightBrushPanel';
import { editImageWithGemini } from '../services/geminiService';

interface PhotoEditorProps {
    image: UploadedImage;
    onSave: (id: string, dataUrl: string) => void;
    onClose: () => void;
    t: TFunction;
    userCredits: number;
    onDeductCredits: (amount: number) => void;
}

// Overlay Types
interface BaseOverlay {
    id: string;
    type: 'text' | 'image';
    x: number; // %
    y: number; // %
    width: number; // %
    height: number; // %
    rotation: number; // degrees
    opacity: number; // 0-100
    zIndex: number;
    templateId?: string; // Links an overlay instance to its source template
}

interface TextOverlay extends BaseOverlay {
    type: 'text';
    text: string;
    fontSize: number; // px, relative to view
    fontFamily: string;
    color: string;
    bold: boolean;
    italic: boolean;
}

interface ImageOverlay extends BaseOverlay {
    type: 'image';
    dataUrl: string;
    aspectRatio: number;
}

type Overlay = TextOverlay | ImageOverlay;

// The raw data for a stroke stored in history
interface RawBrushStroke {
    id: string;
    points: { x: number; y: number }[];
    settings: AdjustmentBrushSettings | { size: number; feather: number; strength: number; };
}

type MaskType = 'brush' | 'radial' | 'linear';

interface MaskLayer {
    id: string;
    name: string;
    isVisible: boolean;
    type: MaskType;
    strokes: RawBrushStroke[];
    gradient?: {
        start: { x: number, y: number }; // % for Linear (Start), Radial (Center)
        end: { x: number, y: number };   // % for Linear (End), Radial (Width/Radius Handle)
        radiusY?: number; // Aspect ratio for Radial (1 = circle)
        rotation?: number;
        feather: number;
    };
    invert: boolean;
    adjustments: Adjustments;
}

interface LightBrushStroke {
    id: string;
    points: { x: number; y: number }[];
    settings: LightBrushSettings;
}

const COLOR_CHANNELS = [
    { id: 'reds', labelKey: 'redsLabel', color: 'bg-red-500' },
    { id: 'oranges', labelKey: 'orangesLabel', color: 'bg-orange-500' },
    { id: 'yellows', labelKey: 'yellowsLabel', color: 'bg-yellow-500' },
    { id: 'greens', labelKey: 'greensLabel', color: 'bg-green-500' },
    { id: 'aquas', labelKey: 'aquasLabel', color: 'bg-cyan-500' },
    { id: 'blues', labelKey: 'bluesLabel', color: 'bg-blue-500' },
    { id: 'purples', labelKey: 'purplesLabel', color: 'bg-purple-500' },
    { id: 'magentas', labelKey: 'magentasLabel', color: 'bg-pink-500' },
] as const;

type ColorChannelId = typeof COLOR_CHANNELS[number]['id'];

type ColorMixerAdjustments = Record<ColorChannelId, { h: number; s: number; l: number }>;


const INITIAL_COLOR_MIXER: ColorMixerAdjustments = {
    reds: { h: 0, s: 0, l: 0 },
    oranges: { h: 0, s: 0, l: 0 },
    yellows: { h: 0, s: 0, l: 0 },
    greens: { h: 0, s: 0, l: 0 },
    aquas: { h: 0, s: 0, l: 0 },
    blues: { h: 0, s: 0, l: 0 },
    purples: { h: 0, s: 0, l: 0 },
    magentas: { h: 0, s: 0, l: 0 },
};


const INITIAL_ADJUSTMENTS = {
    enhance: 0,
    accent: 0,
    brightness: 0,
    exposure: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    vignette: 0,
    saturate: 0,
    vibrance: 0,
    temperature: 0,
    tint: 0,
    clarity: 0,
    dehaze: 0,
    blur: 0,
    colorMixer: INITIAL_COLOR_MIXER,
};

const INITIAL_TRANSFORMS = {
    rotate: 0,
    scaleX: 1,
    scaleY: 1,
};

const INITIAL_ADJUSTMENT_BRUSH_SETTINGS = {
    size: 50,
    feather: 80,
    strength: 50, // Opacity of the brush stroke
    isErasing: false,
    showMask: true,
};

const INITIAL_LIGHT_BRUSH_SETTINGS: LightBrushSettings = {
    size: 300,
    strength: 15,
    feather: 100,
    mode: 'increaseWhiteLight',
    color: '#ffffff',
};

type Adjustments = typeof INITIAL_ADJUSTMENTS;
type Transforms = typeof INITIAL_TRANSFORMS;
type AdjustmentBrushSettings = typeof INITIAL_ADJUSTMENT_BRUSH_SETTINGS;

const sharpenFilterSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;overflow:hidden;">
  <filter id="photo-editor-sharpen">
    <feGaussianBlur stdDeviation="0.8" in="SourceGraphic" result="blur" />
    <feComposite in="SourceGraphic" in2="blur" operator="arithmetic" k1="2.5" k2="-1.5" k3="0" k4="0" />
  </filter>
</svg>`;

const getDefaultTemplates = (): TextOverlay[] => {
    const baseStyle = {
      type: 'text' as const,
      rotation: 0,
      opacity: 80,
      color: '#FFFFFF',
      bold: false,
      italic: false,
      zIndex: 0,
    };
  
    return [
      {
        ...baseStyle,
        id: 'template-title',
        text: '日安^^',
        x: 5,
        y: 5,
        width: 45,
        height: 24,
        fontSize: 60,
        fontFamily: '"ZCOOL KuaiLe", cursive',
        color: '#F3E353',
        italic: true,
      },
      {
        ...baseStyle,
        id: 'template-info',
        text: '平安喜樂',
        x: 5, y: 45,
        width: 45, height: 15,
        fontSize: 48,
        fontFamily: '"Noto Sans SC", sans-serif',
        color: '#75FFD1',
        italic: true,
      },
      {
        ...baseStyle,
        id: 'template-signature',
        text: '伊凡 Ai photo',
        x: 65, y: 85,
        width: 30, height: 10,
        fontSize: 16,
        fontFamily: '"Times New Roman", serif',
        italic: true,
      },
    ];
  };

const renderWrappedTextOnCanvas = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
) => {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines: string[] = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
        let currentLine = '';
        const words = paragraph.split(' ');

        for (const word of words) {
            if (ctx.measureText(word).width > maxWidth) {
                if (currentLine.length > 0) {
                    lines.push(currentLine.trim());
                    currentLine = '';
                }
                let tempWordLine = '';
                for (const char of word) {
                    if (ctx.measureText(tempWordLine + char).width > maxWidth) {
                        lines.push(tempWordLine);
                        tempWordLine = char;
                    } else {
                        tempWordLine += char;
                    }
                }
                currentLine = tempWordLine;
            } else {
                const testLine = currentLine.length > 0 ? `${currentLine} ${word}` : word;
                if (ctx.measureText(testLine).width > maxWidth) {
                    lines.push(currentLine.trim());
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            }
        }
        if (currentLine.length > 0) {
            lines.push(currentLine.trim());
        }
    }

    const totalTextHeight = lines.length * lineHeight;
    const startY = y - totalTextHeight / 2;

    lines.forEach((line, index) => {
        const lineY = startY + index * lineHeight + lineHeight / 2;
        ctx.fillText(line, x, lineY);
    });
};


const AdjustmentSlider: React.FC<{ label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; resetValue: number; }> =
    ({ label, value, onChange, min = -100, max = 100, step = 1, resetValue }) => (
        <div>
            <div className="flex justify-between items-center mb-1">
                <label onDoubleClick={() => onChange(resetValue)} className="text-sm text-gray-300 cursor-pointer" title="Double click to reset">{label}</label>
                <span onDoubleClick={() => onChange(resetValue)} className="text-xs text-gray-400 font-mono bg-gray-700 px-2 py-0.5 rounded cursor-pointer" title="Double click to reset">{value}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
        </div>
    );

const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

interface OverlayRendererProps {
    overlay: Overlay;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onUpdate: (id: string, updates: Partial<Overlay>) => void;
    onInteractionStart: () => void;
    onInteractionEnd: () => void;
    isTextTabActive: boolean;
}

const OverlayRenderer: React.FC<OverlayRendererProps> = ({
    overlay,
    isSelected,
    onSelect,
    onUpdate,
    onInteractionStart,
    onInteractionEnd,
    isTextTabActive,
}) => {
    const interactionRef = useRef<{
        type: 'move' | 'resize' | 'rotate';
        startX: number;
        startY: number;
        startOverlay: Overlay;
        handle?: string;
        startAngle?: number;
        center?: { x: number; y: number };
        parentRect: DOMRect;
    } | null>(null);

    const handleInteractionStart = (e: React.MouseEvent | React.TouchEvent, type: 'move' | 'resize' | 'rotate', handle?: string) => {
        if (!isTextTabActive) return;
        e.preventDefault();
        e.stopPropagation();
        onInteractionStart();
        onSelect(overlay.id);
        
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const parent = (e.currentTarget as HTMLElement).closest('.photo-editor-canvas-container');
        if (!parent) return;
        const parentRect = parent.getBoundingClientRect();

        const baseInteraction = {
            type,
            startX: clientX,
            startY: clientY,
            startOverlay: overlay,
            handle,
            parentRect,
        };

        if (type === 'rotate') {
            const overlayEl = (e.currentTarget as HTMLElement).closest('.overlay-container');
            if (!overlayEl) return;
            const rect = overlayEl.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const startAngle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
            interactionRef.current = { ...baseInteraction, startAngle, center: { x: centerX, y: centerY } };
        } else {
            interactionRef.current = baseInteraction;
        }

        const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
            if (!interactionRef.current) return;
            
            const moveClientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const moveClientY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

            const { startX, startY, startOverlay, parentRect } = interactionRef.current;
            const dx = moveClientX - startX;
            const dy = moveClientY - startY;

            if (interactionRef.current.type === 'move') {
                onUpdate(overlay.id, {
                    x: startOverlay.x + (dx / parentRect.width) * 100,
                    y: startOverlay.y + (dy / parentRect.height) * 100,
                });
            } else if (interactionRef.current.type === 'resize' && interactionRef.current.handle) {
                let { x, y, width, height } = startOverlay;
                const rad = (startOverlay.rotation * Math.PI) / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);

                const dxPct = (dx / parentRect.width) * 100;
                const dyPct = (dy / parentRect.height) * 100;

                const rotatedDx = dxPct * cos + dyPct * sin;
                const rotatedDy = -dxPct * sin + dyPct * cos;

                const handle = interactionRef.current.handle;
                let dw = 0, dh = 0;

                if (handle.includes('r')) dw = rotatedDx;
                if (handle.includes('l')) dw = -rotatedDx;
                if (handle.includes('b')) dh = rotatedDy;
                if (handle.includes('t')) dh = -rotatedDy;

                if (overlay.type === 'image') {
                    const imageAspectRatio = overlay.aspectRatio;
                    const containerAspectRatio = parentRect.width / parentRect.height;
                    const percentageAspectRatio = imageAspectRatio / containerAspectRatio;
                    
                    if (handle.length === 2) {
                        if (Math.abs(dw) > Math.abs(dh * percentageAspectRatio)) {
                            dh = dw / percentageAspectRatio;
                        } else {
                            dw = dh * percentageAspectRatio;
                        }
                    } else {
                        if (handle.includes('t') || handle.includes('b')) {
                            dw = dh * percentageAspectRatio;
                        } else {
                            dh = dw / percentageAspectRatio;
                        }
                    }
                }

                width += dw;
                height += dh;

                x += (dw / 2) * cos - (dh / 2) * sin;
                y += (dw / 2) * sin + (dh / 2) * cos;

                onUpdate(overlay.id, { x, y, width, height });
            } else if (interactionRef.current.type === 'rotate' && interactionRef.current.center && interactionRef.current.startAngle !== undefined) {
                const { center, startAngle } = interactionRef.current;
                const currentAngle = Math.atan2(moveClientY - center.y, moveClientX - center.x) * (180 / Math.PI);
                const rotation = startOverlay.rotation + (currentAngle - startAngle);
                onUpdate(overlay.id, { rotation });
            }
        };

        const handleUp = () => {
            interactionRef.current = null;
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleUp);
            onInteractionEnd();
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleUp);
    };

    const overlayStyle: React.CSSProperties = {
        position: 'absolute',
        left: `${overlay.x}%`,
        top: `${overlay.y}%`,
        width: `${overlay.width}%`,
        height: `${overlay.height}%`,
        transform: `translate(-50%, -50%) rotate(${overlay.rotation}deg)`,
        opacity: overlay.opacity / 100,
        zIndex: overlay.zIndex,
        cursor: isTextTabActive ? 'move' : 'default',
        pointerEvents: isTextTabActive ? 'auto' : 'none',
        userSelect: 'none',
    };
    
    const HANDLES = ['tl', 'tr', 'bl', 'br'];
    const RESIZE_HANDLES = overlay.type === 'image' ? HANDLES : ['tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r'];


    return (
        <div
            className="overlay-container"
            style={overlayStyle}
            onMouseDown={(e) => handleInteractionStart(e, 'move')}
            onTouchStart={(e) => handleInteractionStart(e, 'move')}
            onClick={(e) => { e.stopPropagation(); if (isTextTabActive) onSelect(overlay.id); }}
        >
            {overlay.type === 'text' && (
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        fontSize: `${overlay.fontSize}px`,
                        fontFamily: overlay.fontFamily,
                        color: overlay.color,
                        fontWeight: overlay.bold ? 'bold' : 'normal',
                        fontStyle: overlay.italic ? 'italic' : 'normal',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                    }}
                    className="pointer-events-none"
                >
                    {overlay.text}
                </div>
            )}
            {overlay.type === 'image' && (
                <img
                    src={overlay.dataUrl}
                    alt="watermark"
                    draggable={false}
                    className="w-full h-full object-contain pointer-events-none"
                />
            )}
            {isSelected && isTextTabActive && (
                <>
                    <div className="absolute inset-0 border-2 border-purple-500 pointer-events-none" />
                    {RESIZE_HANDLES.map(handle => (
                        <div
                            key={handle}
                            className={`absolute w-6 h-6 bg-white rounded-full border border-purple-500
                                ${handle.includes('t') ? '-top-3' : ''} ${handle.includes('b') ? '-bottom-3' : ''}
                                ${handle.includes('l') ? '-left-3' : ''} ${handle.includes('r') ? '-right-3' : ''}
                                ${handle === 't' || handle === 'b' ? 'left-1/2 -translate-x-1/2' : ''}
                                ${handle === 'l' || handle === 'r' ? 'top-1/2 -translate-y-1/2' : ''}
                                `}
                            style={{
                                cursor: (handle === 'tl' || handle === 'br') ? 'nwse-resize' : 
                                        (handle === 'tr' || handle === 'bl') ? 'nesw-resize' :
                                        (handle === 't' || handle === 'b') ? 'ns-resize' : 'ew-resize'
                            }}
                            onMouseDown={(e) => handleInteractionStart(e, 'resize', handle)}
                            onTouchStart={(e) => handleInteractionStart(e, 'resize', handle)}
                        />
                    ))}
                    <div
                        className="absolute left-1/2 -bottom-10 w-8 h-8 bg-purple-500 rounded-full border-2 border-white cursor-grab flex items-center justify-center"
                        style={{ transform: 'translateX(-50%)' }}
                        onMouseDown={(e) => handleInteractionStart(e, 'rotate')}
                        onTouchStart={(e) => handleInteractionStart(e, 'rotate')}
                    >
                         <RotateIcon className="w-5 h-5 text-white" />
                    </div>
                </>
            )}
        </div>
    );
};

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
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
    return [h * 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    let r: number, g: number, b: number;
    
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        h /= 360;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

const COLOR_RANGES: Record<ColorChannelId, { center: number, range: number }> = {
    reds: { center: 0, range: 60 },
    oranges: { center: 30, range: 30 },
    yellows: { center: 60, range: 30 },
    greens: { center: 120, range: 90 },
    aquas: { center: 180, range: 30 },
    blues: { center: 225, range: 90 },
    purples: { center: 285, range: 30 },
    magentas: { center: 330, range: 60 }
};

const applyVibrance = (imageData: ImageData, vibrance: number) => {
    const data = imageData.data;
    const amount = vibrance / 50;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const [h, s, l] = rgbToHsl(r, g, b);

        if (s < 0.05) continue;

        let skinProtect = 1.0;
        if (h > 15 && h < 45) {
            const distFromSkinCenter = Math.abs(h - 30);
            skinProtect = Math.min(1.0, (distFromSkinCenter / 15.0) * 0.7 + 0.3);
        }

        const saturationBoost = amount * (1 - Math.pow(s, 2)) * skinProtect;
        const newS = Math.max(0, Math.min(1, s + saturationBoost));
        
        if (newS !== s) {
            const [newR, newG, newB] = hslToRgb(h, newS, l);
            data[i] = newR;
            data[i + 1] = newG;
            data[i + 2] = newB;
        }
    }
};

const applyColorMixer = (imageData: ImageData, colorMixer: ColorMixerAdjustments) => {
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const [h, s, l] = rgbToHsl(data[i], data[i+1], data[i+2]);
        if (s < 0.01) continue;

        let totalH = 0;
        let totalS = 0;
        let totalL = 0;

        for (const key in COLOR_RANGES) {
            const channel = key as ColorChannelId;
            const { center, range } = COLOR_RANGES[channel];
            
            let dist = Math.abs(h - center);
            if (dist > 180) {
                 dist = 360 - dist;
            }
            
            const influence = Math.max(0, 1 - (dist / (range / 2)));
            if (influence > 0) {
                totalH += colorMixer[channel].h * influence;
                totalS += (colorMixer[channel].s / 100) * influence;
                totalL += (colorMixer[channel].l / 100) * influence;
            }
        }
        
        const newH = (h + totalH + 360) % 360;
        const newS = Math.max(0, Math.min(1, s + totalS));
        const newL = Math.max(0, Math.min(1, l + totalL));

        const [r, g, b] = hslToRgb(newH, newS, newL);
        data[i] = r;
        data[i+1] = g;
        data[i+2] = b;
    }
};

const applyAdjustmentsToContext = (ctx: CanvasRenderingContext2D, adjustments: Adjustments, source: HTMLCanvasElement | HTMLImageElement) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const { enhance, accent, brightness, exposure, contrast, clarity, saturate, highlights, shadows, vignette, temperature, tint, blur, colorMixer, dehaze } = adjustments;
    const enhanceRatio = enhance / 100;
    const accentRatio = accent / 100;
    
    let baseShadows = shadows;
    let baseHighlights = highlights;

    baseShadows += accentRatio * 50;
    baseHighlights -= accentRatio * 40;

    const effectiveShadows = Math.max(-100, Math.min(100, baseShadows + enhanceRatio * 40));
    const effectiveHighlights = Math.max(-100, Math.min(100, baseHighlights + enhanceRatio * -30));
    
    const effectiveContrast = Math.max(-100, Math.min(100, contrast + enhanceRatio * 15 + (dehaze ?? 0) * 0.3));
    const effectiveSaturate = Math.max(-100, Math.min(100, saturate + enhanceRatio * 10 + (dehaze ?? 0) * 0.15));
    const effectiveClarity = Math.max(0, Math.min(10, clarity + enhanceRatio * 2));

    const filterList = [
        `brightness(${100 + brightness + exposure - ((dehaze ?? 0) * 0.1)}%)`,
        `contrast(${100 + effectiveContrast + (effectiveClarity * 2.5)}%)`,
        `saturate(${100 + effectiveSaturate}%)`,
    ];
    if (blur > 0) {
        filterList.push(`blur(${blur}px)`);
    }
    if (effectiveClarity > 5) {
        filterList.push('url(#photo-editor-sharpen)');
    }
    ctx.filter = filterList.join(' ');
    
    ctx.drawImage(source, 0, 0);
    ctx.filter = 'none';

    const isVibranceActive = adjustments.vibrance !== 0;
    const isColorMixerActive = Object.values(colorMixer).some(c => c.h !== 0 || c.s !== 0 || c.l !== 0);

    if (isVibranceActive || isColorMixerActive) {
        const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
        if (isVibranceActive) {
            applyVibrance(imageData, adjustments.vibrance);
        }
        if (isColorMixerActive) {
            applyColorMixer(imageData, colorMixer);
        }
        ctx.putImageData(imageData, 0, 0);
    }

    if (temperature !== 0) {
        ctx.globalCompositeOperation = 'overlay';
        if (temperature > 0) {
            ctx.fillStyle = `rgba(255, 165, 0, ${temperature / 250})`;
        } else {
            ctx.fillStyle = `rgba(0, 100, 255, ${-temperature / 250})`;
        }
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
    if (tint !== 0) {
        ctx.globalCompositeOperation = 'overlay';
        if (tint > 0) {
            ctx.fillStyle = `rgba(255, 0, 255, ${tint / 250})`;
        } else {
            ctx.fillStyle = `rgba(0, 255, 0, ${-tint / 250})`;
        }
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    if (effectiveHighlights !== 0) {
        ctx.globalCompositeOperation = 'soft-light';
        const alpha = Math.abs(effectiveHighlights) / 100;
        ctx.fillStyle = effectiveHighlights > 0 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
    if (effectiveShadows !== 0) {
        ctx.globalCompositeOperation = 'soft-light';
        const alpha = Math.pow(Math.abs(effectiveShadows) / 100, 1.5); 
        ctx.fillStyle = effectiveShadows > 0 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
    
    ctx.globalCompositeOperation = 'source-over';

    if (vignette > 0) {
        const outerRadius = Math.sqrt(Math.pow(ctx.canvas.width / 2, 2) + Math.pow(ctx.canvas.height / 2, 2));
        const gradient = ctx.createRadialGradient(
            ctx.canvas.width / 2, ctx.canvas.height / 2, outerRadius * (1 - vignette / 100),
            ctx.canvas.width / 2, ctx.canvas.height / 2, outerRadius
        );
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, `rgba(0,0,0,${vignette / 100 * 0.8})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
};

interface PanControlProps {
  onPan: (dx: number, dy: number) => void;
  panSpeed?: number;
}

const PanControl: React.FC<PanControlProps> = ({ onPan, panSpeed = 5 }) => {
  const panDirectionRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number | null>(null);

  const panLoop = useCallback(() => {
    if (panDirectionRef.current.x !== 0 || panDirectionRef.current.y !== 0) {
      onPan(panDirectionRef.current.x * panSpeed, panDirectionRef.current.y * panSpeed);
    }
    animationFrameRef.current = requestAnimationFrame(panLoop);
  }, [onPan, panSpeed]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(panLoop);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [panLoop]);

  const handleInteractionStart = (x: number, y: number) => (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    panDirectionRef.current = { x, y };
  };

  const handleInteractionEnd = () => (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    panDirectionRef.current = { x: 0, y: 0 };
  };

  return (
    <div 
        className="absolute bottom-4 right-4 z-20 w-40 h-40 grid grid-cols-3 grid-rows-3 gap-2"
        onMouseDown={e => e.stopPropagation()}
        onMouseUp={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
    >
      <div />
      <button
        onMouseDown={handleInteractionStart(0, -1)}
        onMouseUp={handleInteractionEnd()}
        onMouseLeave={handleInteractionEnd()}
        onTouchStart={handleInteractionStart(0, -1)}
        onTouchEnd={handleInteractionEnd()}
        className="bg-gray-800/80 rounded-full flex items-center justify-center text-white hover:bg-gray-700 active:bg-gray-600 transition-colors"
        aria-label="Pan Up"
      >
        <ArrowUpIcon className="w-8 h-8" />
      </button>
      <div />
      <button
        onMouseDown={handleInteractionStart(-1, 0)}
        onMouseUp={handleInteractionEnd()}
        onMouseLeave={handleInteractionEnd()}
        onTouchStart={handleInteractionStart(-1, 0)}
        onTouchEnd={handleInteractionEnd()}
        className="bg-gray-800/80 rounded-full flex items-center justify-center text-white hover:bg-gray-700 active:bg-gray-600 transition-colors"
        aria-label="Pan Left"
      >
        <ArrowLeftIcon className="w-8 h-8" />
      </button>
      <div />
      <button
        onMouseDown={handleInteractionStart(1, 0)}
        onMouseUp={handleInteractionEnd()}
        onMouseLeave={handleInteractionEnd()}
        onTouchStart={handleInteractionStart(1, 0)}
        onTouchEnd={handleInteractionEnd()}
        className="bg-gray-800/80 rounded-full flex items-center justify-center text-white hover:bg-gray-700 active:bg-gray-600 transition-colors"
        aria-label="Pan Right"
      >
        <ArrowRightIcon className="w-8 h-8" />
      </button>
      <div />
      <button
        onMouseDown={handleInteractionStart(0, 1)}
        onMouseUp={handleInteractionEnd()}
        onMouseLeave={handleInteractionEnd()}
        onTouchStart={handleInteractionStart(0, 1)}
        onTouchEnd={handleInteractionEnd()}
        className="bg-gray-800/80 rounded-full flex items-center justify-center text-white hover:bg-gray-700 active:bg-gray-600 transition-colors"
        aria-label="Pan Down"
      >
        <ArrowDownIcon className="w-8 h-8" />
      </button>
      <div />
    </div>
  );
};

const AdjustmentBrushPanel: React.FC<{
    settings: AdjustmentBrushSettings;
    onSettingsChange: React.Dispatch<React.SetStateAction<AdjustmentBrushSettings>>;
    maskLayers: MaskLayer[];
    onMaskLayersChange: React.Dispatch<React.SetStateAction<MaskLayer[]>>;
    activeMaskLayerId: string | null;
    onActiveMaskLayerIdChange: (id: string) => void;
    onUndo: () => void;
    t: TFunction;
    onUpdateGradient: (updates: Partial<NonNullable<MaskLayer['gradient']>>) => void;
}> = ({ settings, onSettingsChange, maskLayers, onMaskLayersChange, activeMaskLayerId, onActiveMaskLayerIdChange, onUndo, t, onUpdateGradient }) => {
    
    const activeLayer = maskLayers.find(l => l.id === activeMaskLayerId);

    const handleAddLayer = (type: MaskType) => {
        const newLayer: MaskLayer = {
            id: `mask-${Date.now()}`,
            name: `${t('maskLayerName')} ${maskLayers.length + 1}`,
            isVisible: true,
            type: type,
            strokes: [],
            adjustments: { ...INITIAL_ADJUSTMENTS, colorMixer: INITIAL_COLOR_MIXER }, // Reset adjustments for new layer
            invert: false,
            gradient: type === 'linear' ? {
                start: { x: 50, y: 20 },
                end: { x: 50, y: 80 },
                feather: 50
            } : type === 'radial' ? {
                start: { x: 50, y: 50 },
                end: { x: 80, y: 50 },
                radiusY: 1,
                feather: 50
            } : undefined
        };
        onMaskLayersChange([...maskLayers, newLayer]);
        onActiveMaskLayerIdChange(newLayer.id);
    };

    const handleDeleteLayer = (id: string) => {
        const newLayers = maskLayers.filter(l => l.id !== id);
        onMaskLayersChange(newLayers);
        if (activeMaskLayerId === id) {
            onActiveMaskLayerIdChange(newLayers.length > 0 ? newLayers[newLayers.length - 1].id : ''); // Handle empty? PhotoEditor creates one if empty.
        }
    };

    const handleUpdateLayer = (id: string, updates: Partial<MaskLayer>) => {
        onMaskLayersChange(maskLayers.map(l => l.id === id ? { ...l, ...updates } : l));
    };

    const handleLayerAdjustmentChange = (newAdjustments: Adjustments) => {
        if (activeMaskLayerId) {
            handleUpdateLayer(activeMaskLayerId, { adjustments: newAdjustments });
        }
    };
    
    const setLayerAdjustments = (action: React.SetStateAction<Adjustments>) => {
        if (!activeLayer) return;
        const newAdj = typeof action === 'function' ? action(activeLayer.adjustments) : action;
        handleLayerAdjustmentChange(newAdj);
    };

    return (
        <div className="space-y-4">
             {/* Mask Layer Management */}
             <div className="p-3 bg-gray-900/50 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-gray-400">{t('maskLayersLabel')}</h4>
                    <div className="flex gap-1">
                        <button onClick={() => handleAddLayer('brush')} className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300" title={t('addBrushMaskButton')}><BrushIcon className="w-4 h-4"/></button>
                        <button onClick={() => handleAddLayer('radial')} className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300" title={t('addRadialMaskButton')}><RadialGradientIcon className="w-4 h-4"/></button>
                        <button onClick={() => handleAddLayer('linear')} className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300" title={t('addLinearMaskButton')}><LinearGradientIcon className="w-4 h-4"/></button>
                    </div>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                    {maskLayers.map(layer => (
                        <div key={layer.id} 
                             className={`flex items-center justify-between p-2 rounded cursor-pointer ${layer.id === activeMaskLayerId ? 'bg-purple-900/50 border border-purple-500/50' : 'bg-gray-800 hover:bg-gray-700'}`}
                             onClick={() => onActiveMaskLayerIdChange(layer.id)}
                        >
                            <div className="flex items-center gap-2 overflow-hidden">
                                {layer.type === 'brush' && <BrushIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                                {layer.type === 'radial' && <RadialGradientIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                                {layer.type === 'linear' && <LinearGradientIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                                <span className="text-sm text-gray-200 truncate">{layer.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={(e) => { e.stopPropagation(); handleUpdateLayer(layer.id, { isVisible: !layer.isVisible }); }} className={`p-1 rounded hover:bg-gray-600 ${layer.isVisible ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {layer.isVisible ? <EyeIcon className="w-3 h-3" /> : <EyeSlashIcon className="w-3 h-3" />}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteLayer(layer.id); }} className="p-1 rounded hover:bg-red-900/50 text-gray-400 hover:text-red-400">
                                    <TrashIcon className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
             </div>

             {activeLayer && (
                <>
                    <div className="p-3 bg-gray-900/50 rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                            <h4 className="font-semibold text-gray-400">{t('adjustmentBrushLabel')}</h4>
                             <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input type="checkbox" checked={activeLayer.invert} onChange={(e) => handleUpdateLayer(activeLayer.id, { invert: e.target.checked })} className="rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500" />
                                    <span className="text-xs text-gray-300">{t('invertMaskLabel')}</span>
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input type="checkbox" checked={settings.showMask} onChange={(e) => onSettingsChange(p => ({ ...p, showMask: e.target.checked }))} className="rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500" />
                                    <span className="text-xs text-gray-300">{t('showMaskLabel')}</span>
                                </label>
                             </div>
                        </div>

                        {activeLayer.type === 'brush' && (
                            <>
                                <div className="flex bg-gray-700 rounded-lg p-1">
                                    <button onClick={() => onSettingsChange(s => ({ ...s, isErasing: false }))} className={`flex-1 py-1 text-xs font-semibold rounded-md ${!settings.isErasing ? 'bg-purple-600 text-white' : 'text-gray-300'}`}>{t('paintButton')}</button>
                                    <button onClick={() => onSettingsChange(s => ({ ...s, isErasing: true }))} className={`flex-1 py-1 text-xs font-semibold rounded-md ${settings.isErasing ? 'bg-purple-600 text-white' : 'text-gray-300'}`}>{t('eraseButton')}</button>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-400">{t('brushSizeLabel')}</span>
                                    <button onClick={onUndo} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"><UndoIcon className="w-3 h-3"/> {t('undoButton')}</button>
                                </div>
                                <AdjustmentSlider label="" value={settings.size} min={1} max={300} onChange={v => onSettingsChange(s => ({ ...s, size: v }))} resetValue={50} />
                                
                                <span className="text-xs text-gray-400">{t('brushFeatherLabel')}</span>
                                <AdjustmentSlider label="" value={settings.feather} min={0} max={100} onChange={v => onSettingsChange(s => ({ ...s, feather: v }))} resetValue={80} />
                                
                                <span className="text-xs text-gray-400">{t('brushStrengthLabel')}</span>
                                <AdjustmentSlider label="" value={settings.strength} min={1} max={100} onChange={v => onSettingsChange(s => ({ ...s, strength: v }))} resetValue={50} />
                            </>
                        )}
                        
                        {(activeLayer.type === 'linear' || activeLayer.type === 'radial') && activeLayer.gradient && (
                             <>
                                <h4 className="font-semibold text-gray-400 text-xs">{t('gradientSettingsLabel')}</h4>
                                <span className="text-xs text-gray-400">{t('brushFeatherLabel')}</span>
                                <AdjustmentSlider label="" value={activeLayer.gradient.feather} min={0} max={100} onChange={v => onUpdateGradient({ feather: v })} resetValue={50} />
                             </>
                        )}
                    </div>
                    
                    {/* Adjustment Sliders for the Mask */}
                    <div className="space-y-3">
                         <div className="p-3 bg-gray-900/50 rounded-lg space-y-3">
                            <h4 className="font-semibold text-gray-400 text-xs uppercase tracking-wider">{t('lightLabel')}</h4>
                            <AdjustmentSlider label={t('exposureLabel')} value={activeLayer.adjustments.exposure} onChange={v => setLayerAdjustments(p => ({ ...p, exposure: v }))} resetValue={0} />
                            <AdjustmentSlider label={t('brightnessLabel')} value={activeLayer.adjustments.brightness} onChange={v => setLayerAdjustments(p => ({ ...p, brightness: v }))} resetValue={0} />
                            <AdjustmentSlider label={t('contrastLabel')} value={activeLayer.adjustments.contrast} onChange={v => setLayerAdjustments(p => ({ ...p, contrast: v }))} resetValue={0} />
                            <AdjustmentSlider label={t('highlightsLabel')} value={activeLayer.adjustments.highlights} onChange={v => setLayerAdjustments(p => ({ ...p, highlights: v }))} resetValue={0} />
                            <AdjustmentSlider label={t('shadowsLabel')} value={activeLayer.adjustments.shadows} onChange={v => setLayerAdjustments(p => ({ ...p, shadows: v }))} resetValue={0} />
                         </div>
                         <div className="p-3 bg-gray-900/50 rounded-lg space-y-3">
                            <h4 className="font-semibold text-gray-400 text-xs uppercase tracking-wider">{t('colorLabel')}</h4>
                            <AdjustmentSlider label={t('saturationLabel')} value={activeLayer.adjustments.saturate} onChange={v => setLayerAdjustments(p => ({ ...p, saturate: v }))} resetValue={0} />
                            <AdjustmentSlider label={t('temperatureLabel')} value={activeLayer.adjustments.temperature} onChange={v => setLayerAdjustments(p => ({ ...p, temperature: v }))} resetValue={0} />
                            <AdjustmentSlider label={t('tintLabel')} value={activeLayer.adjustments.tint} onChange={v => setLayerAdjustments(p => ({ ...p, tint: v }))} resetValue={0} />
                         </div>
                         <div className="p-3 bg-gray-900/50 rounded-lg space-y-3">
                             <h4 className="font-semibold text-gray-400 text-xs uppercase tracking-wider">{t('clarityLabel')}</h4>
                            <AdjustmentSlider label={t('clarityLabel')} value={activeLayer.adjustments.clarity} onChange={v => setLayerAdjustments(p => ({ ...p, clarity: v }))} min={0} max={10} resetValue={0} />
                            <AdjustmentSlider label={t('dehazeLabel')} value={activeLayer.adjustments.dehaze} onChange={v => setLayerAdjustments(p => ({ ...p, dehaze: v }))} min={0} max={100} resetValue={0} />
                            <AdjustmentSlider label={t('blurLabel')} value={activeLayer.adjustments.blur} onChange={v => setLayerAdjustments(p => ({ ...p, blur: v }))} min={0} max={20} resetValue={0} />
                         </div>
                    </div>
                </>
             )}
        </div>
    );
};

export const PhotoEditor: React.FC<PhotoEditorProps> = ({ image, onSave, onClose, t, userCredits, onDeductCredits }) => {
    const [editedDataUrl, setEditedDataUrl] = useState(image.dataUrl);
    const [adjustments, setAdjustments] = useState<Adjustments>(INITIAL_ADJUSTMENTS);
    const [transforms, setTransforms] = useState<Transforms>(INITIAL_TRANSFORMS);
    const [isSaving, setIsSaving] = useState(false);
    
    const [activeTab, setActiveTab] = useState<'adjust' | 'lightBrush' | 'adjustmentBrush' | 'text' | 'remove'>('adjust');
    const [imageInfo, setImageInfo] = useState({ width: 0, height: 0, size: image.file.size });
    const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
    const [isComparing, setIsComparing] = useState(false);
    const [isSplitView, setIsSplitView] = useState(false);
    const [splitPosition, setSplitPosition] = useState(50);

    const [overlays, setOverlays] = useState<Overlay[]>([]);
    const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
    const overlaysRef = useRef(overlays);
    useEffect(() => {
        overlaysRef.current = overlays;
    }, [overlays]);
    const lastZIndex = useRef<number>(0);
    const watermarkInputRef = useRef<HTMLInputElement>(null);
    const isOverlayInteractingRef = useRef(false);
     
    const [maskLayers, setMaskLayers] = useState<MaskLayer[]>([]);
    const [activeMaskLayerId, setActiveMaskLayerId] = useState<string | null>(null);
    const [adjustmentBrushSettings, setAdjustmentBrushSettings] = useState<AdjustmentBrushSettings>(INITIAL_ADJUSTMENT_BRUSH_SETTINGS);
    const [isBrushing, setIsBrushing] = useState(false);
    const currentAdjustmentStrokeRef = useRef<RawBrushStroke | null>(null);
    const activeMaskLayer = maskLayers.find(l => l.id === activeMaskLayerId);
    const isGradientInteractRef = useRef(false);

    const [lightBrushSettings, setLightBrushSettings] = useState<LightBrushSettings>(INITIAL_LIGHT_BRUSH_SETTINGS);
    const [lightBrushStrokes, setLightBrushStrokes] = useState<LightBrushStroke[]>([]);
    const currentLightBrushStrokeRef = useRef<LightBrushStroke | null>(null);

    const [removeToolStrokes, setRemoveToolStrokes] = useState<RawBrushStroke[]>([]);
    const [removeToolSettings, setRemoveToolSettings] = useState<{ size: number; feather: number; }>({ size: 50, feather: 50 });
    const [isRemoving, setIsRemoving] = useState(false);
    const currentRemoveStrokeRef = useRef<RawBrushStroke | null>(null);

    const [textTemplates, setTextTemplates] = useState<TextOverlay[]>(() => {
        try {
            const stored = localStorage.getItem('photoEditorTextTemplates');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    return parsed;
                }
            }
        } catch (e) {
            console.error("Failed to load text templates from localStorage", e);
        }
        return getDefaultTemplates();
    });

    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [isSpacebarDown, setIsSpacebarDown] = useState(false);
    const panStartRef = useRef({ startX: 0, startY: 0, startPan: { x: 0, y: 0 } });
    const pinchStartRef = useRef<{ dist: number; mid: { x: number; y: number; }; zoom: number; pan: { x: number; y: number; }; } | null>(null);
    const imageContainerRef = useRef<HTMLDivElement>(null);
    const [displayDims, setDisplayDims] = useState({ width: 0, height: 0, x: 0, y: 0 });

    const visibleCanvasRef = useRef<HTMLCanvasElement>(null);
    const baseLayerCanvasRef = useRef(document.createElement('canvas'));
    const maskCanvasRefs = useRef<Record<string, HTMLCanvasElement>>({});
    const removeMaskCanvasRef = useRef(document.createElement('canvas'));
    const lightBrushCanvasRef = useRef(document.createElement('canvas'));
    const brushingCanvasRef = useRef<HTMLCanvasElement>(null);
    const [redrawTrigger, setRedrawTrigger] = useState(0);
    
    const [isCropping, setIsCropping] = useState(false);
    const selectedOverlay = overlays.find(o => o.id === selectedOverlayId) || null;
    
    useEffect(() => {
        if (activeTab !== 'text') {
            setSelectedOverlayId(null);
        }
    }, [activeTab]);
    
    const handleBrightenEffectClick = useCallback(() => {
        setAdjustments(prev => ({
            ...prev,
            exposure: Math.min(100, prev.exposure + 10),
            shadows: Math.min(100, prev.shadows + 8),
            highlights: Math.max(-100, prev.highlights - 3),
            brightness: Math.min(100, prev.brightness + 5)
        }));
    }, []);

    useEffect(() => {
        if (activeTab === 'adjustmentBrush' && maskLayers.length === 0) {
            const newLayer: MaskLayer = {
                id: `mask-${Date.now()}`,
                name: `${t('maskLayerName')} 1`,
                isVisible: true,
                type: 'brush',
                strokes: [],
                adjustments: { ...INITIAL_ADJUSTMENTS, colorMixer: INITIAL_COLOR_MIXER },
                invert: false,
            };
            setMaskLayers([newLayer]);
            setActiveMaskLayerId(newLayer.id);
        }
    }, [activeTab, maskLayers.length, t]);

    useEffect(() => {
        const svgContainer = document.createElement('div');
        svgContainer.innerHTML = sharpenFilterSVG;
        svgContainer.id = "photo-editor-svg-filters";
        document.body.appendChild(svgContainer);
        return () => {
             const el = document.getElementById("photo-editor-svg-filters");
             if (el) document.body.removeChild(el);
        };
    }, []);

    const resetAll = useCallback(() => {
        setAdjustments(INITIAL_ADJUSTMENTS);
        setTransforms(INITIAL_TRANSFORMS);
        setOverlays([]);
        setSelectedOverlayId(null);
        lastZIndex.current = 0;
        setMaskLayers([]);
        setActiveMaskLayerId(null);
        setAdjustmentBrushSettings(INITIAL_ADJUSTMENT_BRUSH_SETTINGS);
        setLightBrushSettings(INITIAL_LIGHT_BRUSH_SETTINGS);
        setLightBrushStrokes([]);
        setRemoveToolStrokes([]);
    }, []);

    const resetView = useCallback(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

            if (e.ctrlKey && !isTyping) {
                if (e.key === 'z') {
                    e.preventDefault();
                    if(activeTab === 'adjustmentBrush') {
                        handleUndoAdjustmentStroke();
                    } else if (activeTab === 'lightBrush') {
                        handleUndoLightBrushStroke();
                    } else if (activeTab === 'remove') {
                        handleUndoRemoveStroke();
                    }
                } else if (e.key === '0' || e.code === 'Digit0') {
                    e.preventDefault();
                    resetView();
                }
            } else if (e.code === 'Space' && !e.repeat && !isTyping) {
                e.preventDefault();
                setIsSpacebarDown(true);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                const target = e.target as HTMLElement;
                const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
                if (!isTyping) e.preventDefault();
                setIsSpacebarDown(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [resetView, activeTab, activeMaskLayerId]);

    useEffect(() => {
        const canvases = [
            visibleCanvasRef.current,
            baseLayerCanvasRef.current,
            lightBrushCanvasRef.current,
            removeMaskCanvasRef.current,
            ...Object.values(maskCanvasRefs.current)
        ].filter(Boolean) as HTMLCanvasElement[];

        const handleContextLost = (event: Event) => {
            console.warn('Canvas context lost. Attempting to restore.');
            event.preventDefault();
        };

        const handleContextRestored = () => {
            console.log('Canvas context restored. Triggering redraw.');
            setRedrawTrigger(c => c + 1);
        };

        canvases.forEach(canvas => {
            canvas.addEventListener('webglcontextlost', handleContextLost, false);
            canvas.addEventListener('webglcontextrestored', handleContextRestored, false);
        });

        return () => {
            canvases.forEach(canvas => {
                canvas.removeEventListener('webglcontextlost', handleContextLost, false);
                canvas.removeEventListener('webglcontextrestored', handleContextRestored, false);
            });
        };
    }, [maskLayers]);

    useEffect(() => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            setSourceImage(img);
            setImageInfo(prev => ({ ...prev, width: img.naturalWidth, height: img.naturalHeight }));
            resetView();
        };
        img.src = editedDataUrl;
    }, [editedDataUrl, resetView]);

    useEffect(() => {
        const calculateDims = () => {
            const container = imageContainerRef.current;
            if (!container || !sourceImage) return;

            const containerRect = container.getBoundingClientRect();
            if (containerRect.width === 0 || containerRect.height === 0) return;

            const imgAspectRatio = sourceImage.naturalWidth / sourceImage.naturalHeight;
            const containerAspectRatio = containerRect.width / containerRect.height;
    
            let newWidth, newHeight, newX, newY;
            if (imgAspectRatio > containerAspectRatio) {
                newWidth = containerRect.width;
                newHeight = newWidth / imgAspectRatio;
                newX = 0;
                newY = (containerRect.height - newHeight) / 2;
            } else {
                newHeight = containerRect.height;
                newWidth = newHeight * imgAspectRatio;
                newY = 0;
                newX = (containerRect.width - newWidth) / 2;
            }
            setDisplayDims({ width: newWidth, height: newHeight, x: newX, y: newY });
        };
    
        calculateDims();
    
        const resizeObserver = new ResizeObserver(calculateDims);
        const containerNode = imageContainerRef.current;
        if (containerNode) {
            resizeObserver.observe(containerNode);
        }
        return () => {
            if (containerNode) {
                resizeObserver.disconnect();
            }
        };
    }, [sourceImage]);
    
    useEffect(() => {
        const canvas = baseLayerCanvasRef.current;
        const source = sourceImage;
        if (!source || source.naturalWidth === 0) return;

        canvas.width = source.naturalWidth;
        canvas.height = source.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        applyAdjustmentsToContext(ctx, adjustments, source);
        
    }, [adjustments, sourceImage, redrawTrigger]);

    useEffect(() => {
        if (!sourceImage) return;

        maskLayers.forEach(layer => {
            let maskCanvas = maskCanvasRefs.current[layer.id];
            if (!maskCanvas) {
                maskCanvas = document.createElement('canvas');
                maskCanvasRefs.current[layer.id] = maskCanvas;
            }
            
            maskCanvas.width = sourceImage.naturalWidth;
            maskCanvas.height = sourceImage.naturalHeight;
            const ctx = maskCanvas.getContext('2d');
            if (!ctx) return;
            ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);

            if (layer.type === 'brush') {
                 layer.strokes.forEach(stroke => {
                    drawFeatheredStroke(ctx, stroke);
                });
            } else if (layer.gradient) {
                 const { width, height } = maskCanvas;
                 if (layer.type === 'linear') {
                     const { start, end, feather } = layer.gradient;
                     const x1 = start.x / 100 * width;
                     const y1 = start.y / 100 * height;
                     const x2 = end.x / 100 * width;
                     const y2 = end.y / 100 * height;
                     
                     const grad = ctx.createLinearGradient(x1, y1, x2, y2);
                     grad.addColorStop(0, 'rgba(255,255,255,1)');
                     grad.addColorStop(1, 'rgba(255,255,255,0)');
                     
                     ctx.fillStyle = grad;
                     ctx.fillRect(0,0,width,height);
                 } else if (layer.type === 'radial') {
                     const { start, end, rotation, radiusY } = layer.gradient;
                     const cx = start.x / 100 * width;
                     const cy = start.y / 100 * height;
                     
                     const rx = Math.hypot((end.x - start.x)/100 * width, (end.y - start.y)/100 * height);
                     const ry = rx * (radiusY || 1);
                     
                     ctx.save();
                     ctx.translate(cx, cy);
                     if (rotation) ctx.rotate(rotation * Math.PI / 180);
                     ctx.scale(1, ry/rx); 
                     
                     const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
                     const featherRatio = (layer.gradient.feather || 0) / 100;
                     const innerStop = Math.max(0, 1 - featherRatio);
                     
                     grad.addColorStop(0, 'rgba(255,255,255,1)');
                     grad.addColorStop(innerStop, 'rgba(255,255,255,1)');
                     grad.addColorStop(1, 'rgba(255,255,255,0)');
                     
                     ctx.fillStyle = grad;
                     const maxR = Math.max(rx, ry);
                     ctx.fillRect(-maxR*2/ (ry/rx), -maxR*2/ (ry/rx), maxR*4/ (ry/rx), maxR*4/ (ry/rx));
                     
                     ctx.restore();
                 }
            }

            if (layer.invert) {
                ctx.globalCompositeOperation = 'source-out';
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
                ctx.globalCompositeOperation = 'source-over';
            }
        });

    }, [maskLayers, sourceImage, redrawTrigger]);

    useEffect(() => {
        const canvas = removeMaskCanvasRef.current;
        if (!sourceImage) return;
        
        canvas.width = sourceImage.naturalWidth;
        canvas.height = sourceImage.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        removeToolStrokes.forEach(stroke => {
            drawFeatheredStroke(ctx, { ...stroke, settings: { ...stroke.settings, strength: 100 }});
        });

    }, [removeToolStrokes, sourceImage, redrawTrigger]);
    
    useEffect(() => {
        if (isCropping) return;

        const visibleCanvas = visibleCanvasRef.current;
        const baseCanvas = baseLayerCanvasRef.current;
        
        if (!visibleCanvas || !sourceImage || baseCanvas.width === 0) return;
    
        visibleCanvas.width = sourceImage.naturalWidth;
        visibleCanvas.height = sourceImage.naturalHeight;
        const ctx = visibleCanvas.getContext('2d');
        if (!ctx) return;

        if (isComparing) {
            ctx.clearRect(0, 0, visibleCanvas.width, visibleCanvas.height);
            ctx.drawImage(sourceImage, 0, 0);
            return;
        }
    
        ctx.clearRect(0, 0, visibleCanvas.width, visibleCanvas.height);
        ctx.drawImage(baseCanvas, 0, 0);
    
        maskLayers.forEach(layer => {
            if (!layer.isVisible) return;

            const maskCanvas = maskCanvasRefs.current[layer.id];
            if (!maskCanvas) return;

            const hasBrushAdjustments = Object.values(layer.adjustments).some(v => v !== 0 && (typeof v !== 'object' || (typeof v === 'object' && v !== null && Object.values(v).some(channel => Object.values(channel as object).some(val => val !== 0)))));
            if (!hasBrushAdjustments) return;

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = baseCanvas.width;
            tempCanvas.height = baseCanvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) return;

            applyAdjustmentsToContext(tempCtx, { ...adjustments, ...layer.adjustments }, sourceImage);
            
            tempCtx.globalCompositeOperation = 'destination-in';
            tempCtx.drawImage(maskCanvas, 0, 0);
            
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(tempCanvas, 0, 0);
        });

        if (lightBrushStrokes.length > 0) {
            const tempLightBrushCanvas = document.createElement('canvas');
            tempLightBrushCanvas.width = visibleCanvas.width;
            tempLightBrushCanvas.height = visibleCanvas.height;
            const tempCtx = tempLightBrushCanvas.getContext('2d');
            if(tempCtx) {
                tempCtx.drawImage(visibleCanvas, 0, 0);
                lightBrushStrokes.forEach(stroke => {
                    applyFilteredStroke(tempCtx, stroke, baseCanvas);
                });
                ctx.clearRect(0, 0, visibleCanvas.width, visibleCanvas.height);
                ctx.drawImage(tempLightBrushCanvas, 0, 0);
            }
        }
    
        if (adjustmentBrushSettings.showMask && activeMaskLayerId && activeTab === 'adjustmentBrush') {
            const activeMaskCanvas = maskCanvasRefs.current[activeMaskLayerId];
            if (activeMaskCanvas) {
                ctx.globalCompositeOperation = 'source-over';
                const coloredMaskCanvas = document.createElement('canvas');
                coloredMaskCanvas.width = activeMaskCanvas.width;
                coloredMaskCanvas.height = activeMaskCanvas.height;
                const coloredMaskCtx = coloredMaskCanvas.getContext('2d');
                if(coloredMaskCtx) {
                    coloredMaskCtx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                    coloredMaskCtx.fillRect(0, 0, activeMaskCanvas.width, activeMaskCanvas.height);
                    coloredMaskCtx.globalCompositeOperation = 'destination-in';
                    coloredMaskCtx.drawImage(activeMaskCanvas, 0, 0);
                    ctx.drawImage(coloredMaskCanvas, 0, 0);
                }
            }
        }

        if (activeTab === 'remove' && removeToolStrokes.length > 0) {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#FF00FF';
            const removeMaskCanvas = removeMaskCanvasRef.current;
            
            const tempMask = document.createElement('canvas');
            tempMask.width = removeMaskCanvas.width;
            tempMask.height = removeMaskCanvas.height;
            const tempCtx = tempMask.getContext('2d');
            if(tempCtx) {
                tempCtx.drawImage(removeMaskCanvas, 0, 0);
                tempCtx.globalCompositeOperation = 'source-in';
                tempCtx.fillRect(0, 0, tempMask.width, tempMask.height);
                ctx.drawImage(tempMask, 0, 0);
            }
            ctx.globalAlpha = 1.0;
        }
    
        ctx.globalCompositeOperation = 'source-over';
    }, [isCropping, sourceImage, adjustments, maskLayers, activeMaskLayerId, adjustmentBrushSettings.showMask, lightBrushStrokes, redrawTrigger, activeTab, removeToolStrokes, isComparing]);

    const drawFeatheredStroke = (ctx: CanvasRenderingContext2D, stroke: RawBrushStroke) => {
        const { settings } = stroke;
        const isErasing = 'isErasing' in settings && settings.isErasing;

        ctx.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';
    
        const drawBrushDab = (p: { x: number; y: number }) => {
            const brushRadius = settings.size / 2;
            if (brushRadius <= 0) return;

            const featherRatio = settings.feather / 100;
            const effectiveFeatherRatio = Math.pow(featherRatio, 0.5);
            const innerStop = Math.max(0, 1 - effectiveFeatherRatio);
            
            const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, brushRadius);
            const color = `rgba(255, 255, 255, ${settings.strength / 100})`;
    
            gradient.addColorStop(0, color);
            gradient.addColorStop(innerStop, color);
            gradient.addColorStop(1, 'rgba(255,255,255,0)');
    
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(p.x, p.y, brushRadius, 0, Math.PI * 2);
            ctx.fill();
        };
    
        if (stroke.points.length === 1) {
            drawBrushDab(stroke.points[0]);
        } else {
            for (let i = 1; i < stroke.points.length; i++) {
                const p1 = stroke.points[i - 1];
                const p2 = stroke.points[i];
                const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                const step = Math.min(10, settings.size / 4);
                for (let j = 0; j < dist; j += Math.max(1, step)) {
                    const x = p1.x + Math.cos(angle) * j;
                    const y = p1.y + Math.sin(angle) * j;
                    drawBrushDab({ x, y });
                }
            }
        }
        ctx.globalCompositeOperation = 'source-over';
    };
    
    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 255, b: 255 };
    }

    const applyFilteredStroke = (ctx: CanvasRenderingContext2D, stroke: LightBrushStroke, source: HTMLCanvasElement | HTMLImageElement) => {
        const { mode, strength, color } = stroke.settings;
        const rgb = hexToRgb(color || '#ffffff');
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = ctx.canvas.width;
        tempCanvas.height = ctx.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = ctx.canvas.width;
        maskCanvas.height = ctx.canvas.height;
        const maskCtx = maskCanvas.getContext('2d');
        if (!maskCtx) return;
        drawFeatheredStroke(maskCtx, { ...stroke, settings: { ...stroke.settings, isErasing: false, showMask: false } });

        let needsFilter = false;
        
        switch (mode) {
            case 'increaseWhiteLight':
            case 'increaseYellowLight':
                tempCtx.globalCompositeOperation = 'lighter';
                tempCtx.drawImage(source, 0, 0);
                tempCtx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${strength / 100})`;
                tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                break;
            case 'increaseBlueDark':
                 tempCtx.globalCompositeOperation = 'multiply';
                 tempCtx.drawImage(source, 0, 0);
                 tempCtx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${1 - strength / 100})`;
                 tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                break;
            case 'decreaseBrightness':
                 tempCtx.filter = `brightness(${100 - strength * 2.5}%)`;
                 needsFilter = true;
                 break;
            case 'decreaseHighlights':
            case 'increaseShadows':
                tempCtx.drawImage(source, 0, 0);
                tempCtx.globalCompositeOperation = 'soft-light';
                const alpha = strength / 100; 
                tempCtx.fillStyle = mode === 'decreaseHighlights' ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`;
                tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                break;
            case 'increaseContrast':
                tempCtx.filter = `contrast(${100 + strength * 5}%)`;
                needsFilter = true;
                break;
            case 'decreaseContrast':
                tempCtx.filter = `contrast(${100 - strength * 2.5}%)`;
                needsFilter = true;
                break;
            case 'increaseSaturation':
                tempCtx.filter = `saturate(${100 + strength * 2}%)`;
                needsFilter = true;
                break;
            case 'decreaseSaturation':
                tempCtx.filter = `saturate(${100 - strength}%)`;
                needsFilter = true;
                break;
            case 'increaseSharpness':
                tempCtx.filter = 'url(#photo-editor-sharpen)';
                needsFilter = true;
                break;
            case 'increaseBlur':
                tempCtx.filter = `blur(${strength / 10}px)`;
                needsFilter = true;
                break;
        }

        if(needsFilter) {
            tempCtx.drawImage(source, 0, 0);
        }
        
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.drawImage(maskCanvas, 0, 0);

        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(tempCanvas, 0, 0);
    };

    const handleFlip = (axis: 'X' | 'Y') => {
        setTransforms(prev => ({...prev, [axis === 'X' ? 'scaleX' : 'scaleY']: prev[axis === 'X' ? 'scaleX' : 'scaleY'] * -1}));
    };

    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (!imageContainerRef.current || isCropping) return;
        e.preventDefault();
        const rect = imageContainerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const delta = -e.deltaY * 0.005;

        setZoom(prevZoom => {
            const newZoom = Math.max(1, Math.min(3, prevZoom + delta * prevZoom));
            setPan(prevPan => {
                const worldX = (mouseX - prevPan.x) / prevZoom;
                const worldY = (mouseY - prevPan.y) / prevZoom;
                const newPanX = mouseX - worldX * newZoom;
                const newPanY = mouseY - worldY * newZoom;
                return { x: newPanX, y: newPanY };
            });
            return newZoom;
        });
    }, [isCropping]);

    const handlePanStart = useCallback((clientX: number, clientY: number, force = false) => {
        if(!force && (isCropping || selectedOverlayId || (activeTab === 'adjustmentBrush' && activeMaskLayer?.type === 'brush') || activeTab === 'lightBrush' || activeTab === 'remove' || isGradientInteractRef.current)) return;
        panStartRef.current = { startX: clientX, startY: clientY, startPan: pan };
        setIsPanning(true);
    }, [isCropping, pan, selectedOverlayId, activeTab, activeMaskLayer?.type]);

    const handlePanMove = useCallback((clientX: number, clientY: number) => {
        if (!isPanning || isCropping) return;
        const dx = clientX - panStartRef.current.startX;
        const dy = clientY - panStartRef.current.startY;
        setPan({
            x: panStartRef.current.startPan.x + dx,
            y: panStartRef.current.startPan.y + dy
        });
    }, [isPanning, isCropping]);

    const handlePanEnd = useCallback(() => setIsPanning(false), []);
    const handlePanByControl = useCallback((dx: number, dy: number) => {
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    }, []);
    
    const getCoordsInImage = useCallback((clientX: number, clientY: number, clamp: boolean = true) => {
        if (!imageContainerRef.current || !sourceImage || displayDims.width === 0 || displayDims.height === 0) return null;
        
        const containerRect = imageContainerRef.current.getBoundingClientRect();

        const mouseX = clientX - containerRect.left;
        const mouseY = clientY - containerRect.top;
        
        const unzoomedX = (mouseX - pan.x) / zoom;
        const unzoomedY = (mouseY - pan.y) / zoom;

        const relativeX = unzoomedX - displayDims.x;
        const relativeY = unzoomedY - displayDims.y;
        
        if (clamp && (relativeX < 0 || relativeX > displayDims.width || relativeY < 0 || relativeY > displayDims.height)) return null;

        const scale = sourceImage.naturalWidth / displayDims.width;
        const imageX = relativeX * scale;
        const imageY = relativeY * scale;

        return { x: imageX, y: imageY };
    }, [sourceImage, displayDims, pan, zoom]);

    const drawBrushPreview = useCallback((clientX: number, clientY: number) => {
        const canvas = brushingCanvasRef.current;
        if (!canvas || ((activeTab !== 'adjustmentBrush' || activeMaskLayer?.type !== 'brush') && activeTab !== 'lightBrush' && activeTab !== 'remove') || !sourceImage) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (canvas.width !== sourceImage.naturalWidth) canvas.width = sourceImage.naturalWidth;
        if (canvas.height !== sourceImage.naturalHeight) canvas.height = sourceImage.naturalHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const imageCoords = getCoordsInImage(clientX, clientY, false);
        if (!imageCoords) return;

        const { x, y } = imageCoords;
        let settings;
        if (activeTab === 'adjustmentBrush') {
            settings = adjustmentBrushSettings;
        } else if (activeTab === 'lightBrush') {
            settings = lightBrushSettings;
        } else {
            settings = removeToolSettings;
        }
        const radius = settings.size / 2;
        
        const imageRect = {
            left: 0,
            top: 0,
            right: sourceImage.naturalWidth,
            bottom: sourceImage.naturalHeight,
        };
        const brushRect = {
            left: x - radius,
            top: y - radius,
            right: x + radius,
            bottom: y + radius,
        };

        if (
            brushRect.right < imageRect.left ||
            brushRect.left > imageRect.right ||
            brushRect.bottom < imageRect.top ||
            brushRect.top > imageRect.bottom
        ) {
            return; 
        }

        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0) return;
        const imagePixelsPerScreenPixel = canvas.width / rect.width;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2 * imagePixelsPerScreenPixel;
        ctx.setLineDash([5 * imagePixelsPerScreenPixel, 5 * imagePixelsPerScreenPixel]);
        ctx.stroke();
        ctx.setLineDash([]);
    }, [activeTab, sourceImage, getCoordsInImage, adjustmentBrushSettings, lightBrushSettings, removeToolSettings, activeMaskLayer]);

    const clearBrushPreview = useCallback(() => {
        const canvas = brushingCanvasRef.current;
       if (!canvas) return;
       const ctx = canvas.getContext('2d');
       if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, []);

    const onMouseUp = useCallback(() => {
        if (isBrushing) {
            if(activeTab === 'adjustmentBrush' && currentAdjustmentStrokeRef.current && activeMaskLayerId) {
                const strokeToCommit = currentAdjustmentStrokeRef.current;
                if (strokeToCommit.points.length > 0) {
                     setMaskLayers(prev => prev.map(l => l.id === activeMaskLayerId ? { ...l, strokes: [...l.strokes, strokeToCommit] } : l));
                }
                currentAdjustmentStrokeRef.current = null;
            } else if (activeTab === 'lightBrush' && currentLightBrushStrokeRef.current) {
                const strokeToCommit = currentLightBrushStrokeRef.current;
                if(strokeToCommit.points.length > 0) {
                    setLightBrushStrokes(prev => [...prev, strokeToCommit]);
                }
                currentLightBrushStrokeRef.current = null;
            } else if (activeTab === 'remove' && currentRemoveStrokeRef.current) {
                const strokeToCommit = currentRemoveStrokeRef.current;
                if (strokeToCommit.points.length > 0) {
                    setRemoveToolStrokes(prev => [...prev, strokeToCommit]);
                }
                currentRemoveStrokeRef.current = null;
            }
        }
        setIsBrushing(false);
        handlePanEnd();
    }, [isBrushing, handlePanEnd, activeMaskLayerId, activeTab]);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        if (e.button !== 0) return;
        
        if (isGradientInteractRef.current) return;

        if (isSplitView) {
             const sliderHandle = (e.target as HTMLElement).closest('.split-view-slider');
             if (sliderHandle && imageContainerRef.current) {
                 const handleSplitDrag = (moveEvent: MouseEvent) => {
                    if (!imageContainerRef.current) return;
                    const containerRect = imageContainerRef.current.getBoundingClientRect();
                    const displayWidth = displayDims.width * zoom;
                    const displayLeft = containerRect.left + displayDims.x * zoom + pan.x;
                    
                    let relativeX = moveEvent.clientX - displayLeft;
                    let pct = (relativeX / displayWidth) * 100;
                    pct = Math.max(0, Math.min(100, pct));
                    setSplitPosition(pct);
                 };
                 
                 const stopSplitDrag = () => {
                     window.removeEventListener('mousemove', handleSplitDrag);
                     window.removeEventListener('mouseup', stopSplitDrag);
                 };
                 window.addEventListener('mousemove', handleSplitDrag);
                 window.addEventListener('mouseup', stopSplitDrag);
                 return;
             }
        }

        if (isSpacebarDown) {
            handlePanStart(e.clientX, e.clientY, true);
            return;
        }
        
        const coords = getCoordsInImage(e.clientX, e.clientY);
        if (!coords) return;

        if (activeTab === 'adjustmentBrush' && activeMaskLayerId && activeMaskLayer?.type === 'brush') {
            setIsBrushing(true);
            currentAdjustmentStrokeRef.current = {
                id: `stroke-${Date.now()}`,
                points: [coords],
                settings: adjustmentBrushSettings,
            };
        } else if (activeTab === 'lightBrush') {
            setIsBrushing(true);
            currentLightBrushStrokeRef.current = {
                id: `light-stroke-${Date.now()}`,
                points: [coords],
                settings: lightBrushSettings,
            };
        } else if (activeTab === 'remove') {
            setIsBrushing(true);
            currentRemoveStrokeRef.current = {
                id: `remove-stroke-${Date.now()}`,
                points: [coords],
                settings: { ...removeToolSettings, strength: 100 },
            };
        } else {
            handlePanStart(e.clientX, e.clientY, false);
        }
    }, [activeTab, getCoordsInImage, adjustmentBrushSettings, lightBrushSettings, handlePanStart, isSpacebarDown, activeMaskLayerId, removeToolSettings, isSplitView, displayDims, zoom, pan, activeMaskLayer?.type]);
    
    const onMouseMove = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const isBrushActive = (activeTab === 'adjustmentBrush' && activeMaskLayer?.type === 'brush') || activeTab === 'lightBrush' || activeTab === 'remove';
        if (isSpacebarDown || isPanning) {
            handlePanMove(e.clientX, e.clientY);
        } else if (isBrushActive && !isSplitView) {
            drawBrushPreview(e.clientX, e.clientY);
            if (isBrushing) {
                const coords = getCoordsInImage(e.clientX, e.clientY);
                if (coords) {
                     if (activeTab === 'adjustmentBrush' && currentAdjustmentStrokeRef.current && activeMaskLayerId) {
                        currentAdjustmentStrokeRef.current.points.push(coords);
                        const maskCanvas = maskCanvasRefs.current[activeMaskLayerId];
                        if(maskCanvas) {
                           const maskCtx = maskCanvas.getContext('2d');
                           if(maskCtx) drawFeatheredStroke(maskCtx, currentAdjustmentStrokeRef.current);
                        }
                     } else if (activeTab === 'lightBrush' && currentLightBrushStrokeRef.current) {
                        currentLightBrushStrokeRef.current.points.push(coords);
                     } else if (activeTab === 'remove' && currentRemoveStrokeRef.current) {
                        currentRemoveStrokeRef.current.points.push(coords);
                        const maskCanvas = removeMaskCanvasRef.current;
                        const maskCtx = maskCanvas.getContext('2d');
                        if (maskCtx) drawFeatheredStroke(maskCtx, currentRemoveStrokeRef.current);
                     }
                } else {
                    requestAnimationFrame(() => onMouseUp());
                }
            }
        }
    }, [activeTab, drawBrushPreview, isBrushing, getCoordsInImage, handlePanMove, onMouseUp, isSpacebarDown, isPanning, activeMaskLayerId, isSplitView, activeMaskLayer?.type]);

     const onMouseLeave = useCallback(() => {
        if (isBrushing) {
            onMouseUp();
        }
        clearBrushPreview();
        handlePanEnd();
    }, [onMouseUp, clearBrushPreview, isBrushing, handlePanEnd]);

    const onTouchStart = (e: React.TouchEvent) => {
        if (isCropping || isGradientInteractRef.current) return;

        if (isSplitView) {
             const sliderHandle = (e.target as HTMLElement).closest('.split-view-slider');
             if (sliderHandle && imageContainerRef.current) {
                 return; 
             }
        }

        if (e.touches.length === 2) {
            setIsPanning(false);
            setIsBrushing(false);
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            pinchStartRef.current = {
                dist: Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY),
                mid: { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 },
                zoom: zoom,
                pan: pan,
            };
        } else if (e.touches.length === 1) {
            pinchStartRef.current = null;
            const { clientX, clientY } = e.touches[0];
            
            if(isSplitView) {
                if (imageContainerRef.current) {
                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                }
            }

            const coords = getCoordsInImage(clientX, clientY);
            const isBrushTab = (activeTab === 'adjustmentBrush' && activeMaskLayer?.type === 'brush') || activeTab === 'lightBrush' || activeTab === 'remove';

            if (isBrushTab && coords && !isSplitView) {
                setIsBrushing(true);
                if (activeTab === 'adjustmentBrush' && activeMaskLayerId) {
                    currentAdjustmentStrokeRef.current = { id: `stroke-${Date.now()}`, points: [coords], settings: adjustmentBrushSettings };
                } else if (activeTab === 'lightBrush') {
                    currentLightBrushStrokeRef.current = { id: `light-stroke-${Date.now()}`, points: [coords], settings: lightBrushSettings };
                } else if (activeTab === 'remove') {
                    currentRemoveStrokeRef.current = { id: `remove-stroke-${Date.now()}`, points: [coords], settings: { ...removeToolSettings, strength: 100 } };
                }
            } else {
                handlePanStart(clientX, clientY, false);
            }
        }
    };
    
    const onTouchMove = (e: React.TouchEvent) => {
        if (isCropping) return;
        
        if (isSplitView && e.touches.length === 1 && imageContainerRef.current) {
             const touch = e.touches[0];
             const sliderHandle = (e.target as HTMLElement).closest('.split-view-slider');
             if(sliderHandle || isSplitView) {
                const containerRect = imageContainerRef.current.getBoundingClientRect();
                const displayWidth = displayDims.width * zoom;
                const displayLeft = containerRect.left + displayDims.x * zoom + pan.x;
                
                if (touch.clientY >= displayDims.y * zoom + pan.y + containerRect.top && 
                    touch.clientY <= (displayDims.y + displayDims.height) * zoom + pan.y + containerRect.top) {
                        let relativeX = touch.clientX - displayLeft;
                        let pct = (relativeX / displayWidth) * 100;
                        pct = Math.max(0, Math.min(100, pct));
                        setSplitPosition(pct);
                        return;
                    }
             }
        }

        if (e.touches.length === 2 && pinchStartRef.current) {
            e.preventDefault();
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const newDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            const scale = newDist / pinchStartRef.current.dist;
            const newZoom = Math.max(1, Math.min(3, pinchStartRef.current.zoom * scale));

            if (imageContainerRef.current) {
                const rect = imageContainerRef.current.getBoundingClientRect();
                const startMidOnScreen = { x: pinchStartRef.current.mid.x - rect.left, y: pinchStartRef.current.mid.y - rect.top };
                const worldPoint = {
                    x: (startMidOnScreen.x - pinchStartRef.current.pan.x) / pinchStartRef.current.zoom,
                    y: (startMidOnScreen.y - pinchStartRef.current.pan.y) / pinchStartRef.current.zoom,
                };
                const newMid = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
                const newMidOnScreen = { x: newMid.x - rect.left, y: newMid.y - rect.top };
                const newPan = {
                    x: newMidOnScreen.x - worldPoint.x * newZoom,
                    y: newMidOnScreen.y - worldPoint.y * newZoom,
                };
                setZoom(newZoom);
                setPan(newPan);
            }
        } else if (e.touches.length === 1) {
            if (isPanning) {
                e.preventDefault();
                handlePanMove(e.touches[0].clientX, e.touches[0].clientY);
            } else if (isBrushing && !isSplitView) {
                e.preventDefault();
                const coords = getCoordsInImage(e.touches[0].clientX, e.touches[0].clientY);
                if (coords) {
                    if (activeTab === 'adjustmentBrush' && currentAdjustmentStrokeRef.current && activeMaskLayerId) {
                        currentAdjustmentStrokeRef.current.points.push(coords);
                        const maskCanvas = maskCanvasRefs.current[activeMaskLayerId];
                        if (maskCanvas) {
                            const maskCtx = maskCanvas.getContext('2d');
                            if (maskCtx) drawFeatheredStroke(maskCtx, currentAdjustmentStrokeRef.current);
                        }
                    } else if (activeTab === 'lightBrush' && currentLightBrushStrokeRef.current) {
                        currentLightBrushStrokeRef.current.points.push(coords);
                    } else if (activeTab === 'remove' && currentRemoveStrokeRef.current) {
                        currentRemoveStrokeRef.current.points.push(coords);
                        const maskCanvas = removeMaskCanvasRef.current;
                        const maskCtx = maskCanvas.getContext('2d');
                        if (maskCtx) drawFeatheredStroke(maskCtx, currentRemoveStrokeRef.current);
                    }
                } else {
                    requestAnimationFrame(() => onMouseUp());
                }
            }
        }
    };

    const onTouchEnd = (e: React.TouchEvent) => {
        if (isCropping) return;
        onMouseUp();
        if (e.touches.length < 2) {
            pinchStartRef.current = null;
        }
        if (e.touches.length === 1) {
            handlePanStart(e.touches[0].clientX, e.touches[0].clientY, false);
        }
    };

    const handleUndoAdjustmentStroke = useCallback(() => {
        if (!activeMaskLayerId) return;
        setMaskLayers(prev => prev.map(l => {
            if (l.id === activeMaskLayerId) {
                return { ...l, strokes: l.strokes.slice(0, -1) };
            }
            return l;
        }));
    }, [activeMaskLayerId]);

    const handleUndoLightBrushStroke = useCallback(() => {
        setLightBrushStrokes(prev => prev.slice(0, -1));
    }, []);

    const handleUndoRemoveStroke = useCallback(() => {
        setRemoveToolStrokes(prev => prev.slice(0, -1));
    }, []);

    const exportImage = useCallback(async (includeRemoveMask: boolean = false): Promise<string> => {
        const sourceCanvas = visibleCanvasRef.current;
        if (!sourceCanvas) throw new Error("Visible canvas not ready");
    
        const exportCanvas = document.createElement('canvas');
        const ctx = exportCanvas.getContext('2d');
        if (!ctx) throw new Error("Could not get canvas context");
    
        const { rotate, scaleX, scaleY } = transforms;
        const rad = (rotate * Math.PI) / 180;
        const absCos = Math.abs(Math.cos(rad));
        const absSin = Math.abs(Math.sin(rad));
        const newWidth = sourceCanvas.width * absCos + sourceCanvas.height * absSin;
        const newHeight = sourceCanvas.width * absSin + sourceCanvas.height * absCos;
        exportCanvas.width = newWidth;
        exportCanvas.height = newHeight;
    
        ctx.translate(newWidth / 2, newHeight / 2);
        ctx.rotate(rad);
        ctx.scale(scaleX, scaleY);
        ctx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        if (includeRemoveMask) {
            ctx.save();
            ctx.translate(newWidth / 2, newHeight / 2);
            ctx.rotate(rad);
            ctx.scale(scaleX, scaleY);
            ctx.drawImage(removeMaskCanvasRef.current, -sourceCanvas.width / 2, -sourceCanvas.height / 2);
            ctx.restore();
        } else {
            const sortedOverlays = [...overlays].sort((a, b) => a.zIndex - b.zIndex);
            
            for (const overlay of sortedOverlays) {
                let watermarkImage: HTMLImageElement | null = null;
                if (overlay.type === 'image') {
                    watermarkImage = await new Promise((resolve, reject) => {
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        img.onload = () => resolve(img);
                        img.onerror = reject;
                        img.src = (overlay as ImageOverlay).dataUrl;
                    });
                }

                ctx.save();
                const overlayX = (overlay.x / 100) * exportCanvas.width;
                const overlayY = (overlay.y / 100) * exportCanvas.height;
                const overlayWidth = (overlay.width / 100) * exportCanvas.width;
                const overlayHeight = (overlay.height / 100) * exportCanvas.height;
                
                const centerX = overlayX;
                const centerY = overlayY;
                
                ctx.translate(centerX, centerY);
                ctx.rotate((overlay.rotation * Math.PI) / 180);
                ctx.globalAlpha = overlay.opacity / 100;
                
                if (overlay.type === 'text') {
                    const textOverlay = overlay as TextOverlay;
                    const exportFontSize = displayDims.height > 0
                        ? (textOverlay.fontSize / displayDims.height) * exportCanvas.height
                        : textOverlay.fontSize * (exportCanvas.height / 500);

                    const font = `${textOverlay.italic ? 'italic' : ''} ${textOverlay.bold ? 'bold' : ''} ${exportFontSize}px ${textOverlay.fontFamily}`;
                    ctx.font = font;
                    ctx.fillStyle = textOverlay.color;
                    
                    const lineHeight = exportFontSize * 1.2;

                    renderWrappedTextOnCanvas(
                        ctx,
                        textOverlay.text,
                        0,
                        0,
                        overlayWidth,
                        lineHeight
                    );
                } else if (overlay.type === 'image' && watermarkImage) {
                    ctx.drawImage(watermarkImage, -overlayWidth / 2, -overlayHeight / 2, overlayWidth, overlayHeight);
                }
                ctx.restore();
            }
        }
        
        return exportCanvas.toDataURL('image/jpeg', 1.0);
    }, [transforms, overlays, displayDims.height]);

    const handleApplyRemove = async () => {
        if (removeToolStrokes.length === 0) return;
        
        // Credit Check: Updated to 3 credits
        if (userCredits < 3) {
             alert(t('notEnoughCredits'));
             return;
        }

        setIsRemoving(true);
        try {
            const imageDataUrl = await exportImage(true);
            const [header, base64Data] = imageDataUrl.split(',');
            if (!base64Data) throw new Error("Invalid image data URL for remove tool.");
            
            const result = await editImageWithGemini(
                [{ base64Data, mimeType: 'image/jpeg' }],
                t('removePrompt')
            );
            const response = result.response;

            if (response.candidates && response.candidates[0]?.content?.parts) {
                const imagePart = response.candidates[0].content.parts.find(p => p.inlineData);
                if (imagePart?.inlineData) {
                    // Success! Deduct credits: Updated to 3
                    onDeductCredits(3);

                    const resultImageUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
                    setEditedDataUrl(resultImageUrl);
                    resetAll();
                    setActiveTab('adjust');
                } else {
                    throw new Error('API did not return an image.');
                }
            } else {
                throw new Error('Invalid response from API.');
            }
        } catch (error) {
            console.error("Failed to apply remove tool:", error);
            if (error instanceof Error && (error.message.includes('PERMISSION_DENIED') || error.message.includes('RESOURCE_EXHAUSTED'))) {
                 alert(t('rateLimitError'));
            } else {
                 alert(t('errorTitle'));
            }
        } finally {
            setIsRemoving(false);
        }
    };
    

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const dataUrl = await exportImage();
            onSave(image.id, dataUrl);
        } catch (error) {
            console.error("Failed to save image:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownload = async () => {
        setIsSaving(true);
        try {
            const dataUrl = await exportImage();
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `edited-${image.file.name.replace(/\.[^/.]+$/, "")}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Failed to download image:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleApplyCrop = (croppedDataUrl: string) => {
        setEditedDataUrl(croppedDataUrl);
        setIsCropping(false);
        resetAll();
    };

    const handleUpdateOverlay = useCallback((id: string, updates: Partial<Overlay>) => {
        setOverlays(prev => prev.map(o => (o.id === id ? ({ ...o, ...updates } as Overlay) : o)));
    }, []);

    const handleAddText = () => {
        const newText: TextOverlay = {
            id: `text-${Date.now()}`,
            type: 'text',
            text: 'Your Text',
            x: 50, y: 50, width: 50, height: 20,
            rotation: 0,
            opacity: 100,
            zIndex: ++lastZIndex.current,
            fontSize: 48,
            fontFamily: '"Noto Sans SC", sans-serif',
            color: '#FFFFFF',
            bold: false,
            italic: false,
        };
        setOverlays(prev => [...prev, newText]);
        setSelectedOverlayId(newText.id);
    };

    const handleWatermarkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            const img = new Image();
            img.onload = () => {
                const imageAspectRatio = img.naturalWidth / img.naturalHeight;
                const containerAspectRatio = displayDims.width > 0 && displayDims.height > 0 
                    ? displayDims.width / displayDims.height 
                    : 1;

                const initialWidthPct = 30;
                const initialHeightPct = initialWidthPct * containerAspectRatio / imageAspectRatio;

                const newWatermark: ImageOverlay = {
                    id: `watermark-${Date.now()}`,
                    type: 'image',
                    dataUrl,
                    x: 50, y: 50,
                    width: initialWidthPct,
                    height: initialHeightPct,
                    rotation: 0,
                    opacity: 50,
                    zIndex: ++lastZIndex.current,
                    aspectRatio: imageAspectRatio
                };
                setOverlays(prev => [...prev, newWatermark]);
                setSelectedOverlayId(newWatermark.id);
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };
    
    const handleDeleteOverlay = (id: string) => {
        setOverlays(prev => prev.filter(o => o.id !== id));
        if (selectedOverlayId === id) {
            setSelectedOverlayId(null);
        }
    };

    const handleAddTextFromTemplate = (template: TextOverlay) => {
        const newText: TextOverlay = {
            ...template,
            id: `text-${Date.now()}`,
            x: 50,
            y: 50,
            zIndex: ++lastZIndex.current,
            templateId: template.id,
        };
        setOverlays(prev => [...prev, newText]);
        setSelectedOverlayId(newText.id);
    };

    const handleUpdateTemplate = useCallback(() => {
        const currentSelectedOverlay = overlaysRef.current.find(o => o.id === selectedOverlayId);
        if (!currentSelectedOverlay || currentSelectedOverlay.type !== 'text' || !currentSelectedOverlay.templateId) {
            return;
        }
    
        const { templateId } = currentSelectedOverlay;
        
        setTextTemplates(currentTemplates => {
            const newTemplates = currentTemplates.map(t => {
                if (t.id === templateId) {
                    const { id: instanceId, zIndex, templateId: instanceTemplateId, ...updatedStyles } = currentSelectedOverlay as TextOverlay;
                    const newTemplate: TextOverlay = {
                        ...t,
                        ...updatedStyles,
                    };
                    return newTemplate;
                }
                return t;
            });
    
            try {
                localStorage.setItem('photoEditorTextTemplates', JSON.stringify(newTemplates));
            } catch (e) {
                console.error("Failed to save updated text templates:", e);
            }
            return newTemplates;
        });
    }, [selectedOverlayId]);

    const handleUpdateGradient = useCallback((updates: Partial<NonNullable<MaskLayer['gradient']>>) => {
        if (!activeMaskLayerId) return;
        setMaskLayers(prev => prev.map(l => {
            if (l.id === activeMaskLayerId && l.gradient) {
                return { ...l, gradient: { ...l.gradient, ...updates } };
            }
            return l;
        }));
    }, [activeMaskLayerId]);

    const GradientControls = () => {
        if (!activeMaskLayer || !activeMaskLayer.gradient) return null;

        if (activeMaskLayer.type === 'linear') {
            const { start, end } = activeMaskLayer.gradient;
            return (
                <div className="absolute inset-0 pointer-events-none">
                    <svg className="w-full h-full">
                        <line x1={`${start.x}%`} y1={`${start.y}%`} x2={`${end.x}%`} y2={`${end.y}%`} stroke="white" strokeWidth="2" />
                    </svg>
                    <div 
                        className="absolute w-4 h-4 bg-white rounded-full shadow-md cursor-move pointer-events-auto"
                        style={{ left: `${start.x}%`, top: `${start.y}%`, transform: 'translate(-50%, -50%)' }}
                        onMouseDown={(e) => handleGradientInteraction(e, 'start')}
                        onTouchStart={(e) => handleGradientInteraction(e, 'start')}
                    ></div>
                    <div 
                        className="absolute w-4 h-4 bg-white rounded-full shadow-md cursor-move pointer-events-auto border-2 border-purple-500"
                        style={{ left: `${end.x}%`, top: `${end.y}%`, transform: 'translate(-50%, -50%)' }}
                        onMouseDown={(e) => handleGradientInteraction(e, 'end')}
                        onTouchStart={(e) => handleGradientInteraction(e, 'end')}
                    ></div>
                </div>
            );
        } else if (activeMaskLayer.type === 'radial') {
            const { start, end, rotation, radiusY = 1 } = activeMaskLayer.gradient;
            
            const rx = Math.hypot(end.x - start.x, end.y - start.y);
            const boxWidth = rx * 2;
            const boxHeight = boxWidth * radiusY;

            const fakeOverlay: any = {
                id: 'gradient-control',
                type: 'text', // dummy
                x: start.x,
                y: start.y,
                width: boxWidth,
                height: boxHeight,
                rotation: rotation || 0,
                opacity: 100,
                zIndex: 999
            };

            return (
                <div className="absolute inset-0 pointer-events-none">
                     <OverlayRenderer
                        overlay={fakeOverlay}
                        isSelected={true}
                        onSelect={() => {}}
                        onUpdate={(_, updates) => {
                            const gradUpdates: any = {};
                            
                            if (updates.x !== undefined || updates.y !== undefined) {
                                const newStart = {
                                    x: updates.x !== undefined ? updates.x : start.x,
                                    y: updates.y !== undefined ? updates.y : start.y
                                };
                                gradUpdates.start = newStart;
                                
                                const dx = newStart.x - start.x;
                                const dy = newStart.y - start.y;
                                gradUpdates.end = { x: end.x + dx, y: end.y + dy };
                            }
                            
                            if (updates.rotation !== undefined) gradUpdates.rotation = updates.rotation;

                            if (updates.width !== undefined || updates.height !== undefined) {
                                const newWidth = updates.width !== undefined ? updates.width : boxWidth;
                                const newHeight = updates.height !== undefined ? updates.height : boxHeight;
                                
                                const newRx = newWidth / 2;
                                gradUpdates.end = {
                                    x: (gradUpdates.start?.x || start.x) + newRx,
                                    y: (gradUpdates.start?.y || start.y)
                                };

                                gradUpdates.radiusY = newHeight / newWidth;
                            }

                            handleUpdateGradient(gradUpdates);
                        }}
                        onInteractionStart={() => { isGradientInteractRef.current = true; }}
                        onInteractionEnd={() => { isGradientInteractRef.current = false; }}
                        isTextTabActive={true}
                    />
                </div>
            );
        }
        return null;
    };

    const handleGradientInteraction = (e: React.MouseEvent | React.TouchEvent, handle: 'start' | 'end') => {
        e.preventDefault();
        e.stopPropagation();
        isGradientInteractRef.current = true;
        
        const container = imageContainerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const displayWidth = displayDims.width * zoom;
        const displayHeight = displayDims.height * zoom;
        const displayLeft = rect.left + displayDims.x * zoom + pan.x;
        const displayTop = rect.top + displayDims.y * zoom + pan.y;

        const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
            const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const clientY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

            const relX = (clientX - displayLeft) / displayWidth * 100;
            const relY = (clientY - displayTop) / displayHeight * 100;
            
            if (activeMaskLayer?.gradient) {
                const newGradient = { ...activeMaskLayer.gradient };
                newGradient[handle] = { x: relX, y: relY };
                handleUpdateGradient(newGradient);
            }
        };

        const handleUp = () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleUp);
            isGradientInteractRef.current = false;
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleUp);
    };
    
    const canvasContainerStyle: React.CSSProperties = {
        width: `${displayDims.width}px`,
        height: `${displayDims.height}px`,
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        position: 'relative',
        transformOrigin: 'top left',
    }

    const canvasStyle: React.CSSProperties = {
        transform: `rotate(${transforms.rotate}deg) scaleX(${transforms.scaleX}) scaleY(${transforms.scaleY})`,
        width: '100%',
        height: '100%',
        position: 'absolute'
    };

    let cursorStyle: string;
    if (isCropping) {
        cursorStyle = 'default';
    } else if (isPanning) {
        cursorStyle = 'grabbing';
    } else if (isSpacebarDown) {
        cursorStyle = 'grab';
    } else if ((activeTab === 'adjustmentBrush' && activeMaskLayer?.type === 'brush') || activeTab === 'lightBrush' || activeTab === 'remove') {
        cursorStyle = 'none';
    } else {
        cursorStyle = 'grab';
    }

    return (
        <div className="fixed inset-0 bg-gray-900/80 z-50 flex flex-col p-4 backdrop-blur-sm animate-fade-in">
            <header className="flex items-center justify-between pb-4 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-200">{t('photoEditorTitle')}</h2>
                <div className="flex items-center gap-2">
                    {!isCropping && (
                        <>
                            <button onClick={handleDownload} disabled={isSaving} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50">
                                <DownloadIcon className="w-5 h-5" />
                                <span className="hidden sm:inline">{t('downloadButton')}</span>
                            </button>
                            <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50">
                                {isSaving ? <>{t('generatingButton')}</> : <><SaveIcon className="w-5 h-5" /> <span className="hidden sm:inline">{t('saveAndCloseButton')}</span></>}
                            </button>
                        </>
                    )}
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-700 rounded-full"><CloseIcon className="w-6 h-6" /></button>
                </div>
            </header>

            <main className="flex-grow flex flex-col lg:flex-row gap-4 overflow-hidden">
                <div 
                    ref={imageContainerRef}
                    className="flex-grow bg-black/50 rounded-lg flex items-center justify-center p-2 overflow-hidden relative"
                    style={{ cursor: cursorStyle, touchAction: 'none' }}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseLeave}
                    onWheel={handleWheel}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                    onClick={() => { 
                        if (isOverlayInteractingRef.current || isGradientInteractRef.current) return;
                        if(!isCropping && (activeTab !== 'adjustmentBrush' || activeMaskLayer?.type !== 'brush') && activeTab !== 'lightBrush' && !isSpacebarDown && activeTab !== 'remove' && !isSplitView) setSelectedOverlayId(null); 
                    }}
                >
                    {isCropping && sourceImage ? (
                        <CropUI
                            image={sourceImage}
                            onApply={handleApplyCrop}
                            onCancel={() => setIsCropping(false)}
                            t={t}
                        />
                    ) : sourceImage && (
                        <>
                        <div style={canvasContainerStyle}>
                            <div style={canvasStyle}>
                                <canvas ref={visibleCanvasRef} className="absolute top-0 left-0 w-full h-full" style={{ pointerEvents: 'none' }} />
                                
                                {isSplitView && (
                                    <div className="absolute top-0 left-0 w-full h-full overflow-hidden" style={{ width: `${splitPosition}%`, pointerEvents: 'none', borderRight: '2px solid white' }}>
                                        <img src={sourceImage.src} className="absolute top-0 left-0 w-full h-full max-w-none" style={{ width: `${displayDims.width}px`, height: `${displayDims.height}px` }} draggable="false" />
                                        <div className="absolute top-1/2 right-0 w-8 h-8 -mr-4 bg-white rounded-full flex items-center justify-center shadow-lg cursor-ew-resize split-view-slider" style={{transform: 'translateY(-50%)', pointerEvents: 'auto'}}>
                                            <div className="flex gap-0.5">
                                                <div className="w-0.5 h-4 bg-gray-400"></div>
                                                <div className="w-0.5 h-4 bg-gray-400"></div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="absolute top-0 left-0 w-full h-full photo-editor-canvas-container">
                                    {activeTab === 'text' && overlays.map(overlay => (
                                        <OverlayRenderer
                                            key={overlay.id}
                                            overlay={overlay}
                                            isSelected={overlay.id === selectedOverlayId}
                                            onSelect={setSelectedOverlayId}
                                            onUpdate={handleUpdateOverlay}
                                            onInteractionStart={() => { isOverlayInteractingRef.current = true; }}
                                            onInteractionEnd={() => {
                                                setTimeout(() => {
                                                    isOverlayInteractingRef.current = false;
                                                }, 0);
                                            }}
                                            isTextTabActive={activeTab === 'text'}
                                        />
                                    ))}
                                    {activeTab === 'adjustmentBrush' && <GradientControls />}
                                </div>
                                <canvas
                                    ref={brushingCanvasRef}
                                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                                />
                            </div>
                        </div>
                        {zoom > 1 && !isCropping && <PanControl onPan={handlePanByControl} />}
                        </>
                    )}
                </div>

                {!isCropping &&
                    <div className="w-full lg:w-72 h-1/2 lg:h-auto flex-shrink-0 bg-gray-800 rounded-lg p-4 flex flex-col gap-4 overflow-y-auto">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-300">{t('adjustmentsLabel')}</h3>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setIsSplitView(!isSplitView)}
                                    className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${isSplitView ? 'text-blue-400 hover:text-blue-300' : 'text-gray-400 hover:text-gray-300'}`}
                                    title={t('splitViewButton')}
                                >
                                    <SplitViewIcon className="w-5 h-5" />
                                    <span>{t('splitViewButton')}</span>
                                </button>
                                <button
                                    onMouseDown={() => setIsComparing(true)}
                                    onMouseUp={() => setIsComparing(false)}
                                    onMouseLeave={() => setIsComparing(false)}
                                    onTouchStart={() => setIsComparing(true)}
                                    onTouchEnd={() => setIsComparing(false)}
                                    className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-300 font-semibold"
                                    title={t('compareButton')}
                                >
                                    <CompareIcon className="w-5 h-5" />
                                    <span>{t('compareButton')}</span>
                                </button>
                                <button onClick={() => {resetAll(); resetView();}} className="flex items-center gap-1.5 text-sm text-purple-400 hover:text-purple-300 font-semibold">
                                    <RedrawIcon className="w-4 h-4"/>{t('resetButton')}
                                </button>
                            </div>
                        </div>
                        
                         <div className="text-sm text-gray-400 bg-gray-900/50 p-3 rounded-lg space-y-1">
                            <div className="flex justify-between">
                                <span>{t('resolutionLabel')}</span>
                                <span className="font-mono">{imageInfo.width} x {imageInfo.height}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>{t('sizeLabel')}</span>
                                <span className="font-mono">{formatFileSize(imageInfo.size)}</span>
                            </div>
                        </div>

                         <div className="flex items-center justify-center gap-2 bg-gray-900/50 p-2 rounded-lg">
                            <button onClick={() => setZoom(z => Math.max(1, z - 0.2))} className="p-2 rounded-md hover:bg-gray-600" title={t('zoomOutButton')}><ZoomOutIcon className="w-5 h-5"/></button>
                            <span className="text-sm font-semibold w-16 text-center bg-gray-700 text-gray-200 rounded-md px-2 py-1" onDoubleClick={resetView}>{Math.round(zoom * 100)}%</span>
                            <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} className="p-2 rounded-md hover:bg-gray-600" title={t('zoomInButton')}><ZoomInIcon className="w-5 h-5"/></button>
                            <button onClick={resetView} className="p-2 rounded-md hover:bg-gray-600" title={t('resetViewButton')}><ArrowsPointingOutIcon className="w-5 h-5"/></button>
                        </div>
                        
                        <div className="flex bg-gray-900/50 rounded-lg p-1">
                            <button onClick={() => setActiveTab('adjust')} className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'adjust' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>{t('adjustmentsLabel')}</button>
                            <button onClick={() => setActiveTab('lightBrush')} className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'lightBrush' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>{t('lightbrushLabel')}</button>
                            <button onClick={() => setActiveTab('adjustmentBrush')} className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'adjustmentBrush' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>{t('adjustmentBrushLabel')}</button>
                            <button onClick={() => setActiveTab('text')} className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'text' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>{t('textLabel')}</button>
                        </div>
                        
                        {activeTab === 'adjust' && (
                           <AdjustmentPanel
                                adjustments={adjustments}
                                setAdjustments={setAdjustments}
                                onFlip={handleFlip}
                                onRotate={(dir) => setTransforms(p => ({ ...p, rotate: p.rotate + dir }))}
                                onCrop={() => setIsCropping(true)}
                                t={t}
                                onBrightenEffect={handleBrightenEffectClick}
                                onMagicErase={() => setActiveTab('remove')}
                            />
                        )}

                        {activeTab === 'lightBrush' && (
                             <LightBrushPanel
                                settings={lightBrushSettings}
                                onSettingsChange={setLightBrushSettings}
                                onUndo={handleUndoLightBrushStroke}
                                t={t}
                            />
                        )}

                        {activeTab === 'adjustmentBrush' && (
                           <AdjustmentBrushPanel
                                settings={adjustmentBrushSettings}
                                onSettingsChange={setAdjustmentBrushSettings}
                                maskLayers={maskLayers}
                                onMaskLayersChange={setMaskLayers}
                                activeMaskLayerId={activeMaskLayerId}
                                onActiveMaskLayerIdChange={setActiveMaskLayerId}
                                onUndo={handleUndoAdjustmentStroke}
                                t={t}
                                onUpdateGradient={handleUpdateGradient}
                           />
                        )}
                        
                        {activeTab === 'text' && (
                           <TextPanel
                                selectedOverlay={selectedOverlay}
                                onUpdateOverlay={handleUpdateOverlay}
                                onAddText={handleAddText}
                                onAddWatermark={() => watermarkInputRef.current?.click()}
                                onDeleteOverlay={() => selectedOverlayId && handleDeleteOverlay(selectedOverlayId)}
                                templates={textTemplates}
                                onAddFromTemplate={handleAddTextFromTemplate}
                                onUpdateTemplate={handleUpdateTemplate}
                                t={t}
                           />
                        )}

                        {activeTab === 'remove' && (
                            <RemoveToolPanel
                                settings={removeToolSettings}
                                onSettingsChange={setRemoveToolSettings}
                                onUndo={handleUndoRemoveStroke}
                                onApply={handleApplyRemove}
                                isRemoving={isRemoving}
                                onCancel={() => {
                                    setActiveTab('adjust');
                                    setRemoveToolStrokes([]);
                                }}
                                t={t}
                            />
                        )}
                        <input type="file" ref={watermarkInputRef} onChange={handleWatermarkFileChange} accept="image/*" className="hidden" />

                    </div>
                }
            </main>
        </div>
    );
};

const ColorMixerPanel: React.FC<{
    colorMixer: ColorMixerAdjustments;
    onChange: (channel: ColorChannelId, property: 'h' | 's' | 'l', value: number) => void;
    onReset: () => void;
    t: TFunction;
}> = ({ colorMixer, onChange, onReset, t }) => {
    const [activeTab, setActiveTab] = useState<'h' | 's' | 'l'>('h');

    const renderSlider = (channel: typeof COLOR_CHANNELS[number]) => (
        <div key={channel.id} className="grid grid-cols-5 items-center gap-2">
            <div className={`w-4 h-4 rounded-full ${channel.color}`}></div>
            <label onDoubleClick={() => onChange(channel.id, activeTab, 0)} className="text-sm text-gray-300 col-span-1 truncate cursor-pointer" title="Double click to reset">{t(channel.labelKey as any)}</label>
            <input
                type="range"
                min="-30" max="30" step="1"
                value={colorMixer[channel.id][activeTab]}
                onChange={e => onChange(channel.id, activeTab, Number(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500 col-span-2"
            />
             <span onDoubleClick={() => onChange(channel.id, activeTab, 0)} className="text-xs text-gray-400 font-mono bg-gray-700 px-1 py-0.5 rounded cursor-pointer text-center" title="Double click to reset">{colorMixer[channel.id][activeTab]}</span>
        </div>
    );

    return (
        <div className="p-3 bg-gray-900/50 rounded-lg space-y-3">
            <div className="flex justify-between items-center">
                <h4 className="font-semibold text-gray-400">{t('colorMixerLabel')}</h4>
                <button onClick={onReset} className="text-xs text-purple-400 hover:text-purple-300 font-semibold">{t('resetButton')}</button>
            </div>
            <div className="flex bg-gray-700 rounded-lg p-1">
                <button onClick={() => setActiveTab('h')} className={`flex-1 py-1 text-sm rounded-md ${activeTab === 'h' ? 'bg-purple-600 text-white' : 'text-gray-300'}`}>{t('hueLabel')}</button>
                <button onClick={() => setActiveTab('s')} className={`flex-1 py-1 text-sm rounded-md ${activeTab === 's' ? 'bg-purple-600 text-white' : 'text-gray-300'}`}>{t('saturationLabel')}</button>
                <button onClick={() => setActiveTab('l')} className={`flex-1 py-1 text-sm rounded-md ${activeTab === 'l' ? 'bg-purple-600 text-white' : 'text-gray-300'}`}>{t('luminanceLabel')}</button>
            </div>
            <div className="space-y-2">
                {COLOR_CHANNELS.map(renderSlider)}
            </div>
        </div>
    );
};

const AdjustmentPanel: React.FC<{
    adjustments: Adjustments;
    setAdjustments: React.Dispatch<React.SetStateAction<Adjustments>>;
    onFlip: (axis: 'X' | 'Y') => void;
    onRotate: (direction: number) => void;
    onCrop: () => void;
    t: TFunction;
    onBrightenEffect: () => void;
    onMagicErase: () => void;
}> = ({ adjustments, setAdjustments, onFlip, onRotate, onCrop, t, onBrightenEffect, onMagicErase }) => {
    
    const setAdjustment = (key: keyof Adjustments, value: any) => {
        setAdjustments(prev => ({ ...prev, [key]: value }));
    };

    const applyEffect = (effect: Partial<Omit<Adjustments, 'colorMixer' | 'enhance'>>) => {
        const newAdjustments = { ...INITIAL_ADJUSTMENTS, enhance: adjustments.enhance, accent: 0 };

        for (const key in effect) {
            const k = key as keyof typeof effect;
            const value = effect[k]!
            const min = (k === 'vignette' || k === 'blur' || k === 'clarity' || k === 'dehaze') ? 0 : -100;
            const max = (k === 'clarity') ? 10 : (k === 'blur' ? 20 : 100);
            (newAdjustments as any)[k] = Math.max(min, Math.min(max, value));
        }
        
        setAdjustments(newAdjustments);
    };

    const effects = [
        { id: 'autoEnhance', label: t('autoEnhanceButton'), icon: SparklesIcon, adjustments: { contrast: 10, saturate: 8, brightness: 5, clarity: 2 } },
        { id: 'vividColors', label: t('vividColorsButton'), icon: SaturationIcon, adjustments: { saturate: 25, contrast: 15, clarity: 3 } },
        { id: 'natureEnhance', label: t('natureEnhanceButton'), icon: LeafIcon, adjustments: { saturate: 15, contrast: 10, clarity: 4, shadows: 10, vignette: 10 } },
        { id: 'softPortrait', label: t('softPortraitButton'), icon: UserCircleIcon, adjustments: { contrast: -10, clarity: -5, highlights: -8, temperature: 5, shadows: 5 } },
        { id: 'cinematic', label: t('cinematicButton'), icon: FilmIcon, adjustments: { temperature: -15, contrast: 20, tint: -5, vignette: 20 } },
        { id: 'bw', label: t('bwButton'), icon: ContrastIcon, adjustments: { saturate: -100, contrast: 25 } },
    ];

    return (
        <div className="space-y-4">
            <div className="p-3 bg-gray-900/50 rounded-lg space-y-3">
                <h4 className="font-semibold text-gray-400">{t('enhanceLabel')}</h4>
                 <AdjustmentSlider 
                    label={t('accentLabel')} 
                    value={adjustments.accent} 
                    onChange={v => setAdjustment('accent', v)} 
                    min={0} 
                    max={100} 
                    resetValue={0} 
                />
                <AdjustmentSlider 
                    label={t('enhanceLabel')} 
                    value={adjustments.enhance} 
                    onChange={v => setAdjustment('enhance', v)} 
                    min={0} 
                    max={100} 
                    resetValue={0} 
                />
            </div>
            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={onBrightenEffect}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold py-2 px-3 rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all duration-300 transform hover:scale-105"
                >
                    <SunIcon className="w-5 h-5" />
                    <span>{t('brightenEffectButton')}</span>
                </button>
                <button
                    onClick={onMagicErase}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold py-2 px-3 rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-all duration-300 transform hover:scale-105"
                >
                    <MagicEraserIcon className="w-5 h-5" />
                    <span>{t('magicEraserButton')}</span>
                </button>
            </div>
            
            <div className="p-3 bg-gray-900/50 rounded-lg space-y-2">
                <h4 className="font-semibold text-gray-400">{t('quickEffectsLabel')}</h4>
                <div className="grid grid-cols-3 gap-2">
                    {effects.map(effect => (
                        <button
                            key={effect.id}
                            onClick={() => applyEffect(effect.adjustments)}
                            className="flex flex-col items-center justify-center gap-1.5 p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg aspect-square text-center"
                            title={effect.label}
                        >
                            <effect.icon className="w-6 h-6" />
                            <span className="text-xs leading-tight">{effect.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-3 bg-gray-900/50 rounded-lg space-y-3">
                <h4 className="font-semibold text-gray-400">{t('lightLabel')}</h4>
                <AdjustmentSlider label={t('brightnessLabel')} value={adjustments.brightness} onChange={v => setAdjustment('brightness', v)} resetValue={0} />
                <AdjustmentSlider label={t('exposureLabel')} value={adjustments.exposure} onChange={v => setAdjustment('exposure', v)} resetValue={0} />
                <AdjustmentSlider label={t('contrastLabel')} value={adjustments.contrast} onChange={v => setAdjustment('contrast', v)} resetValue={0} />
                <AdjustmentSlider label={t('highlightsLabel')} value={adjustments.highlights} onChange={v => setAdjustment('highlights', v)} resetValue={0} />
                <AdjustmentSlider label={t('shadowsLabel')} value={adjustments.shadows} onChange={v => setAdjustment('shadows', v)} resetValue={0} />
                <AdjustmentSlider label={t('vignetteLabel')} value={adjustments.vignette} min={0} onChange={v => setAdjustment('vignette', v)} resetValue={0} />
            </div>
            <div className="p-3 bg-gray-900/50 rounded-lg space-y-3">
                <h4 className="font-semibold text-gray-400">{t('colorLabel')}</h4>
                <AdjustmentSlider label={t('saturationLabel')} value={adjustments.saturate} onChange={v => setAdjustment('saturate', v)} resetValue={0} />
                <AdjustmentSlider label={t('vibranceLabel')} value={adjustments.vibrance} onChange={v => setAdjustment('vibrance', v)} resetValue={0} min={-10} max={10} />
                <AdjustmentSlider label={t('temperatureLabel')} value={adjustments.temperature} onChange={v => setAdjustment('temperature', v)} resetValue={0} />
                <AdjustmentSlider label={t('tintLabel')} value={adjustments.tint} onChange={v => setAdjustment('tint', v)} resetValue={0} />
            </div>
             <ColorMixerPanel
                colorMixer={adjustments.colorMixer}
                onChange={(channel, prop, value) => {
                    setAdjustments(prev => ({
                        ...prev,
                        colorMixer: {
                            ...prev.colorMixer,
                            [channel]: {
                                ...prev.colorMixer[channel],
                                [prop]: value
                            }
                        }
                    }))
                }}
                onReset={() => {
                    setAdjustments(prev => ({ ...prev, colorMixer: INITIAL_COLOR_MIXER }))
                }}
                t={t}
            />
            <div className="p-3 bg-gray-900/50 rounded-lg space-y-3">
                <h4 className="font-semibold text-gray-400">{t('clarityLabel')}</h4>
                <AdjustmentSlider label={t('clarityLabel')} value={adjustments.clarity} onChange={v => setAdjustment('clarity', v)} resetValue={0} min={0} max={10} />
                <AdjustmentSlider label={t('dehazeLabel')} value={adjustments.dehaze} min={0} max={100} onChange={v => setAdjustment('dehaze', v)} resetValue={0} />
                <AdjustmentSlider label={t('blurLabel')} value={adjustments.blur} min={0} max={20} onChange={v => setAdjustment('blur', v)} resetValue={0} />
            </div>
            <div className="p-3 bg-gray-900/50 rounded-lg space-y-3">
                 <h4 className="font-semibold text-gray-400">{t('transformLabel')}</h4>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => onFlip('X')} className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white py-2 px-3 rounded-lg"><MirrorIcon className="w-5 h-5"/> {t('mirrorButton')}</button>
                    <button onClick={() => onFlip('Y')} className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white py-2 px-3 rounded-lg"><FlipVerticalIcon className="w-5 h-5"/> {t('flipVerticalButton')}</button>
                </div>
                 <button onClick={onCrop} className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white py-2 px-3 rounded-lg"><CropIcon className="w-5 h-5"/> {t('cropLabel')}</button>
            </div>
        </div>
    );
};

const RemoveToolPanel: React.FC<{
    settings: { size: number; feather: number };
    onSettingsChange: React.Dispatch<React.SetStateAction<{ size: number; feather: number; }>>;
    onUndo: () => void;
    onApply: () => void;
    isRemoving: boolean;
    onCancel: () => void;
    t: TFunction;
}> = ({ settings, onSettingsChange, onUndo, onApply, isRemoving, onCancel, t }) => {

    const handleSettingChange = (key: keyof typeof settings, value: number) => {
        onSettingsChange(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="space-y-4">
            <div className="p-3 bg-gray-900/50 rounded-lg space-y-3 border border-purple-500/50">
                <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-gray-400">{t('removeToolLabel')}</h4>
                    <button onClick={onUndo} className="flex items-center gap-1.5 text-sm text-purple-400 hover:text-purple-300 font-semibold">
                        <UndoIcon className="w-4 h-4"/>{t('undoButton')}
                    </button>
                </div>
                <AdjustmentSlider label={t('brushSizeLabel')} value={settings.size} onChange={v => handleSettingChange('size', v)} min={1} max={500} resetValue={50} />
                <AdjustmentSlider label={t('brushFeatherLabel')} value={settings.feather} onChange={v => handleSettingChange('feather', v)} resetValue={50} />
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-700/50">
                    <button onClick={onCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg">{t('layoutCancel')}</button>
                    <button onClick={onApply} disabled={isRemoving} className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                        {isRemoving ? t('generatingButton') : <><SparklesIcon className="w-5 h-5"/>{t('applyRemoveButton')}</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

interface CropUIProps {
    image: HTMLImageElement;
    onApply: (dataUrl: string) => void;
    onCancel: () => void;
    t: TFunction;
}

const CropUI: React.FC<CropUIProps> = ({ image, onApply, onCancel, t }) => {
    const [crop, setCrop] = useState({ cx: 50, cy: 50, width: 80, height: 80, rotation: 0 }); 
    const [aspectRatioKey, setAspectRatioKey] = useState<string>('Free');
    const [interaction, setInteraction] = useState<{ type: string; handle: string; startX: number; startY: number; startCrop: typeof crop; startAngle?: number; center?: { x: number; y: number; } } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [imageDims, setImageDims] = useState({ width: 0, height: 0 });

    const aspectRatios: { [key: string]: { value: number | null, label: string } } = {
        'Free': { value: null, label: t('Free') },
        '1:1': { value: 1, label: t('ratio11') },
        '16:9': { value: 16 / 9, label: t('ratio169') },
        '9:16': { value: 9 / 16, label: t('ratio916') },
        '3:2': { value: 3 / 2, label: t('ratio32') },
        '2:3': { value: 2 / 3, label: t('ratio23') },
    };

    const handleApply = () => {
        if (!imageDims.width || !imageDims.height) return;
        const canvas = document.createElement('canvas');
        const cropWidthPx = (crop.width / 100) * image.naturalWidth;
        const cropHeightPx = (crop.height / 100) * image.naturalHeight;
        
        canvas.width = cropWidthPx;
        canvas.height = cropHeightPx;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const cropCenterXpx = crop.cx / 100 * image.naturalWidth;
            const cropCenterYpx = crop.cy / 100 * image.naturalHeight;

            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((-crop.rotation * Math.PI) / 180);
            ctx.drawImage(image, -cropCenterXpx, -cropCenterYpx);
            onApply(canvas.toDataURL('image/jpeg', 1.0));
        }
    };
    
    useEffect(() => {
        const calculateDims = () => {
            const container = containerRef.current;
            if (!container) return;
            const containerRect = container.getBoundingClientRect();
            const imgAspectRatio = image.naturalWidth / image.naturalHeight;
            const containerAspectRatio = containerRect.width / containerRect.height;
            let newWidth, newHeight;
            if (imgAspectRatio > containerAspectRatio) {
                newWidth = containerRect.width;
                newHeight = newWidth / imgAspectRatio;
            } else {
                newHeight = containerRect.height;
                newWidth = newHeight * imgAspectRatio;
            }
            setImageDims({ width: newWidth, height: newHeight });
        };
        calculateDims();
        const resizeObserver = new ResizeObserver(calculateDims);
        if (containerRef.current) resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [image]);

    useEffect(() => {
        const ar = aspectRatios[aspectRatioKey].value;
        if (!ar || !imageDims.width) return;

        const { cx, cy, width, height } = crop;
        
        const currentPixelWidth = width / 100 * imageDims.width;
        const currentPixelHeight = height / 100 * imageDims.height;
        
        let newPixelWidth = currentPixelWidth;
        let newPixelHeight = currentPixelHeight;

        if (currentPixelWidth / currentPixelHeight > ar) {
            newPixelWidth = newPixelHeight * ar;
        } else {
            newPixelHeight = newPixelWidth / ar;
        }

        let newWidth = newPixelWidth / imageDims.width * 100;
        let newHeight = newPixelHeight / imageDims.height * 100;
        
        if (cx - newWidth/2 < 0) newWidth = cx * 2;
        if (cx + newWidth/2 > 100) newWidth = (100 - cx) * 2;
        if (cy - newHeight/2 < 0) newHeight = cy * 2;
        if (cy + newHeight/2 > 100) newHeight = (100 - cy) * 2;


        setCrop(c => ({
            ...c,
            width: newWidth,
            height: newHeight,
        }));

    }, [aspectRatioKey, imageDims]);

    const handleInteractionStart = useCallback((e: React.MouseEvent | React.TouchEvent, type: string, handle: string) => {
        e.preventDefault();
        e.stopPropagation();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        
        const baseInteraction = { type, handle, startX: clientX, startY: clientY, startCrop: crop };

        if (type === 'rotate') {
            if (!containerRef.current || !imageDims.width) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            const imageLeft = containerRect.left + (containerRect.width - imageDims.width) / 2;
            const imageTop = containerRect.top + (containerRect.height - imageDims.height) / 2;
            const centerX = imageLeft + (crop.cx / 100) * imageDims.width;
            const centerY = imageTop + (crop.cy / 100) * imageDims.height;
            const startAngle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
            setInteraction({ ...baseInteraction, startAngle, center: { x: centerX, y: centerY } });
        } else {
            setInteraction(baseInteraction);
        }
    }, [crop, imageDims]);

    const handleInteractionMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!interaction || !imageDims.width) return;

        const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
        let { cx, cy, width, height, rotation } = interaction.startCrop;

        if (interaction.type === 'rotate' && interaction.startAngle !== undefined && interaction.center) {
            const { center, startAngle } = interaction;
            const currentAngle = Math.atan2(clientY - center.y, clientX - center.x) * (180 / Math.PI);
            rotation = interaction.startCrop.rotation + (currentAngle - startAngle);
            setCrop({ cx, cy, width, height, rotation });
            return;
        }

        const dxPct = ((clientX - interaction.startX) / imageDims.width) * 100;
        const dyPct = ((clientY - interaction.startY) / imageDims.height) * 100;

        if (interaction.type === 'move') {
            cx += dxPct;
            cy += dyPct;
        } else if (interaction.type === 'resize') {
            const rad = (rotation * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const rotatedDx = dxPct * cos + dyPct * sin;
            const rotatedDy = -dxPct * sin + dyPct * cos;
            
            let dw = 0, dh = 0;
            const handles = interaction.handle.split('');
            if (handles.includes('r')) dw = rotatedDx;
            if (handles.includes('l')) dw = -rotatedDx;
            if (handles.includes('b')) dh = rotatedDy;
            if (handles.includes('t')) dh = -rotatedDy;

            const ar = aspectRatios[aspectRatioKey].value;
            if (ar) {
                if (handles.length === 1) { 
                     if (handles[0] === 't' || handles[0] === 'b') dw = dh * ar * (imageDims.height / imageDims.width);
                     else dh = dw / ar * (imageDims.width / imageDims.height);
                } else { 
                    if (Math.abs(rotatedDx / ar * (imageDims.height / imageDims.width)) > Math.abs(rotatedDy)) {
                        dh = dw / ar * (imageDims.width / imageDims.height);
                    } else {
                        dw = dh * ar * (imageDims.height / imageDims.width);
                    }
                }
            }
            
            width += dw;
            height += dh;

            cx += (dw / 2) * cos - (dh / 2) * sin;
            cy += (dw / 2) * sin + (dh / 2) * cos;
        }

        const minSize = 5;
        width = Math.max(minSize, width);
        height = Math.max(minSize, height);
        const halfW = width / 2;
        const halfH = height / 2;
        cx = Math.max(halfW, Math.min(cx, 100 - halfW));
        cy = Math.max(halfH, Math.min(cy, 100 - halfH));

        setCrop({ cx, cy, width, height, rotation });
    }, [interaction, imageDims, aspectRatioKey]);
    
    const handleInteractionEnd = useCallback(() => setInteraction(null), []);

    useEffect(() => {
        if (interaction) {
            window.addEventListener('mousemove', handleInteractionMove);
            window.addEventListener('touchmove', handleInteractionMove);
            window.addEventListener('mouseup', handleInteractionEnd);
            window.addEventListener('touchend', handleInteractionEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handleInteractionMove);
            window.removeEventListener('touchmove', handleInteractionMove);
            window.removeEventListener('mouseup', handleInteractionEnd);
            window.removeEventListener('touchend', handleInteractionEnd);
        };
    }, [interaction, handleInteractionMove, handleInteractionEnd]);

    const cropBoxStyle: React.CSSProperties = {
        left: `${crop.cx - crop.width / 2}%`,
        top: `${crop.cy - crop.height / 2}%`,
        width: `${crop.width}%`,
        height: `${crop.height}%`,
        transform: `rotate(${crop.rotation}deg)`,
    };

    const HANDLES = ['t', 'b', 'l', 'r', 'tl', 'tr', 'bl', 'br'];

    return (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10 gap-4">
            <div ref={containerRef} className="relative w-full h-full max-w-[90vw] max-h-[calc(100vh-150px)] flex items-center justify-center p-4">
                <div className="relative" style={{ width: imageDims.width, height: imageDims.height }}>
                    <img src={image.src} alt="Cropping preview" className="w-full h-full object-contain" />
                    <div className="absolute inset-0">
                        <div
                            className="absolute cursor-move"
                            style={{ ...cropBoxStyle, boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }}
                            onMouseDown={(e) => handleInteractionStart(e, 'move', 'move')}
                            onTouchStart={(e) => handleInteractionStart(e, 'move', 'move')}
                        >
                             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full grid grid-cols-3 grid-rows-3 pointer-events-none">
                                {[...Array(9)].map((_, i) => <div key={i} className="border border-white/30" />)}
                            </div>
                            {HANDLES.map(handle => (
                                <div key={handle}
                                    className={`absolute w-3 h-3 bg-white rounded-full 
                                    ${handle.includes('t') ? 'top-0' : ''} ${handle.includes('b') ? 'bottom-0' : ''}
                                    ${handle.includes('l') ? 'left-0' : ''} ${handle.includes('r') ? 'right-0' : ''}
                                    ${!handle.includes('t') && !handle.includes('b') ? 'top-1/2' : ''}
                                    ${!handle.includes('l') && !handle.includes('r') ? 'left-1/2' : ''}
                                    ${(handle === 't' || handle === 'b') ? 'cursor-ns-resize' : ''}
                                    ${(handle === 'l' || handle === 'r') ? 'cursor-ew-resize' : ''}
                                    ${(handle === 'tl' || handle === 'br') ? 'cursor-nwse-resize' : ''}
                                    ${(handle === 'tr' || handle === 'bl') ? 'cursor-nesw-resize' : ''}
                                    `}
                                    style={{ transform: `translate(-50%, -50%) rotate(${-crop.rotation}deg)` }}
                                    onMouseDown={(e) => handleInteractionStart(e, 'resize', handle)}
                                    onTouchStart={(e) => handleInteractionStart(e, 'resize', handle)}
                                />
                            ))}
                            <div
                                className="absolute left-1/2 -bottom-8 w-6 h-6 bg-purple-500 rounded-full border-2 border-white cursor-grab flex items-center justify-center"
                                style={{ transform: `translateX(-50%) rotate(${-crop.rotation}deg)`}}
                                onMouseDown={(e) => handleInteractionStart(e, 'rotate', 'rotate')}
                                onTouchStart={(e) => handleInteractionStart(e, 'rotate', 'rotate')}
                            >
                                <RotateIcon className="w-4 h-4 text-white"/>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex items-center gap-2 bg-gray-700 rounded-lg p-1">
                    {Object.entries(aspectRatios).map(([key, { label }]) => (
                        <button key={key} onClick={() => setAspectRatioKey(key)} className={`px-3 py-1 text-sm rounded-md transition-colors ${aspectRatioKey === key ? 'bg-purple-600 text-white' : 'text-gray-300'}`}>
                            {label.split(' ')[0]}
                        </button>
                    ))}
                </div>
                <div className="flex gap-4">
                    <button onClick={onCancel} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-6 rounded-lg">{t('cancelCropButton')}</button>
                    <button onClick={handleApply} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg">{t('applyCropButton')}</button>
                </div>
            </div>
        </div>
    );
};


const TextPanel: React.FC<{
    selectedOverlay: Overlay | null;
    onUpdateOverlay: (id: string, updates: Partial<Overlay>) => void;
    onAddText: () => void;
    onAddWatermark: () => void;
    onDeleteOverlay: () => void;
    templates: TextOverlay[];
    onAddFromTemplate: (template: TextOverlay) => void;
    onUpdateTemplate: () => void;
    t: TFunction;
}> = ({ selectedOverlay, onUpdateOverlay, onAddText, onAddWatermark, onDeleteOverlay, templates, onAddFromTemplate, onUpdateTemplate, t }) => {
    
    const FONT_OPTIONS = [
        { name: '思源黑體', value: '"Noto Sans SC", sans-serif' },
        { name: '思源宋體', value: '"Noto Serif SC", serif' },
        { name: 'Roboto', value: '"Roboto", sans-serif' },
        { name: 'Playfair', value: '"Playfair Display", serif' },
        { name: '快樂體', value: '"ZCOOL KuaiLe", cursive' },
        { name: '馬善政', value: '"Ma Shan Zheng", cursive' },
        { name: '龙藏体', value: '"Long Cang", cursive' },
        { name: '芝麻星', value: '"Zhi Mang Xing", cursive' },
        { name: 'Lobster', value: '"Lobster", cursive' },
        { name: 'Pacifico', value: '"Pacifico", cursive' },
        { name: 'Caveat', value: '"Caveat", cursive' },
        { name: 'Kalam', value: '"Kalam", cursive' },
    ];

    const handleStyleChange = (prop: string, value: any) => {
        if (selectedOverlay) {
            onUpdateOverlay(selectedOverlay.id, { [prop]: value });
        }
    };

    const positions = [
        { name: 'top-left', x: (o: Overlay) => o.width / 2, y: (o: Overlay) => o.height / 2 },
        { name: 'top-center', x: () => 50, y: (o: Overlay) => o.height / 2 },
        { name: 'top-right', x: (o: Overlay) => 100 - o.width / 2, y: (o: Overlay) => o.height / 2 },
        { name: 'middle-left', x: (o: Overlay) => o.width / 2, y: () => 50 },
        { name: 'center', x: () => 50, y: () => 50 },
        { name: 'middle-right', x: (o: Overlay) => 100 - o.width / 2, y: () => 50 },
        { name: 'bottom-left', x: (o: Overlay) => o.width / 2, y: (o: Overlay) => 100 - o.height / 2 },
        { name: 'bottom-center', x: () => 50, y: (o: Overlay) => 100 - o.height / 2 },
        { name: 'bottom-right', x: (o: Overlay) => 100 - o.width / 2, y: (o: Overlay) => 100 - o.height / 2 },
    ];

    const handlePositionClick = (xCalc: (o: Overlay) => number, yCalc: (o: Overlay) => number) => {
        if (selectedOverlay) {
            onUpdateOverlay(selectedOverlay.id, {
                x: xCalc(selectedOverlay),
                y: yCalc(selectedOverlay),
            });
        }
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
                <button onClick={onAddText} className="flex items-center justify-center gap-2 w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-3 rounded-lg"><TextIcon className="w-5 h-5"/>{t('addTextButton')}</button>
                <button onClick={onAddWatermark} className="flex items-center justify-center gap-2 w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-3 rounded-lg"><ImageIcon className="w-5 h-5"/>{t('addWatermarkButton')}</button>
            </div>
            
            <div className="p-3 bg-gray-900/50 rounded-lg space-y-3">
                 <h4 className="font-semibold text-gray-400">{t('textTemplatesTitle')}</h4>
                 <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {templates.map(template => (
                        <button key={template.id} onClick={() => onAddFromTemplate(template)} className="text-sm text-left bg-gray-700 hover:bg-gray-600 text-gray-300 py-1.5 px-2 rounded-md truncate">{template.text}</button>
                    ))}
                 </div>
            </div>

            {selectedOverlay && (
                <div className="space-y-4 p-3 bg-gray-900/50 rounded-lg border border-purple-500/50">
                    {selectedOverlay.type === 'text' && (
                        <>
                            <div>
                                <label htmlFor="textContent" className="text-sm text-gray-300 mb-1 block">{t('textInputLabel')}</label>
                                <textarea
                                    id="textContent"
                                    value={selectedOverlay.text}
                                    onChange={(e) => handleStyleChange('text', e.target.value)}
                                    className="w-full h-16 p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-200"
                                />
                            </div>
                            <div>
                                <label htmlFor="fontFamily" className="text-sm text-gray-300 mb-1 block">{t('fontLabel')}</label>
                                <select
                                    id="fontFamily"
                                    value={selectedOverlay.fontFamily}
                                    onChange={(e) => handleStyleChange('fontFamily', e.target.value)}
                                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-gray-200"
                                >
                                    {FONT_OPTIONS.map(font => (
                                        <option key={font.value} value={font.value}>{font.name}</option>
                                    ))}
                                </select>
                            </div>
                             <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-sm text-gray-300 mb-1 block">{t('colorLabel')}</label>
                                    <input
                                        type="color"
                                        value={selectedOverlay.color}
                                        onChange={(e) => handleStyleChange('color', e.target.value)}
                                        className="w-full h-8 rounded border-none bg-gray-700 cursor-pointer"
                                    />
                                </div>
                                <div className="flex gap-1 items-end">
                                    <button onClick={() => handleStyleChange('bold', !selectedOverlay.bold)} className={`flex-1 p-1.5 rounded ${selectedOverlay.bold ? 'bg-purple-600' : 'bg-gray-700'}`}>B</button>
                                    <button onClick={() => handleStyleChange('italic', !selectedOverlay.italic)} className={`flex-1 p-1.5 rounded ${selectedOverlay.italic ? 'bg-purple-600' : 'bg-gray-700'}`}>I</button>
                                </div>
                             </div>
                             <AdjustmentSlider label={t('fontSizeLabel')} value={selectedOverlay.fontSize} min={10} max={200} onChange={v => handleStyleChange('fontSize', v)} resetValue={48} />
                        </>
                    )}
                    
                    <AdjustmentSlider label={t('opacityLabel')} value={selectedOverlay.opacity} min={0} max={100} onChange={v => handleStyleChange('opacity', v)} resetValue={100} />
                    
                    <div>
                         <label className="text-sm text-gray-300 mb-1 block">{t('positionLabel')}</label>
                         <div className="grid grid-cols-3 gap-1">
                             {positions.map(pos => (
                                 <button key={pos.name} onClick={() => handlePositionClick(pos.x, pos.y)} className="h-6 bg-gray-700 hover:bg-gray-600 rounded" title={pos.name}></button>
                             ))}
                         </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-700">
                         {selectedOverlay.type === 'text' && selectedOverlay.templateId && (
                            <button onClick={onUpdateTemplate} className="text-xs bg-blue-600/80 hover:bg-blue-700 text-white font-semibold py-2 px-2 rounded">{t('updateTemplateButton')}</button>
                         )}
                         <button onClick={onDeleteOverlay} className="flex items-center justify-center gap-1.5 text-xs bg-red-600/80 hover:bg-red-700 text-white font-semibold py-2 px-2 rounded col-span-2">
                             <TrashIcon className="w-4 h-4" /> {t('deleteLayerButton')}
                         </button>
                    </div>
                </div>
            )}
        </div>
    );
};
