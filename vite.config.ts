
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // 載入本地 .env 檔案
  const env = loadEnv(mode, (process as any).cwd(), '');

  // 關鍵修正：
  // 1. process.env.API_KEY: 這是 GitHub Actions 傳入的 Secret (Gemini API Key)。
  // 2. env.API_KEY: 這是本地 .env 檔案的變數。
  // 3. "": 如果都沒抓到，就留空。
  const apiKey = process.env.API_KEY || env.API_KEY || "";

  // 在 Build 階段檢查是否有抓到 Key (這會顯示在 GitHub Actions 的 Log 裡)
  if (apiKey) {
    console.log("✅ Build: API Key detected successfully.");
  } else {
    console.warn("⚠️ Build: No API Key detected! The app will not work properly.");
  }

  return {
    plugins: [react()],
    base: '/ivan-ai-photo-pro3/', // 確保這裡對應您的新 GitHub Repository 名稱
    define: {
      // 將抓到的 Key 注入到網頁程式中
      'process.env.API_KEY': JSON.stringify(apiKey) 
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    }
  };
});
