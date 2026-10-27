import { resolve } from "node:path";
import { createServer } from "vite";

const server = await createServer({
  configFile: resolve(process.cwd(), "vite.config.ts"),
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

try {
  const { PRICING_CATALOG } = await server.ssrLoadModule("/lib/pricing/catalog.ts");
  const { PRICING_CONFIG } = await server.ssrLoadModule("/lib/pricing/config.ts");
  const staleAfter = PRICING_CONFIG.dataStaleAfterDays * 86_400_000;
  const now = Date.now();
  const issues = PRICING_CATALOG.flatMap((item) => [
    ...(item.needsReview ? [`À revoir: ${item.id} — ${item.nameAr} (${item.source})`] : []),
    ...(now - Date.parse(item.updatedAt) > staleAfter ? [`Périmé: ${item.id} (${item.updatedAt})`] : []),
  ]);
  console.log(`Catalogue: ${PRICING_CATALOG.length} articles; ${PRICING_CATALOG.filter((item) => item.needsReview).length} à revoir.`);
  for (const issue of issues) console.log(issue);
  if (process.argv.includes("--strict") && issues.length) process.exitCode = 1;
} finally {
  await server.close();
}
