import {
  applyEmergencyTriage,
  createEmergencyReport,
} from "@/lib/emergency-report";
import { formatEmergencyCard } from "@/lib/telegram-format";

const previewTime = new Date("2026-10-26T19:41:00.000Z");

export function getTelegramPreviewSamples(): Array<{ title: string; card: string }> {
  const critical = createEmergencyReport({
    createdAt: previewTime,
    fullName: "محمد بن عيسى",
    phone: "0551234567",
    description: "شرارة قرب لوحة التوزيع",
    voiceTranscript: "الكوران ضربني ومازال يشرر",
    aiDiagnosis: "تشخيص الصورة (خطر مرتفع): آثار احتراق قرب القاطع الرئيسي. التوصية: عزل المنطقة.",
    emergencyType: "dangerous_short_circuit",
    location: { lat: 36.752887, lng: 3.042048, accuracy: 15 },
    hasPhoto: true,
  });
  const criticalWithTriage = applyEmergencyTriage(critical, {
    summary: "صعقة كهربائية مع استمرار الشرر قرب لوحة التوزيع.",
    findings: ["احتمال تلف في القاطع أو تماس في التوصيلات، ويلزم تأكيد ذلك ميدانياً."],
    recommended_actions: [
      "تواصل مع العميل وتأكد من ابتعاد الجميع عن اللوحة.",
      "افحص اللوحة من الخارج دون لمسها وهي موصولة بالطاقة.",
      "اعزل التغذية إذا أمكن بأمان وبحسب إجراءات الموقع.",
    ],
    required_tools: ["معدات قياس معزولة", "معدات الوقاية الشخصية"],
    confidence: "medium",
  });

  const outage = createEmergencyReport({
    createdAt: previewTime,
    fullName: "سميرة",
    phone: "06 73 12 34 56",
    description: "ما كاينش ضو في الدار من الصباح.",
    emergencyType: "industrial_line_down",
    location: { lat: 36.365, lng: 6.6147, accuracy: 35 },
    hasPhoto: false,
  });

  const missingLocation = createEmergencyReport({
    createdAt: previewTime,
    phone: "0712345678",
    description: "Le compteur fait un bruit inhabituel depuis ce matin.",
    hasPhoto: false,
  });

  const fallback = createEmergencyReport({
    createdAt: previewTime,
    fullName: "عميل تجريبي",
    phone: "+213551234567",
    description: `${"وصف طويل لاختبار حدود بطاقة الإرسال. ".repeat(80)}مزيج français: une odeur de brûlé près du tableau.`,
    voiceTranscript: "ريحة محروق قرب الطابلو",
    hasPhoto: false,
  });

  return [
    { title: "صعقة وشرر مع صورة وصوت", card: formatEmergencyCard(criticalWithTriage) },
    { title: "انقطاع كهرباء بلا صورة", card: formatEmergencyCard(outage) },
    { title: "موقع غير محدد ورسالة فرنسية", card: formatEmergencyCard(missingLocation) },
    { title: "تعذر التحليل ونص طويل", card: formatEmergencyCard(fallback) },
  ];
}
