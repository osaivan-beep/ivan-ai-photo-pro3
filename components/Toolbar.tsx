import React from 'react';
import { BrushIcon, TrashIcon } from './Icons';
import type { TFunction } from '../types';

interface ToolbarProps {
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  onClear: () => void;
  t: TFunction;
  brushColor: string;
  onBrushColorChange: (color: string) => void;
}

const COLORS = [
  '#ef4444', // red-500
  '#3b82f6', // blue-500
  '#22c55e', // green-500
  '#eab308', // yellow-500
  '#ffffff', // white
  '#000000', // black
];

export const Toolbar: React.FC<ToolbarProps> = ({ brushSize, onBrushSizeChange, onClear, t, brushColor, onBrushColorChange }) => {
  return (
    <div className="bg-gray-700/50 p-4 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3 flex-grow w-full">
        <BrushIcon className="w-6 h-6 text-gray-400" />
        <label onDoubleClick={() => onBrushSizeChange(10)} htmlFor="brushSize" className="text-sm font-medium text-gray-400 cursor-pointer" title="Double-click to reset">{t('brushSizeLabel')}</label>
        <input
          id="brushSize"
          type="range"
          min="1"
          max="50"
          value={brushSize}
          onChange={(e) => onBrushSizeChange(Number(e.target.value))}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500 flex-grow"
        />
        <span onDoubleClick={() => onBrushSizeChange(10)} title="Double-click to reset" className="text-sm font-semibold w-8 text-center bg-gray-600 text-gray-200 rounded-md px-2 py-1 cursor-pointer">{brushSize}</span>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
        <div className="flex items-center gap-2">
            {COLORS.map((color) => (
                <button
                key={color}
                onClick={() => onBrushColorChange(color)}
                className={`w-6 h-6 rounded-full border-2 border-gray-800 transition-transform transform hover:scale-110 ${brushColor === color ? 'ring-2 ring-offset-2 ring-offset-gray-700 ring-purple-500' : ''}`}
                style={{ backgroundColor: color }}
                aria-label={`Select color ${color}`}
                />
            ))}
        </div>
        <button
          onClick={onClear}
          className="flex items-center gap-2 bg-red-600/80 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
          title="Clear Drawings"
        >
          <TrashIcon className="w-5 h-5" />
          <span className="hidden sm:inline">{t('clearButton')}</span>
        </button>
      </div>
    </div>
  );
};