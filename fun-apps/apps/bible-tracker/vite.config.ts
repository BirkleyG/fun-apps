import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/fun-apps/bible-tracker/",
  server: { port: 5174 }
});
