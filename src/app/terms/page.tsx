import Link from "next/link";
import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `תנאים · ${APP_NAME}`,
  description: "תנאי שימוש בזיכוי שלי — מעקב אישי אחרי זיכויים, לא מימוש בקופה.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-xl space-y-5 px-5 py-10">
      <Link href="/" className="text-sm font-semibold text-forest">
        ← {APP_NAME}
      </Link>
      <h1 className="font-display text-3xl text-forest">תנאי שימוש</h1>
      <section className="card-surface space-y-3 p-5 text-sm leading-relaxed">
        <p>
          {APP_NAME} הוא כלי אישי למעקב אחרי זיכויים ושוברי קנייה. הוא אינו
          ארנק תשלום, אינו מחליף את השובר המקורי, ואינו משויך ל־BuyMe או לרשתות
          החנויות.
        </p>
        <p>
          הסכומים הם לפי מה שדיווחתם או לפי מה שחזר מסנכרון BuyMe. אין כאן יתרה
          מאומתת מול קופה, ואין הבטחה שכל סניף יקבל את השובר. תמונה של מסמך
          אינה מבטיחה מימוש.
        </p>
        <p>
          קוד או ברקוד מוצגים רק אם הם נשמרו מהמקור או הוזנו ידנית. אם לשובר
          BuyMe אין קוד ברשימה, האפליקציה מציגה קישור לשובר ב־BuyMe כשהמקור
          החזיר קישור כזה — ולא ממציאה קוד.
        </p>
        <p>
          השימוש הוא על אחריותכם. כדאי לבדוק את השובר המקורי לפני שמגיעים לקופה.
        </p>
      </section>
    </main>
  );
}
