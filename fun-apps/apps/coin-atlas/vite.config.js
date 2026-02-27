import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/fun-apps/coin-atlas/",
  server: { port: 5176 }
});
