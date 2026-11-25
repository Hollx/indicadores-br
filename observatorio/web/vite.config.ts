import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Em desenvolvimento, /api vai para a API local (uvicorn na porta 8010).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8010",
        rewrite: (caminho) => caminho.replace(/^\/api/, ""),
      },
    },
  },
});
