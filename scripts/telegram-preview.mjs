import { resolve } from "node:path";
import { createServer } from "vite";

const server = await createServer({
  configFile: resolve(process.cwd(), "vite.config.ts"),
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

try {
  const { getTelegramPreviewSamples } = await server.ssrLoadModule("/scripts/telegram-preview-data.ts");
  for (const [index, sample] of getTelegramPreviewSamples().entries()) {
    console.log(`\n========== عينة ${index + 1}: ${sample.title} ==========\n`);
    console.log(sample.card);
  }
} finally {
  await server.close();
}
