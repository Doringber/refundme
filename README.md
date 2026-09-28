# זיכוי שלי

אפליקציית ווב בעברית (RTL) לניהול זיכויי חנות ושוברי קנייה בישראל. צילום מסמך → אישור שדות → מעקב יתרה, תוקף וחנויות.

**Working name:** זיכוי שלי · Stack: Next.js, TypeScript, Tailwind CSS, Supabase.

## תכונות בגרסה 1

- התחברות עם Supabase Auth (או **מצב דמו** מלא בלי חשבון)
- העלאת תמונה / PDF / צילום מהנייד, שמירת המסמך המקורי
- הצעת שדות מחילוץ טקסט כשזמין + מילוי ידני מלא
- סוגי מסמך: זיכוי החזרה, שובר מתנה, שובר קנייה, קבלה/חשבונית (קבלה **לא** נספרת כזיכוי)
- לוח בקרה עם **Credit Orb**, פירוט לפי חנות, פגים בקרוב, ציר תוקף ופעילות
- חיפוש וסינון, פרטי שובר, מימוש מלא/חלקי
- תזכורות לפי תוקף מאומת; אחרת — «תוקף לא אומת»
- חנויות בקרבתי + סימון האם הקבלה בסניף אומתה
- ייצוא JSON ומחיקת נתונים

## הרצה מהירה (מצב דמו)

```bash
npm install
npm run dev
```

פתחו [http://localhost:3000](http://localhost:3000) → **כניסה למצב דמו**.

הדמו שומר נתונים ב־`localStorage` עם דוגמאות בעברית (FOX, זארה, סופר-פארם, קבלת איקאה).

```bash
npm test          # בדיקות לוגיקת יתרה / תוקף / קבלות
npm run build     # בניית production
npm run lint
```

## חיבור Supabase

1. צרו פרויקט ב־[Supabase](https://supabase.com).
2. העתיקו `.env.example` ל־`.env.local` ומלאו:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # רק בשרת — למחיקת חשבון
```

3. הריצו את המיגרציה:

```bash
npx supabase db push
# או הדביקו את הקובץ ב־SQL Editor:
# supabase/migrations/20260328180000_initial_schema.sql
```

המיגרציה כוללת:

- טבלאות: `profiles`, `merchants`, `merchant_branches`, `vouchers`, `redemptions`, `activity_events`
- **RLS** על כל רשומות המשתמש
- באקט פרטי `voucher-documents` (עד 10MB, תמונות/PDF) עם מדיניות לפי `user_id`
- סט סניפים קטן עם סימון `verified` / `unverified`

4. הפעילו Email Auth בלוח הבקרה של Supabase.
5. `npm run dev` — מסכי התחברות/הרשמה יופיעו כשמשתני הסביבה מוגדרים.

### משתני סביבה

| משתנה | היכן | תפקיד |
|--------|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | לקוח+שרת | כתובת הפרויקט |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | לקוח+שרת | מפתח anon (כפוף ל־RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | שרת בלבד | מחיקת חשבון ומסמכים |
| `DOCUMENT_OCR_API_KEY` | שרת בלבד | אופציונלי ל־`/api/extract` |

## כללי מוצר חשובים

- היתרה תמיד **«יתרה לפי הדיווח שלך»** — לא «יתרה מאומתת»
- אין המצאת ברקודים, תאריכי תוקף, סניפים או מימושים
- בלי תוקף מאומת — אין ספירה לאחור בכדור
- תמונה של שובר אינה מבטיחה קבלה בכל קופה
- אין NFC / מימוש בטרמינלים של רשתות

## מבנה עיקרי

```
src/app/(app)/          # לוח בקרה, זיכויים, חנויות, הגדרות
src/components/orb/     # Credit Orb
src/lib/demo/           # מצב דמו + נתוני דוגמה
src/lib/calculations.ts # יתרות, דחיפות תוקף, סיכום דשבורד
supabase/migrations/    # סכמה + RLS + storage
```

## מה עדיין דורש שיתוף פעולה מסוחרים

- יתרה מאומתת מול מערכת הקופה
- מימוש דיגיטלי / ברקוד דינמי בקופה
- רשימת סניפים מלאה ומדיניות קבלה בזמן אמת לכל רשת
- OCR מסחרי איכותי (אופציונלי דרך `DOCUMENT_OCR_API_KEY`)
