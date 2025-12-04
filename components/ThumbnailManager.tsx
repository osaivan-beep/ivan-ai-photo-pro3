
import React, { useState } from 'react';
import type { UploadedImage, TFunction } from '../types';
import { CloseIcon, PlusIcon, EditIcon, StampIcon } from './Icons';

interface ThumbnailManagerProps {
  images: UploadedImage[];
  selectedImageId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAddImage: () => void;
  t: TFunction;
  onReorder: (images: UploadedImage[]) => void;
  onEdit: (id: string) => void;
  onOpenWatermarkGenerator: () => void;
}

export const ThumbnailManager: React.FC<ThumbnailManagerProps> = ({ images, selectedImageId, onSelect, onDelete, onAddImage, t, onReorder, onEdit, onOpenWatermarkGenerator }) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDelete(id);
  };

  const handleEdit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onEdit(id);
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      setDraggingId(id);
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.preventDefault();
    if (draggingId && id !== draggingId) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOverId(null);
  };

  const cleanupDragState = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');

    if (!draggedId || draggedId === dropId) {
      cleanupDragState();
      return;
    }

    const draggedIndex = images.findIndex(img => img.id === draggedId);
    const dropIndex = images.findIndex(img => img.id === dropId);

    if (draggedIndex === -1 || dropIndex === -1) {
      cleanupDragState();
      return;
    }

    const reorderedImages = [...images];
    const [draggedItem] = reorderedImages.splice(draggedIndex, 1);
    reorderedImages.splice(dropIndex, 0, draggedItem);

    onReorder(reorderedImages);
    cleanupDragState();
  };

  const handleDragEnd = () => {
    cleanupDragState();
  };


  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-gray-400">{t('thumbnailsTitle')}</h3>
        <div className="flex items-center gap-2">
            <button
                onClick={onOpenWatermarkGenerator}
                className="flex items-center gap-1.5 text-sm bg-blue-600/80 text-white font-semibold py-1 px-3 rounded-lg hover:bg-blue-700 transition-colors"
                aria-label={t('watermarkGeneratorButton')}
                title={t('watermarkGeneratorButton')}
            >
                <StampIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{t('watermarkGeneratorButton')}</span>
            </button>
            <button
            onClick={onAddImage}
            className="flex items-center gap-1.5 text-sm bg-purple-600/80 text-white font-semibold py-1 px-3 rounded-lg hover:bg-purple-700 transition-colors"
            aria-label={t('addImageButton')}
            >
            <PlusIcon className="w-4 h-4" />
            <span className="hidden sm:inline">{t('addImageButton')}</span>
            </button>
        </div>
      </div>
      {images.length > 0 && (
        <div className="flex gap-3 overflow-x-auto p-2 bg-gray-900/50 rounded-lg">
          {images.map((image, index) => {
            const isDragging = draggingId === image.id;
            const isDragOver = dragOverId === image.id;
            const isSelected = selectedImageId === image.id;

            const borderClass = isDragOver
              ? 'border-purple-500 scale-110 ring-2 ring-purple-500 ring-offset-2 ring-offset-gray-900'
              : (isSelected ? 'border-purple-500 scale-105' : 'border-transparent hover:border-gray-500');
              
            const cursorClass = isDragging ? 'cursor-grabbing' : 'cursor-grab';

            return (
              <div
                key={image.id}
                draggable
                onDragStart={(e) => handleDragStart(e, image.id)}
                onDragOver={(e) => handleDragOver(e, image.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, image.id)}
                onDragEnd={handleDragEnd}
                onClick={() => onSelect(image.id)}
                className={`relative group flex-shrink-0 w-24 h-24 rounded-md overflow-hidden border-2 transition-all ${isDragging ? 'opacity-30' : 'opacity-100'} ${borderClass} ${cursorClass}`}
              >
                <img src={image.dataUrl} alt={image.file.name} className="w-full h-full object-cover pointer-events-none" />
                <div className="absolute top-1 left-1 bg-purple-600 text-white text-sm font-extrabold rounded-full w-6 h-6 flex items-center justify-center pointer-events-none shadow-md">
                  {index + 1}
                </div>
                <div className="absolute top-1 right-1 flex flex-col gap-1">
                  <button
                    onClick={(e) => handleDelete(e, image.id)}
                    className="bg-black/50 hover:bg-red-600/80 text-white rounded-full p-1 transition-colors"
                    title={t('deleteButton')}
                    aria-label={`${t('deleteButton')} ${image.file.name}`}
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => handleEdit(e, image.id)}
                    className="bg-black/50 hover:bg-blue-600/80 text-white rounded-full p-1 transition-colors"
                    title={t('editButton')}
                    aria-label={`${t('editButton')} ${image.file.name}`}
                  >
                    <EditIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
