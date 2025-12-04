import React from 'react';
import type { TFunction } from '../types';

interface ApiKeyModalProps {
  onSave: (apiKey: string) => void;
  t: TFunction;
}

// Per coding guidelines, the API key must be handled via environment variables (`process.env.API_KEY`)
// and not through a user-facing UI element. This component is therefore disabled to adhere to the project's
// API key management policy and to resolve the original build errors.
export const ApiKeyModal: React.FC<ApiKeyModalProps> = () => {
  return null;
};
