import React, { useState, useEffect } from 'react';
import { EditIcon, SaveIcon } from './Icons';
import type { TFunction } from '../types';

interface QuickPromptsProps {
  prompts: Record<string, string[]>;
  onPromptClick: (prompt: string) => void;
  onPromptsChange: (prompts: Record<string, string[]>) => void;
  t: TFunction;
}

const CATEGORIES = ['birds', 'scenery', 'portrait', 'comprehensive'];

export const QuickPrompts: React.FC<QuickPromptsProps> = ({ prompts, onPromptClick, onPromptsChange, t }) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(() => {
    // Retrieve the last active category from localStorage or default to the first new category
    const lastCategory = localStorage.getItem('activePromptCategory');
    return lastCategory && CATEGORIES.includes(lastCategory) ? lastCategory : 'birds';
  });

  // Save the active category to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('activePromptCategory', activeCategory);
  }, [activeCategory]);

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditText(prompts[activeCategory][index]);
  };

  const handleSave = (index: number) => {
    const newPromptsForCategory = [...(prompts[activeCategory] || [])];
    newPromptsForCategory[index] = editText;
    const newAllPrompts = {
      ...prompts,
      [activeCategory]: newPromptsForCategory,
    };
    onPromptsChange(newAllPrompts);
    setEditingIndex(null);
    setEditText('');
  };

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key === 'Enter') {
      handleSave(index);
    }
  };

  const currentPrompts = prompts[activeCategory] || [];

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-400">{t('quickPromptsLabel')}</h3>
      </div>
      <div className="flex flex-wrap gap-2 mb-4 p-2 bg-gray-900/50 rounded-lg">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`flex-grow text-sm font-semibold py-2 px-3 rounded-md transition-colors ${
              activeCategory === category
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {t(`${category}Category` as any)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {currentPrompts.map((prompt, index) => (
          <div key={`${activeCategory}-${index}`} className="relative">
            {editingIndex === index ? (
              <div className="flex items-center">
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  className="w-full text-sm p-2 pr-10 bg-gray-600 border border-purple-500 rounded-md focus:ring-2 focus:ring-purple-500 text-gray-200"
                  autoFocus
                  onBlur={() => handleSave(index)} // Save when input loses focus
                />
                <button
                  onClick={() => handleSave(index)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-300 hover:text-green-400"
                  aria-label="Save prompt"
                >
                  <SaveIcon className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="group relative">
                <button
                  onClick={() => onPromptClick(prompt)}
                  className="w-full h-full text-left text-sm bg-gray-700 hover:bg-gray-600/70 text-gray-300 font-medium py-2 px-3 rounded-md transition-colors"
                >
                  {prompt}
                </button>
                <button
                  onClick={() => handleEdit(index)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 bg-gray-700 rounded-full text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-purple-400"
                  aria-label="Edit prompt"
                >
                  <EditIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};