
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // 載入本地 .env 檔案
  const env = loadEnv(mode, (process as any).cwd(), '');

  // 優先順序：GitHub Secrets (process.env) > 本地 .env (env.API_KEY)
  let apiKey = process.env.API_KEY || env.API_KEY || "";

  // 安全檢查：過濾掉常見的佔位符或無效金鑰
  // 如果讀取到 "GEMINI_API_KEY" (範例值)，則視為無效，強制設為空字串
  if (apiKey === "GEMINI_API_KEY" || apiKey.includes("YOUR_API_KEY") || !apiKey.startsWith("AIza")) {
    console.warn("⚠️ Build: Detected invalid or placeholder API Key. Resetting to empty.");
    apiKey = "";
  }

  // 在 Build 階段檢查
  if (apiKey) {
    console.log("✅ Build: Valid API Key detected (Starts with AIza).");
  } else {
    console.warn("⚠️ Build: No valid API Key detected! App will show 'Missing Key' error.");
  }

  return {
    plugins: [react()],
    base: '/ivan-ai-photo-pro3/', 
    define: {
      'process.env.API_KEY': JSON.stringify(apiKey) 
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    }
  };
});
