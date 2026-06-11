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
      allowedHosts: ["docky.co.kr", "www.docky.co.kr"],
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
      // Write production assets directly to the compose-served static directory.
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
  };
});
