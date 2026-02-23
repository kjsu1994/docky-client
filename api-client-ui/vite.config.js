import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["@stomp/stompjs", "sockjs-client"],
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ["ctfmon.shop", "www.ctfmon.shop"],
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
      "/ws": {
        target: "http://backend:8080",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    // 운영 배포 산출물 경로를 compose 기준 고정
    outDir: "C:/compose/minio-data/client/dist",
    emptyOutDir: true,
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
