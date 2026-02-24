import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_PROXY_TARGET || "http://backend:8080";

  return {
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
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        "/ws": {
          target: proxyTarget,
          ws: true,
          changeOrigin: true,
        },
      },
    },
    build: {
      // 운영 배포 산출물 경로를 compose 기준으로 고정
      outDir: "C:/compose/minio-data/client/dist",
      emptyOutDir: false,
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
  };
});
