import { readFile } from "node:fs/promises";

const csv = await readFile(new URL("../data/calibration.csv", import.meta.url), "utf8");
const rows = csv.trim().split(/\r?\n/u).slice(1).filter(Boolean);
const samples = new Map();
for (const row of rows) {
  const [id, serviceLine, estimateRaw, finalRaw] = row.split(",");
  const estimate = Number(estimateRaw);
  const finalPrice = Number(finalRaw);
  if (!id || !serviceLine || !Number.isFinite(estimate) || estimate <= 0 ||
      !Number.isFinite(finalPrice) || finalPrice <= 0) continue;
  const group = samples.get(serviceLine) ?? [];
  group.push((finalPrice - estimate) / estimate);
  samples.set(serviceLine, group);
}
if (!samples.size) {
  console.log("لا توجد سجلات معايرة بعد. أضف عروضاً فعلية إلى data/calibration.csv.");
} else {
  for (const [serviceLine, deviations] of samples) {
    const average = deviations.reduce((sum, value) => sum + value, 0) / deviations.length;
    console.log(`${serviceLine}: متوسط الانحراف ${(average * 100).toFixed(1)}% على ${deviations.length} سجلات؛ معامل مراجعة مقترح ×${(1 + average).toFixed(3)}.`);
  }
}
