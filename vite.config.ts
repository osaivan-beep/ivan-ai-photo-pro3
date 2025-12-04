
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // 載入本地 .env 檔案
  const env = loadEnv(mode, (process as any).cwd(), '');

  // 優先順序：GitHub Secrets (process.env) > 本地 .env (env.API_KEY)
  let apiKey = process.env.API_KEY || env.API_KEY || "";

  // 強力清洗：移除前後空白、換行符號、以及可能被意外包裹的單引號或雙引號
  // Clean up: trim whitespace, newlines, and remove surrounding quotes
  apiKey = apiKey.trim().replace(/^['"]|['"]$/g, '');

  // 安全檢查：過濾掉常見的佔位符或無效金鑰
  // 如果讀取到 "GEMINI_API_KEY" (範例值)，則視為無效，強制設為空字串
  if (apiKey === "GEMINI_API_KEY" || apiKey.includes("YOUR_API_KEY")) {
    console.warn("⚠️ Build: Detected placeholder API Key. Resetting to empty.");
    apiKey = "";
  }

  // Log status (do not log actual key in CI)
  if (apiKey) {
    console.log("✅ Build: API Key injected.");
  } else {
    console.warn("⚠️ Build: No API Key injected.");
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
