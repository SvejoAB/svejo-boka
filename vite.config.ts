import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// People and calendars live in src/shared/people.ts, which is not in git. Without it, the example.
const localPeople = fileURLToPath(new URL("./src/shared/people.ts", import.meta.url));
const people = existsSync(localPeople) ? localPeople : fileURLToPath(new URL("./src/shared/people.example.ts", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src/client", import.meta.url)), "@people": people },
  },
});
