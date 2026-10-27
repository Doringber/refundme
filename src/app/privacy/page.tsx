import Link from "next/link";
import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `פרטיות · ${APP_NAME}`,
  description: `אילו נתונים ${APP_NAME} שומר, ומה לא נשמר — כולל מיקום וחיבור BuyMe.`,
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-xl space-y-5 px-5 py-10">
      <Link href="/" className="text-sm font-semibold text-forest">
        ← {APP_NAME}
      </Link>
      <h1 className="font-display text-3xl text-forest">פרטיות</h1>
      <p className="text-sm leading-relaxed text-eggplant">
        {APP_NAME} עוזר לשמור זיכויים ושוברי קנייה שאתם מזינים או מייבאים.
        האפליקציה אינה בית עסק ואינה BuyMe.
      </p>
      <section className="card-surface space-y-2 p-5 text-sm leading-relaxed">
        <h2 className="font-display text-lg text-forest">חשבון</h2>
        <p>
          התחברות עם Google עוברת דרך Supabase Auth. נשמרים מזהה החשבון, השם,
          כתובת האימייל ותמונת הפרופיל ש־Google מחזיר, כדי להציג את החשבון
          ולשייך אליו את הזיכויים.
        </p>
      </section>
      <section className="card-surface space-y-2 p-5 text-sm leading-relaxed">
        <h2 className="font-display text-lg text-forest">זיכויים ומסמכים</h2>
        <p>
          שמות חנויות, סכומים, תאריכים, קודים, ברקודים והערות שאתם מאשרים
          נשמרים בחשבון. צילום או PDF שאתם מעלים נשמר ב־storage פרטי. היתרה
          המוצגת היא «יתרה לפי הדיווח שלך» — לא יתרה שמאומתת מול הקופה.
        </p>
      </section>
      <section className="card-surface space-y-2 p-5 text-sm leading-relaxed">
        <h2 className="font-display text-lg text-forest">BuyMe</h2>
        <p>
          אם אתם מחברים ארנק BuyMe, אסימון הגישה נשמר מוצפן בשרת
          (BUYME_SESSION_KEY) ומשמש רק לשליפת השוברים שלכם. הסיסמה של BuyMe לא
          עוברת דרך האפליקציה. ניתוק מוחק את האסימון השמור ואת עוגיית החיבור.
        </p>
      </section>
      <section className="card-surface space-y-2 p-5 text-sm leading-relaxed">
        <h2 className="font-display text-lg text-forest">מיקום</h2>
        <p>
          במסך החנויות אפשר לאשר מיקום בדפדפן כדי למיין סניפים לפי מרחק. הקואורדינטות
          נשארות במכשיר בזמן השימוש במסך, לא נשלחות לשרת ולא נשמרות בחשבון. אם
          המיקום נדחה, אפשר לחפש לפי עיר.
        </p>
      </section>
      <section className="card-surface space-y-2 p-5 text-sm leading-relaxed">
        <h2 className="font-display text-lg text-forest">מחיקה</h2>
        <p>
          בהגדרות אפשר לייצא JSON ולמחוק את החשבון. מחיקת חשבון מוחקת את
          הזיכויים, המסמכים ורשומת הפרופיל מהשרת. מצב הדמו נשמר רק בדפדפן.
        </p>
        <p>אין מכירת נתונים לצד שלישי.</p>
      </section>
    </main>
  );
}
