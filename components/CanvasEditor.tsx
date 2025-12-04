
import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';

interface CanvasEditorProps {
  imageSrc: string;
  brushSize: number;
  brushColor: string;
  enableDrawing?: boolean;
}

export interface CanvasEditorRef {
  toDataURL: (type?: string, quality?: any) => string;
  reset: () => void;
}

export const CanvasEditor = forwardRef<CanvasEditorRef, CanvasEditorProps>(
  ({ imageSrc, brushSize, brushColor, enableDrawing = true }, ref) => {
    const mainCanvasRef = useRef<HTMLCanvasElement>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const lastPoint = useRef<{ x: number, y: number } | null>(null);
    const imageLoadedRef = useRef(false);

    useEffect(() => {
      if (!imageSrc) return;
      
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      // Reset state for new image
      imageLoadedRef.current = false;
      setImage(null);

      img.onload = () => {
        imageLoadedRef.current = true;
        setImage(img);
        setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        
        const mainCanvas = mainCanvasRef.current;
        const previewCanvas = previewCanvasRef.current;
        
        if (mainCanvas && previewCanvas) {
          mainCanvas.width = img.naturalWidth;
          mainCanvas.height = img.naturalHeight;
          previewCanvas.width = img.naturalWidth;
          previewCanvas.height = img.naturalHeight;
          
          const ctx = mainCanvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
            ctx.drawImage(img, 0, 0);
          }
        }
      };
      img.src = imageSrc;
    }, [imageSrc]);
    
    const resetCanvas = useCallback(() => {
        const canvas = mainCanvasRef.current;
        if (canvas && image && imageLoadedRef.current) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(image, 0, 0);
            }
        }
    }, [image]);

    useImperativeHandle(ref, () => ({
      toDataURL: (type?: string, quality?: any) => {
        const canvas = mainCanvasRef.current;
        return canvas ? canvas.toDataURL(type, quality) : '';
      },
      reset: resetCanvas
    }));
    
    const getCoordinates = useCallback((event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, clamp: boolean = true) => {
        const canvas = mainCanvasRef.current;
        if (!canvas || !image) return null;

        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if ('touches' in event) {
            if (event.touches.length === 0) return null;
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        
        const renderedWidth = rect.width;
        const relativeX = clientX - rect.left;
        const relativeY = clientY - rect.top;

        if (
          clamp &&
          (relativeX < 0 ||
          relativeX > renderedWidth ||
          relativeY < 0 ||
          relativeY > rect.height)
        ) {
          return null;
        }
        
        const scale = image.naturalWidth / renderedWidth;

        return {
            x: relativeX * scale,
            y: relativeY * scale
        };
    }, [image]);

    const startDrawing = (event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if (!enableDrawing) return;
      event.stopPropagation();
      const coords = getCoordinates(event);
      if (!coords) return;
      setIsDrawing(true);
      lastPoint.current = coords;
    };

    const draw = (event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if (!enableDrawing) return;
      event.stopPropagation();
      if (!isDrawing) return;
      const coords = getCoordinates(event);
      if (!coords || !lastPoint.current) return;
      
      const { x, y } = coords;
      const ctx = mainCanvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.closePath();
      }
      lastPoint.current = coords;
    };

    const stopDrawing = (event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if (!enableDrawing) return;
      event.stopPropagation();
      setIsDrawing(false);
      lastPoint.current = null;
    };
    
    const drawPreview = (event: React.MouseEvent<HTMLDivElement>) => {
      const previewCanvas = previewCanvasRef.current;
      if (!previewCanvas) return;
      const ctx = previewCanvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

      if (!enableDrawing) return;
      
      const coords = getCoordinates(event, false);
      if (!coords) return;
      
      const { x, y } = coords;
      
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, 2 * Math.PI, false);
      const colorWithAlpha = brushColor + '80'; 
      ctx.fillStyle = colorWithAlpha;
      ctx.fill();
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    };
    
    const clearPreview = () => {
        const previewCanvas = previewCanvasRef.current;
        if (!previewCanvas) return;
        const ctx = previewCanvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        drawPreview(e);
        draw(e);
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        draw(e);
    };

    const handleMouseLeave = () => {
        setIsDrawing(false);
        lastPoint.current = null;
        clearPreview();
    };

    return (
        <div
            className={`relative origin-center ${enableDrawing ? 'cursor-none' : 'cursor-grab'}`}
            style={{ width: dimensions.width, height: dimensions.height }}
            onMouseDown={startDrawing}
            onMouseMove={handleMouseMove}
            onMouseUp={stopDrawing}
            onMouseLeave={handleMouseLeave}
            onTouchStart={startDrawing}
            onTouchMove={handleTouchMove}
            onTouchEnd={stopDrawing}
        >
            <canvas
                ref={mainCanvasRef}
                className="absolute top-0 left-0 w-full h-full block" 
            />
            <canvas
                ref={previewCanvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none block"
            />
        </div>
    );
  }
);
