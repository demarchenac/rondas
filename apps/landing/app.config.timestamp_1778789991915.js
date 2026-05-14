// app.config.ts
import { defineConfig } from "@tanstack/react-start/config";
import tailwindcss from "@tailwindcss/vite";
var app_config_default = defineConfig({
  vite: {
    plugins: [tailwindcss()]
  },
  server: {
    preset: "vercel"
  }
});
export {
  app_config_default as default
};
