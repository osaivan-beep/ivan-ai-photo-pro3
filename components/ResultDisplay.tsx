


import React, { useState, useEffect, useRef } from 'react';
import type { ApiResult, TFunction } from '../types';
import { ImageIcon, DownloadIcon, EditIcon, CompareIcon, HdIcon, RefreshIcon } from './Icons';

interface ResultDisplayProps {
  loading: boolean;
  error: string | null;
  apiResult: ApiResult;
  t: TFunction;
  onEditResult: () => void;
  onUpdateResult?: (url: string) => void;
  originalImageSrc: string | null;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ loading, error, apiResult, t, onEditResult, onUpdateResult, originalImageSrc }) => {
  const [isComparing, setIsComparing] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [resolution, setResolution] = useState<{ width: number; height: number } | null>(null);
  const [downloadFormat, setDownloadFormat] = useState<'png' | 'jpg'>('png');

  useEffect(() => {
    if (apiResult.imageUrl) {
        const img = new Image();
        img.onload = () => {
            setResolution({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.src = apiResult.imageUrl;
    } else {
        setResolution(null);
    }
  }, [apiResult.imageUrl]);

  const applySharpenFilter = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const w = width;
      const h = height;
      
      // Standard Sharpen Kernel
      //  0 -1  0
      // -1  5 -1
      //  0 -1  0
      const weights = [0, -1, 0, -1, 5, -1, 0, -1, 0];
      const side = Math.round(Math.sqrt(weights.length));
      const halfSide = Math.floor(side / 2);
      
      const outputData = ctx.createImageData(width, height);
      const dst = outputData.data;

      for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
              const sy = y;
              const sx = x;
              const dstOff = (y * w + x) * 4;
              
              let r = 0, g = 0, b = 0;
              dst[dstOff + 3] = data[dstOff + 3];

              for (let cy = 0; cy < side; cy++) {
                  for (let cx = 0; cx < side; cx++) {
                      const scy = sy + cy - halfSide;
                      const scx = sx + cx - halfSide;
                      
                      if (scy >= 0 && scy < h && scx >= 0 && scx < w) {
                          const srcOff = (scy * w + scx) * 4;
                          const wt = weights[cy * side + cx];
                          
                          r += data[srcOff] * wt;
                          g += data[srcOff + 1] * wt;
                          b += data[srcOff + 2] * wt;
                      }
                  }
              }
              
              dst[dstOff] = Math.min(255, Math.max(0, r));
              dst[dstOff + 1] = Math.min(255, Math.max(0, g));
              dst[dstOff + 2] = Math.min(255, Math.max(0, b));
          }
      }
      
      ctx.putImageData(outputData, 0, 0);
  };

  const handleUpscale = async () => {
      if (!apiResult.imageUrl || !onUpdateResult) return;
      setIsUpscaling(true);

      try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = apiResult.imageUrl;
          await new Promise((resolve) => { img.onload = resolve; });

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error("Could not get canvas context");

          const newWidth = img.naturalWidth * 2;
          const newHeight = img.naturalHeight * 2;

          canvas.width = newWidth;
          canvas.height = newHeight;

          // 1. High Quality Scaling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, newWidth, newHeight);

          // 2. Apply Sharpen Filter
          await new Promise(resolve => setTimeout(resolve, 50));
          applySharpenFilter(ctx, newWidth, newHeight);

          const newUrl = canvas.toDataURL('image/png');
          onUpdateResult(newUrl);

      } catch (e) {
          console.error("Upscale failed", e);
          alert("放大失敗，請重試。");
      } finally {
          setIsUpscaling(false);
      }
  };

  const handleDownload = async () => {
    if (!apiResult.imageUrl) return;
    
    let finalUrl = apiResult.imageUrl;
    let filename = `ivan-ai-photo-${Date.now()}.${downloadFormat}`;

    if (downloadFormat === 'jpg') {
        try {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = apiResult.imageUrl;
            await new Promise((resolve) => { img.onload = resolve; });

            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Fill white background for JPG
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                // Set quality to 100% (1.0)
                finalUrl = canvas.toDataURL('image/jpeg', 1.0);
            }
        } catch (e) {
            console.error("JPG conversion failed", e);
        }
    }

    const link = document.createElement('a');
    link.href = finalUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-4 h-full relative">
      <div className="flex-grow bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center relative border-2 border-gray-700 border-dashed min-h-[300px]">
        {loading ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-gray-400 animate-pulse">{t('generatingButton')}</p>
          </div>
        ) : error ? (
          <div className="text-red-400 p-4 text-center max-w-md">
            <p className="font-bold mb-2">⚠️ {t('errorTitle')}</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : apiResult.imageUrl ? (
          <div className="relative w-full h-full flex items-center justify-center group">
            <img
              src={isComparing && originalImageSrc ? originalImageSrc : apiResult.imageUrl}
              alt="Result"
              className="max-w-full max-h-full object-contain shadow-2xl"
            />
            {isComparing && (
                <div className="absolute top-4 left-4 bg-black/70 text-white text-xs px-2 py-1 rounded pointer-events-none">
                    Original
                </div>
            )}
            
            {/* Resolution Badge */}
            {resolution && (
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white text-xs font-mono px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2 shadow-lg">
                    <div className={`w-2 h-2 rounded-full ${isUpscaling ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></div>
                    {isUpscaling ? t('upscalingState') : `${resolution.width} x ${resolution.height}`}
                </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-500">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-gray-300">{t('initialResultTitle')}</h3>
            <p className="text-sm">{t('initialResultSubtitle')}</p>
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap gap-3">
        {apiResult.imageUrl && !loading && (
            <>
                <div className="flex bg-gray-700 rounded-lg p-1 border border-gray-600">
                    <button 
                        onClick={() => setDownloadFormat('png')} 
                        className={`px-3 py-2 text-xs font-bold rounded-md transition-colors ${downloadFormat === 'png' ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        PNG
                    </button>
                    <button 
                        onClick={() => setDownloadFormat('jpg')} 
                        className={`px-3 py-2 text-xs font-bold rounded-md transition-colors ${downloadFormat === 'jpg' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        JPG
                    </button>
                </div>

                <button
                    onClick={handleDownload}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform active:scale-95"
                >
                    <DownloadIcon className="w-5 h-5" />
                    {t('downloadButton')}
                </button>

                <button
                    onClick={onEditResult}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform active:scale-95"
                >
                    <EditIcon className="w-5 h-5" />
                    {t('editResultButton')}
                </button>
                
                {onUpdateResult && (
                    <button
                        onClick={handleUpscale}
                        disabled={isUpscaling}
                        className={`px-4 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg border border-yellow-500/30
                            ${isUpscaling ? 'bg-yellow-900/50 text-yellow-200 cursor-wait' : 'bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400 hover:text-yellow-300'}
                        `}
                        title="2x Upscale + Sharpen"
                    >
                        {isUpscaling ? (
                            <RefreshIcon className="w-5 h-5 animate-spin"/>
                        ) : (
                            <HdIcon className="w-5 h-5" />
                        )}
                        <span className="hidden xl:inline">{t('upscale2xButton')}</span>
                    </button>
                )}

                {originalImageSrc && (
                    <button
                        onMouseDown={() => setIsComparing(true)}
                        onMouseUp={() => setIsComparing(false)}
                        onMouseLeave={() => setIsComparing(false)}
                        onTouchStart={() => setIsComparing(true)}
                        onTouchEnd={() => setIsComparing(false)}
                        className="bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold p-3 rounded-xl transition-colors shadow-lg"
                        title={t('compareButton')}
                    >
                        <CompareIcon className="w-5 h-5" />
                    </button>
                )}
            </>
        )}
      </div>
    </div>
  );
};
