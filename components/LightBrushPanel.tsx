


import React from 'react';
import type { TFunction, StringTranslationKeys } from '../types';
import { UndoIcon, SunIcon, MoonIcon, ContrastIcon, SaturationIcon, SharpenIcon, BlurIcon } from './Icons';

export type LightBrushMode = 
  | 'increaseWhiteLight'
  | 'increaseYellowLight'
  | 'increaseBlueDark'
  | 'decreaseBrightness'
  | 'decreaseHighlights'
  | 'increaseShadows'
  | 'increaseContrast'
  | 'decreaseContrast'
  | 'increaseSaturation'
  | 'decreaseSaturation'
  | 'increaseSharpness'
  | 'increaseBlur';

export interface LightBrushSettings {
    size: number;
    strength: number;
    feather: number;
    mode: LightBrushMode;
    color: string;
}

interface LightBrushPanelProps {
    settings: LightBrushSettings;
    onSettingsChange: (settings: LightBrushSettings) => void;
    onUndo: () => void;
    t: TFunction;
}

const Slider: React.FC<{ label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; resetValue: number; }> =
    ({ label, value, onChange, min = 0, max = 100, step = 1, resetValue }) => (
        <div>
            <div className="flex justify-between items-center mb-1">
                <label onDoubleClick={() => onChange(resetValue)} title="Double-click to reset" className="text-sm text-gray-300 cursor-pointer">{label}</label>
                <span onDoubleClick={() => onChange(resetValue)} title="Double-click to reset" className="text-xs text-gray-400 font-mono bg-gray-700 px-2 py-0.5 rounded cursor-pointer">{value}</span>
            </div>
            <input
                type="range" min={min} max={max} step={step} value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
        </div>
    );

export const LightBrushPanel: React.FC<LightBrushPanelProps> = ({ settings, onSettingsChange, onUndo, t }) => {
    const handleSettingChange = (key: keyof LightBrushSettings, value: number | string | LightBrushMode) => {
        onSettingsChange({ ...settings, [key]: value });
    };

    const handleModeChange = (mode: LightBrushMode) => {
        let defaultColor = settings.color;
        if (mode === 'increaseWhiteLight') defaultColor = '#ffffff';
        else if (mode === 'increaseYellowLight') defaultColor = '#ffdc96';
        else if (mode === 'increaseBlueDark') defaultColor = '#b4c8ff';

        onSettingsChange({ ...settings, mode, color: defaultColor });
    };

    const MODES: { id: LightBrushMode; icon: React.FC<{ className?: string }>; labelKey: StringTranslationKeys; }[] = [
        { id: 'increaseWhiteLight', icon: SunIcon, labelKey: 'increaseWhiteLight' },
        { id: 'increaseYellowLight', icon: SunIcon, labelKey: 'increaseYellowLight' },
        { id: 'increaseBlueDark', icon: MoonIcon, labelKey: 'increaseBlueDark' },
        { id: 'decreaseBrightness', icon: MoonIcon, labelKey: 'decreaseBrightness' },
        { id: 'decreaseHighlights', icon: SunIcon, labelKey: 'decreaseHighlights' },
        { id: 'increaseShadows', icon: MoonIcon, labelKey: 'increaseShadows' },
        { id: 'increaseContrast', icon: ContrastIcon, labelKey: 'increaseContrast' },
        { id: 'decreaseContrast', icon: ContrastIcon, labelKey: 'decreaseContrast' },
        { id: 'increaseSaturation', icon: SaturationIcon, labelKey: 'increaseSaturation' },
        { id: 'decreaseSaturation', icon: SaturationIcon, labelKey: 'decreaseSaturation' },
        { id: 'increaseSharpness', icon: SharpenIcon, labelKey: 'increaseSharpness' },
        { id: 'increaseBlur', icon: BlurIcon, labelKey: 'increaseBlur' },
    ];

    const showColorPicker = settings.mode === 'increaseWhiteLight' || settings.mode === 'increaseYellowLight' || settings.mode === 'increaseBlueDark';

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 p-3 bg-gray-900/50 rounded-lg">
                <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-gray-400">{t('brushSettingsLabel')}</h4>
                    <button onClick={onUndo} className="flex items-center gap-1.5 text-sm text-purple-400 hover:text-purple-300 font-semibold">
                        <UndoIcon className="w-4 h-4"/>{t('undoButton')}
                    </button>
                </div>
                <Slider label={t('brushSizeLabel')} value={settings.size} min={2} max={2000} onChange={(v) => handleSettingChange('size', v)} resetValue={300} />
                <Slider label={t('brushStrengthLabel')} value={settings.strength} min={0} max={20} onChange={(v) => handleSettingChange('strength', v)} resetValue={15} />
                <Slider label={t('brushFeatherLabel')} value={settings.feather} min={0} max={100} onChange={(v) => handleSettingChange('feather', v)} resetValue={100} />
                
                {showColorPicker && (
                    <div className="flex items-center gap-2 mt-2">
                        <label className="text-sm text-gray-300">{t('lightColorLabel')}:</label>
                        <input
                            type="color"
                            value={settings.color}
                            onChange={(e) => handleSettingChange('color', e.target.value)}
                            className="w-8 h-8 rounded border-none bg-gray-700 cursor-pointer"
                        />
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-2 p-3 bg-gray-900/50 rounded-lg">
                <h4 className="font-semibold text-gray-400 mb-1">{t('brushModesLabel')}</h4>
                <div className="grid grid-cols-1 gap-2">
                    {MODES.map(mode => (
                        <button
                            key={mode.id}
                            onClick={() => handleModeChange(mode.id)}
                            className={`flex items-center gap-2 p-2 rounded-md text-sm transition-colors ${
                                settings.mode === mode.id
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                        >
                            <mode.icon className={`w-5 h-5 ${mode.id === 'increaseYellowLight' ? 'text-yellow-300' : ''} ${mode.id === 'decreaseContrast' || mode.id === 'decreaseSaturation' || mode.id === 'decreaseHighlights' ? 'opacity-60' : ''}`} />
                            <span>{t(mode.labelKey)}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
