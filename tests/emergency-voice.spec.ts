import { describe, expect, it } from "vitest";
import {
  classifyEmergencySeverity,
  emergencyPhoneSchema,
  normalizeArabic,
} from "@/lib/emergency-voice";

describe("normalizeArabic", () => {
  it("normalizes Arabic spellings, diacritics, tatweel, and Arabic digits for matching", () => {
    expect(normalizeArabic("أَإِآبَىةـ ١٢٣ 3 7 9 5")).toBe("ااابيه 123 3 7 9 5");
  });

  it("collapses whitespace without changing the display transcript", () => {
    expect(normalizeArabic("  مَا   كَايَنْش  ضَوْء  ")).toBe("ما كاينش ضوء");
  });

  it("maps Arabizi digits used inside Latin-script words for keyword matching", () => {
    expect(normalizeArabic("3lach 5tart 7al")).toBe("عlach خtart حal");
  });
});

describe("classifyEmergencySeverity", () => {
  it.each([
    ["طار الضو و ريحة حريق في الطابلو", "critical"],
    ["الكوران ضربني ومازال يشرر", "critical"],
    ["ما كاينش كوران في الدار من البارح", "medium"],
    ["عندي كورتو سيركي والديجونكتور يطيح", "high"],
    ["فيه دخان يخرج من البريز", "critical"],
    ["le compteur يدق و فيه ريحة محروق", "high"],
    ["ريحة حريق خفيفة قرب الطابلو", "high"],
    ["خرجت شرارة من البريز", "high"],
    ["صعقة كهربائية في السلك المكشوف", "critical"],
    ["كاين ماء في الطابلو الكهربائي", "high"],
    ["il y a de la fumée dans le tableau", "critical"],
    ["une odeur de brûlé près du compteur", "high"],
    ["court-circuit et fumée dans la prise", "critical"],
    ["coupure de courant depuis hier", "medium"],
    ["شرارة مع رائحة حريق في البريز", "critical"],
    ["rani nسمع courant ydir t9a9 fi tableau", "low"],
    ["ma kayench courant fel dar", "medium"],
    ["kahraba daret court circuit", "high"],
    ["ما عنديش مشكل غير حاب نعرف السعر", "low"],
    ["الكاميرا لا تعمل منذ الصباح", "low"],
  ] as const)("classifies %s as %s", (phrase, severity) => {
    expect(classifyEmergencySeverity(phrase)).toBe(severity);
  });

  describe("Algerian emergency phone validation", () => {
    it.each(["0550 00 00 00", "0661234567", "0771234567", "+213551234567"])(
      "accepts %s",
      (phone) => {
        expect(emergencyPhoneSchema.safeParse(phone).success).toBe(true);
      },
    );

    it.each(["0211234567", "055012345", "+213401234567", "1234567890"])(
      "rejects %s",
      (phone) => {
        expect(emergencyPhoneSchema.safeParse(phone).success).toBe(false);
      },
    );
  });
});