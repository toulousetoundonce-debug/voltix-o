#!/usr/bin/env node

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const routes = [
  ["/api/chat", { messages: [{ role: "assistant", content: "invalid final state" }] }],
  ["/api/quote", { projectType: "smart_home", area: "bad", units: 0, tier: "advanced", fullName: "", phone: "bad", city: "", website: "" }],
  ["/api/sos", { fullName: "", phone: "bad", emergencyType: "invalid", website: "" }],
  ["/api/callback-request", { phone: "bad" }],
  ["/api/vision-check", {}],
  ["/api/voice-sos", "not-form-data"],
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  let json = {};
  if (contentType.includes("application/json") && text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = {};
    }
  }
  return { response, json, text };
}

async function smoke() {
  const root = await fetchJson(`${BASE_URL}/`);
  assert(root.response.status === 200, `GET / expected 200; got ${root.response.status}`);

  const robots = await fetchJson(`${BASE_URL}/robots.txt`);
  assert(robots.response.status === 200, `GET /robots.txt expected 200; got ${robots.response.status}`);

  const sitemap = await fetchJson(`${BASE_URL}/sitemap.xml`);
  assert(sitemap.response.status === 200, `GET /sitemap.xml expected 200; got ${sitemap.response.status}`);

  for (const [path, payload] of routes) {
    let result;
    if (path === "/api/voice-sos") {
      result = await fetchJson(`${BASE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bad: true }),
      });
    } else {
      result = await fetchJson(`${BASE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", origin: BASE_URL, "x-forwarded-host": "localhost:3000" },
        body: JSON.stringify(payload),
      });
    }

    assert(!result.response.status.toString().startsWith("5"), `${path} returned 5xx: ${result.response.status}`);
    assert(result.response.status >= 400 && result.response.status < 500, `${path} should fail validation, got ${result.response.status}`);
    assert(result.json && typeof result.json === "object" && result.json.ok === false, `${path} should return { ok: false }`);
    assert(!result.json?.error || typeof result.json.error === "string", `${path} returned a non-string error`);
    if (result.json?.fieldErrors) {
      assert(typeof result.json.fieldErrors === "object", `${path} fieldErrors should be object`);
    }
    assert(result.response.headers.get("content-type")?.includes("application/json") || !result.response.headers.get("content-type"), `${path} should return JSON`);
  }

  console.log(`Smoke passed for ${BASE_URL}`);
}

smoke().catch((error) => {
  console.error(error);
  process.exit(1);
});
