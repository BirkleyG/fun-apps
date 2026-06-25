import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/fun-apps/time-loop-cyoa/",
  server: { port: 5179 }
});

