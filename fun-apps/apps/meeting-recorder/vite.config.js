import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/fun-apps/meeting-recorder/",
  server: { port: 5182 }
});
