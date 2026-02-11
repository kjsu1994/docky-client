import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        // 중요: docker 내부에서는 localhost가 아니라 서비스명으로 접근
        //로컬에서 실행할때
        target: "http://backend:8080",
        changeOrigin: true,
        secure: false,
        // /api/members/login -> /members/login 으로 바꿔서 백엔드에 전달
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          utils: ["axios", "date-fns"],
        },
      },
    },
  },
});