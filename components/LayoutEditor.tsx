import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { TFunction } from '../types';
import { CloseIcon, PlusIcon, MirrorIcon, TrashIcon, BringForwardIcon, SendBackwardIcon, RotateIcon } from './Icons';

interface LayoutEditorProps {
    onComplete: (dataUrl: string) => void;
    onClose: () => void;
    t: TFunction;
}

interface Layer {
    id: string;
    dataUrl: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    scaleX: number; // 1 or -1 for mirroring
    zIndex: number;
    aspectRatio: number;
}

type Interaction = {
    type: 'move' | 'resize' | 'rotate';
    layerId: string;
    startX: number;
    startY: number;
    startLayer: Layer;
    startAngle?: number;
    center?: { x: number; y: number };
} | null;

const CANVAS_WIDTH_LANDSCAPE = 2560;
const CANVAS_HEIGHT_LANDSCAPE = 1440;

export const LayoutEditor: React.FC<LayoutEditorProps> = ({ onComplete, onClose, t }) => {
    const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
    const [layers, setLayers] = useState<Layer[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [interaction, setInteraction] = useState<Interaction>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [viewScale, setViewScale] = useState(1);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasAreaRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastZIndex = useRef<number>(0);
    
    const selectedLayer = layers.find(l => l.id === selectedLayerId) || null;
    const canvasWidth = orientation === 'landscape' ? CANVAS_WIDTH_LANDSCAPE : CANVAS_HEIGHT_LANDSCAPE;
    const canvasHeight = orientation === 'landscape' ? CANVAS_HEIGHT_LANDSCAPE : CANVAS_WIDTH_LANDSCAPE;

    useEffect(() => {
        const calculateScale = () => {
            if (containerRef.current) {
                const { clientWidth: containerWidth, clientHeight: containerHeight } = containerRef.current;
                if (containerWidth === 0 || containerHeight === 0) return;

                const scaleX = containerWidth / canvasWidth;
                const scaleY = containerHeight / canvasHeight;
                setViewScale(Math.min(scaleX, scaleY));
            }
        };

        const observer = new ResizeObserver(calculateScale);
        const container = containerRef.current;
        if (container) {
            observer.observe(container);
        }

        const timeoutId = setTimeout(calculateScale, 50);

        return () => {
            clearTimeout(timeoutId);
            if (container) {
                observer.unobserve(container);
            }
        };
    }, [canvasWidth, canvasHeight]);


    const handleFiles = (files: FileList) => {
        const filesArray = Array.from(files).filter(file => file.type.startsWith('image/'));
        if (filesArray.length === 0) return;

        filesArray.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target?.result as string;
                const img = new Image();
                img.onload = () => {
                    const aspectRatio = img.naturalWidth / img.naturalHeight;
                    const initialWidth = Math.min(img.naturalWidth, canvasWidth * 0.25);
                    const initialHeight = initialWidth / aspectRatio;

                    const newLayer: Layer = {
                        id: `${file.name}-${Date.now()}`,
                        dataUrl,
                        x: (canvasWidth / 2) - (initialWidth / 2),
                        y: (canvasHeight / 2) - (initialHeight / 2),
                        width: initialWidth,
                        height: initialHeight,
                        rotation: 0,
                        scaleX: 1,
                        zIndex: ++lastZIndex.current,
                        aspectRatio,
                    };
                    setLayers(prev => [...prev, newLayer]);
                    setSelectedLayerId(newLayer.id);
                };
                img.src = dataUrl;
            };
            reader.readAsDataURL(file);
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            handleFiles(e.target.files);
            e.target.value = '';
        }
    };

    const updateLayer = (id: string, updates: Partial<Layer>) => {
        setLayers(layers => layers.map(l => l.id === id ? { ...l, ...updates } : l));
    };
    
    const handleInteractionStart = (
        e: React.MouseEvent<HTMLDivElement>,
        type: Interaction['type'],
        layer: Layer
    ) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!canvasAreaRef.current) return;
        const canvasBounds = canvasAreaRef.current.getBoundingClientRect();

        const baseInteraction = {
            type,
            layerId: layer.id,
            startX: e.clientX,
            startY: e.clientY,
            startLayer: layer,
        };

        if (type === 'rotate') {
            const centerX = canvasBounds.left + (layer.x + layer.width / 2) * viewScale;
            const centerY = canvasBounds.top + (layer.y + layer.height / 2) * viewScale;
            const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
            setInteraction({ ...baseInteraction, startAngle, center: { x: centerX, y: centerY } });
        } else {
            setInteraction(baseInteraction);
        }
    };
    
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!interaction) return;
        
        const { type, startX, startY, startLayer } = interaction;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (type === 'move') {
            updateLayer(startLayer.id, {
                x: startLayer.x + dx / viewScale,
                y: startLayer.y + dy / viewScale,
            });
        } else if (type === 'resize') {
            const newWidth = Math.max(20, startLayer.width + dx / viewScale);
            updateLayer(startLayer.id, {
                width: newWidth,
                height: newWidth / startLayer.aspectRatio,
            });
        } else if (type === 'rotate' && interaction.center && interaction.startAngle !== undefined) {
            const { center, startAngle } = interaction;
            const currentAngle = Math.atan2(e.clientY - center.y, e.clientX - center.x) * (180 / Math.PI);
            const rotation = startLayer.rotation + (currentAngle - startAngle);
            updateLayer(startLayer.id, { rotation });
        }
    }, [interaction, viewScale]);

    const handleMouseUp = useCallback(() => {
        setInteraction(null);
    }, []);

    useEffect(() => {
        if (interaction) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [interaction, handleMouseMove, handleMouseUp]);

    const handleExport = async () => {
        setIsExporting(true);
        setSelectedLayerId(null);
    
        // A small timeout to allow UI to update (hide selection box)
        await new Promise(resolve => setTimeout(resolve, 50));
    
        try {
            const canvas = document.createElement('canvas');
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Could not get canvas context");
    
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
    
            const imageElements = await Promise.all(
                layers.map(layer => new Promise<HTMLImageElement>((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                    img.src = layer.dataUrl;
                }))
            );
    
            const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);
    
            sortedLayers.forEach(layer => {
                const img = imageElements[layers.findIndex(l => l.id === layer.id)];
                ctx.save();
                const centerX = layer.x + layer.width / 2;
                const centerY = layer.y + layer.height / 2;
                ctx.translate(centerX, centerY);
                ctx.rotate((layer.rotation * Math.PI) / 180);
                ctx.scale(layer.scaleX, 1);
                ctx.drawImage(img, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
                ctx.restore();
            });
    
            const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
            onComplete(dataUrl);
        } catch (error) {
            console.error("Failed to export layout:", error);
            setIsExporting(false);
        }
    };
    
    const changeZIndex = (direction: 'up' | 'down') => {
        if (!selectedLayer) return;
        const newZIndex = direction === 'up' ? ++lastZIndex.current : selectedLayer.zIndex - 1;
        if (direction === 'down' && newZIndex < 1) return;
        updateLayer(selectedLayerId!, { zIndex: newZIndex });
    }

    const deleteLayer = () => {
        if (!selectedLayerId) return;
        setLayers(l => l.filter(layer => layer.id !== selectedLayerId));
        setSelectedLayerId(null);
    }
    
    return (
        <div className="fixed inset-0 bg-gray-900/80 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full h-full flex flex-col border border-gray-700" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <header className="flex items-center justify-between p-3 border-b border-gray-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-200">{t('layoutEditorTitle')}</h2>
                    <div className="flex items-center gap-2">
                         {/* Orientation Switch */}
                        <div className="flex items-center bg-gray-700 rounded-lg p-1">
                            <button onClick={() => setOrientation('landscape')} className={`px-3 py-1 text-sm rounded-md ${orientation === 'landscape' ? 'bg-purple-600 text-white' : 'text-gray-300'}`}>{t('layoutLandscape')}</button>
                            <button onClick={() => setOrientation('portrait')} className={`px-3 py-1 text-sm rounded-md ${orientation === 'portrait' ? 'bg-purple-600 text-white' : 'text-gray-300'}`}>{t('layoutPortrait')}</button>
                        </div>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-700 rounded-full"><CloseIcon className="w-6 h-6" /></button>
                    </div>
                </header>
                
                {/* Main Content */}
                <main className="flex-grow flex p-2 gap-2 overflow-hidden">
                    {/* Toolbar */}
                    <div className="w-48 flex-shrink-0 bg-gray-900/50 rounded-lg p-3 flex flex-col gap-3">
                         <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg">
                            <PlusIcon className="w-5 h-5"/>
                            <span>{t('layoutAddImage')}</span>
                        </button>
                        <input type="file" onChange={handleFileChange} accept="image/*" multiple ref={fileInputRef} className="hidden" />

                        {selectedLayer && (
                            <div className="flex flex-col gap-2 pt-2 border-t border-gray-700">
                                 <h4 className="text-sm font-semibold text-gray-400 text-center">Selected Layer</h4>
                                <button onClick={() => changeZIndex('up')} className="flex items-center gap-2 w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-3 rounded-lg"><BringForwardIcon className="w-5 h-5"/> {t('layoutBringForward')}</button>
                                <button onClick={() => changeZIndex('down')} className="flex items-center gap-2 w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-3 rounded-lg"><SendBackwardIcon className="w-5 h-5"/> {t('layoutSendBackward')}</button>
                                <button onClick={() => updateLayer(selectedLayerId!, { scaleX: selectedLayer.scaleX * -1 })} className="flex items-center gap-2 w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-3 rounded-lg"><MirrorIcon className="w-5 h-5"/> {t('layoutMirror')}</button>
                                <button onClick={deleteLayer} className="flex items-center gap-2 w-full bg-red-600/80 hover:bg-red-700 text-white py-2 px-3 rounded-lg"><TrashIcon className="w-5 h-5"/> {t('layoutDelete')}</button>
                            </div>
                        )}
                    </div>

                    {/* Canvas Area */}
                    <div ref={containerRef} className="flex-grow bg-gray-900/50 rounded-lg flex items-center justify-center p-2 overflow-hidden">
                        <div
                            ref={canvasAreaRef}
                            className="bg-white shadow-lg relative overflow-hidden flex-shrink-0"
                            style={{
                                width: `${canvasWidth}px`,
                                height: `${canvasHeight}px`,
                                transform: `scale(${viewScale})`,
                                transformOrigin: 'center',
                            }}
                            onClick={() => setSelectedLayerId(null)}
                         >
                            {layers.sort((a,b) => a.zIndex - b.zIndex).map(layer => (
                                <div
                                    key={layer.id}
                                    className="absolute"
                                    onClick={(e) => { e.stopPropagation(); setSelectedLayerId(layer.id); }}
                                    onMouseDown={(e) => handleInteractionStart(e, 'move', layer)}
                                    style={{
                                        left: layer.x,
                                        top: layer.y,
                                        width: layer.width,
                                        height: layer.height,
                                        transform: `rotate(${layer.rotation}deg)`,
                                        zIndex: layer.zIndex,
                                        cursor: 'move'
                                    }}
                                >
                                    <img src={layer.dataUrl} className="w-full h-full pointer-events-none" style={{transform: `scaleX(${layer.scaleX})`}} draggable="false" />
                                    {selectedLayerId === layer.id && (
                                        <>
                                            <div className="absolute -inset-0.5 border-2 border-purple-500 pointer-events-none" />
                                            <div
                                                className="absolute -top-2 -right-2 w-5 h-5 bg-purple-500 rounded-full border-2 border-white cursor-nwse-resize"
                                                onMouseDown={(e) => handleInteractionStart(e, 'resize', layer)}
                                            />
                                            <div
                                                className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-5 h-5 bg-purple-500 rounded-full border-2 border-white cursor-grab"
                                                onMouseDown={(e) => handleInteractionStart(e, 'rotate', layer)}
                                            >
                                                <RotateIcon className="w-full h-full text-white p-0.5" />
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </main>
                
                {/* Footer */}
                <footer className="flex justify-end items-center p-3 border-t border-gray-700 flex-shrink-0 gap-3">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg">{t('layoutCancel')}</button>
                    <button onClick={handleExport} disabled={layers.length === 0 || isExporting} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                        {isExporting ? t('generatingButton') : t('layoutAiEdit')}
                    </button>
                </footer>
            </div>
        </div>
    );
};
