import { describe, expect, it } from "vitest";
import {
  applyEmergencyTriage,
  createEmergencyReport,
} from "@/lib/emergency-report";
import {
  createEmergencyKeyboard,
  escapeTelegramHtml,
  formatEmergencyCard,
  formatEmergencyPhotoCaption,
} from "@/lib/telegram-format";

const createdAt = new Date("2026-10-26T19:41:00.000Z");

function makeReport(overrides: Partial<Parameters<typeof createEmergencyReport>[0]> = {}) {
  return createEmergencyReport({
    createdAt,
    phone: "0551234567",
    description: "طار الضو وريحة حريق في الطابلو",
    emergencyType: "dangerous_short_circuit",
    hasPhoto: false,
    ...overrides,
  });
}

describe("emergency dispatch report", () => {
  it("formats a critical shock report with voice and photo details", () => {
    const report = makeReport({
      description: "الكوران ضربني ومازال يشرر",
      voiceTranscript: "الكوران ضربني ومازال يشرر",
      aiDiagnosis: "تشخيص الصورة (خطر مرتفع): آثار احتراق عند القاطع.",
      hasPhoto: true,
      location: { lat: 36.752887, lng: 3.042048, accuracy: 15 },
    });
    const card = formatEmergencyCard(report);

    expect(report.severity).toBe("critical");
    expect(report.hasVoice).toBe(true);
    expect(card).toContain("🔴 <b>طوارئ حرجة</b>");
    expect(card).toContain("الكوران ضربني ومازال يشرر");
    expect(card).toContain("الصورة:");
    expect(card).toContain("دقة GPS المقدّرة ±15 م");
    expect(formatEmergencyPhotoCaption(report).length).toBeLessThanOrEqual(1_024);
    expect(card.length).toBeLessThanOrEqual(4_096);
  });

  it("formats a power outage without adding a photo section", () => {
    const report = makeReport({
      description: "ما كاينش كوران في الدار من البارح",
      emergencyType: "industrial_line_down",
      hasPhoto: false,
    });
    const card = formatEmergencyCard(report);
    expect(report.severity).toBe("medium");
    expect(card).toContain("🟡 <b>طوارئ متوسطة</b>");
    expect(card).not.toContain("• <b>الصورة:</b>");
  });

  it("marks missing location without fabricating map links", () => {
    const report = makeReport({ location: null, emergencyType: undefined });
    const card = formatEmergencyCard(report);
    const keyboard = createEmergencyKeyboard(report);
    expect(report.location.address).toBe("غير محدد");
    expect(report.location.mapsUrl).toBeNull();
    expect(report.location.wazeUrl).toBeNull();
    expect(card).toContain("الموقع:</b> <b>غير محدد</b>");
    expect(keyboard.inline_keyboard[0].map((button) => button.url)).toEqual([
      report.customer.whatsappUrl,
    ]);
    expect(report.emergencyType).toContain("مستنتج آلياً");
  });

  it("labels a local fallback as unavailable until a valid AI result is applied", () => {
    const report = makeReport();
    expect(formatEmergencyCard(report)).toContain("التحليل الآلي</b> (تحليل آلي غير متاح)");
    const enriched = applyEmergencyTriage(report, {
      summary: "احتمال تماس في لوحة التوزيع.",
      findings: ["تلف محتمل في العازل الداخلي."],
      recommended_actions: ["افحص اللوحة بعد عزل التغذية."],
      required_tools: ["جهاز قياس معزول"],
      confidence: "medium",
    });
    expect(formatEmergencyCard(enriched)).toContain("يحتاج تأكيد الفني");
    expect(enriched.triage.analysisAvailable).toBe(true);
  });

  it("keeps long content and photo captions within Telegram limits", () => {
    const report = makeReport({
      description: "وصف طويل لاختبار حدود بطاقة البلاغ. ".repeat(300),
      aiDiagnosis: `تشخيص الصورة: ${"تفاصيل فحص الصورة. ".repeat(100)}`,
      hasPhoto: true,
    });
    expect(formatEmergencyCard(report).length).toBeLessThanOrEqual(4_096);
    expect(formatEmergencyPhotoCaption(report).length).toBeLessThanOrEqual(1_024);
    expect(formatEmergencyCard(report)).toContain("نصيحة السلامة المرسلة للعميل");
    expect(formatEmergencyCard(report)).toContain("📞 <b>الهاتف:</b> <code>+213551234567</code>");
  });

  it("escapes markup, mention patterns and links in customer and AI text", () => {
    const report = makeReport({
      description: `<b>خطر</b> </code> @everyone https://evil.example/x?x=1 "quoted"`,
      aiDiagnosis: "تشخيص الصورة: <script>alert(1)</script>",
      hasPhoto: true,
    });
    const card = formatEmergencyCard(report);
    expect(card).toContain("&lt;b&gt;");
    expect(card).toContain("&lt;/code&gt;");
    expect(card).toContain("@\u200Beveryone");
    expect(card).toContain("[رابط محذوف]");
    expect(escapeTelegramHtml("example.com")).toBe("[رابط محذوف]");
    expect(card).toContain("&quot;quoted&quot;");
    expect(card).not.toContain("<script>");
    expect(card).not.toContain("https://evil.example");
    expect(escapeTelegramHtml("<>&\"'")).toBe("&lt;&gt;&amp;&quot;&#39;");
  });

  it("normalizes Algerian mobile numbers in local and international forms", () => {
    const cases = [
      ["0551234567", "+213551234567"],
      ["0673123456", "+213673123456"],
      ["0712345678", "+213712345678"],
      ["+213551234567", "+213551234567"],
    ];
    for (const [input, normalized] of cases) {
      expect(makeReport({ phone: input }).customer.phone).toBe(normalized);
    }
  });

  it("recognizes mixed Arabic and French customer words", () => {
    const report = makeReport({
      description: "le compteur فيه ريحة محروق",
      emergencyType: undefined,
    });
    expect(report.detectedLanguage).toBe("ar");
    expect(report.severity).toBe("high");
  });

  it("uses the Africa/Algiers display time and an unambiguous reference", () => {
    const report = makeReport();
    expect(report.referenceId).toMatch(/^VX-261026-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
    expect(report.displayTime).toBe("26/10/2026 20:41 (توقيت الجزائر)");
    expect(report.customer.whatsappUrl).toContain(encodeURIComponent(report.referenceId));
  });
});
