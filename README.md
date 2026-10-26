# זיכוי שלי

אפליקציית ווב בעברית (RTL) לניהול זיכויי חנות ושוברי קנייה בישראל. צילום מסמך → אישור שדות → מעקב יתרה, תוקף וחנויות.

**Working name:** זיכוי שלי · Stack: Next.js 16, TypeScript, Tailwind CSS, Supabase. Node.js 22.

## תכונות בגרסה 1

- התחברות עם **Google** או אימייל דרך Supabase Auth (או **מצב דמו** מלא בלי חשבון)
- פרופיל משתמש ב־Supabase (`profiles`: שם, אימייל, תמונה) עם RLS
- העלאת תמונה / PDF / צילום מהנייד, שמירת המסמך המקורי
- הצעת שדות מחילוץ טקסט כשזמין + מילוי ידני מלא
- סוגי מסמך: זיכוי החזרה, שובר מתנה, שובר קנייה, קבלה/חשבונית (קבלה **לא** נספרת כזיכוי)
- לוח בקרה עם **Credit Orb**, פירוט לפי חנות, פגים בקרוב, ציר תוקף ופעילות
- חיפוש וסינון, פרטי שובר, מימוש מלא/חלקי
- תזכורות לפי תוקף מאומת; אחרת — «תוקף לא אומת»
- חנויות בקרבתי + סימון האם הקבלה בסניף אומתה
- ייצוא JSON ומחיקת נתונים

## הרצה מהירה (מצב דמו)

דרוש Node.js 22.

```bash
npm ci
npm run dev
```

פתחו [http://localhost:3000](http://localhost:3000) → **כניסה למצב דמו**.

הדמו שומר נתונים ב־`localStorage` עם דוגמאות בעברית (FOX, זארה, סופר-פארם, קבלת איקאה). בלי משתני Supabase האפליקציה נשארת בדמו.

```bash
npm test           # בדיקות לוגיקה (יתרה, תוקף, BuyMe, ברקוד)
npm run lint       # eslint, בלי אזהרות
npm run typecheck  # next typegen && tsc --noEmit
npm run build      # בניית production
npm start          # שרת production אחרי build, פורט 3000
```

GitHub Actions (`.github/workflows/ci.yml`) מריץ את אותו רצף על כל PR ועל `main`: `npm ci`, `npm audit`, lint, typecheck, test, build.

## חיבור Supabase

1. צרו פרויקט ב־[Supabase](https://supabase.com).
2. העתיקו `.env.example` ל־`.env.local` ומלאו (אל תעלו מפתחות ל־git):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...   # רק בשרת — למחיקת חשבון
```

גם מפתחות קלאסיים (`ANON_KEY` / `SERVICE_ROLE_KEY`) נתמכים.

3. הריצו את **כל** המיגרציות ב־`supabase/migrations/` לפי הסדר (לא רק את הראשונה). מחיקת חשבון וסנכרון BuyMe נשענים על הטבלאות המאוחרות.

```bash
npx supabase db push
# או הדביקו ב־SQL Editor, לפי הסדר:
# supabase/migrations/20260328180000_initial_schema.sql
# supabase/migrations/20260929071118_google_login_profiles.sql
# supabase/migrations/20261001193000_buyme_wallet_sync.sql
```

המיגרציה הראשונה כוללת:

- טבלאות: `profiles`, `merchants`, `merchant_branches`, `vouchers`, `redemptions`, `activity_events`
- **RLS** על כל רשומות המשתמש
- באקט פרטי `voucher-documents` (עד 10MB, תמונות/PDF) עם מדיניות לפי `user_id`
- סט סניפים קטן עם סימון `verified` / `unverified`

4. הפעילו **Email** ו־**Google** בלוח הבקרה של Supabase:
   - [Authentication → Providers → Google](https://supabase.com/dashboard/project/_/auth/providers)
   - צרו OAuth Client ב־[Google Cloud Console](https://console.cloud.google.com/apis/credentials) (סוג Web)
   - Authorized redirect URI ב־Google: `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
   - הדביקו Client ID + Client Secret ב־Supabase
   - ב־Supabase → Authentication → URL Configuration הוסיפו:
     - Site URL: כתובת האפליקציה
     - Redirect URLs: `http://localhost:3000/auth/callback` ו־`https://YOUR_DOMAIN/auth/callback`
5. `npm run dev` — מסכי התחברות/הרשמה (כולל כפתור Google) יופיעו כשמשתני הסביבה מוגדרים.

אחרי התחברות עם Google נוצרת רשומה ב־`profiles` (שם, אימייל, `avatar_url`) אוטומטית דרך trigger על `auth.users`.

### משתני סביבה (לעולם לא ב־git)

שמרו מפתחות רק ב־`.env.local` מקומית, וב־Netlify Environment Variables בפרודקשן.
`.env*` ב־`.gitignore` — רק `.env.example` (placeholders) נכנס ל־git.

משתני `NEXT_PUBLIC_*` נצרבים לתוך הבאנדל בזמן `npm run build`. ב־Netlify הם חייבים להיות מוגדרים **לפני** הבילד, לא רק בזמן ריצה. בלי זה הדפדפן חושב שהאפליקציה במצב דמו בזמן שהשרת כבר דורש התחברות.

| משתנה | היכן | חובה? | תפקיד |
|--------|------|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | לקוח+שרת | לענן | כתובת הפרויקט |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | לקוח+שרת | לענן | מפתח publishable (`sb_publishable_…`, כפוף ל־RLS) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | לקוח+שרת | לא | alias ישן ל־anon JWT |
| `SUPABASE_SECRET_KEY` | שרת בלבד (לא `NEXT_PUBLIC_`) | לענן | מחיקת חשבון, מסמכים וסנכרון BuyMe (`sb_secret_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | שרת בלבד | לא | alias ישן ל־service_role |
| `BUYME_SESSION_KEY` | שרת בלבד | מומלץ | הצפנת סשן BuyMe ב־DB. בלי זה נופלים ל־`SUPABASE_SECRET_KEY`, ורוטציה של המפתח מנתקת את כולם |
| `CRON_SECRET` | שרת בלבד | לסנכרון מתוזמן | סוד ל־`POST /api/cron/buyme-sync` בכותרת `x-cron-secret`. בלי ערך הנתיב נעול |
| `GEMINI_API_KEY` | שרת בלבד | לא | חילוץ מתמונה מקומי. `GOOGLE_API_KEY` הוא alias |
| `GOOGLE_GEMINI_BASE_URL` | שרת בלבד | לא | מוגדר אוטומטית כש־Netlify AI Gateway פעיל |
| `DOCUMENT_OCR_API_KEY` | שרת בלבד | לא | מפתח OCR ישן; לא בשימוש כש־Gemini זמין |

כש־Supabase מוגדר, `src/proxy.ts` שולח את מסכי האפליקציה (`/dashboard`, `/vouchers`, `/stores`, `/settings`, `/activity`) ל־`/login` בלי סשן ובלי עוגיית דמו. `/api/extract` קורא ל־Gemini רק למשתמש מחובר. בלי Supabase (דמו מקומי) Gemini רץ אם המפתח מוגדר.

Next.js 16 מריץ את זה כ־`proxy` (Node), לא כ־middleware על Edge. אחרי השדרוג צריך לוודא ש־deploy ב־Netlify באמת מפעיל את `src/proxy.ts` (רענון סשן והפניה ל־login).

אחרי התחברות/הרשמה האפליקציה קוראת וכותבת ל־Supabase (`profiles`, `vouchers`, `redemptions`, `activity_events`, storage `voucher-documents`). מצב דמו נשאר מקומי דרך cookie `zikuy_demo`.

### תמונות מסמך וחילוץ מהתמונה

- העלאת תמונה נדחסת ל־JPEG לתצוגה ושמירה (גם בדמו וגם בענן).
- HEIC מאייפון: ניסיון המרה אוטומטית; אם הדפדפן לא תומך — הודעה ברורה.
- **חילוץ משדה**: אחרי צילום רץ OCR בעברית בדפדפן + פרסר לשוברים ישראליים (שופרסל / סופר-פארם / יוחננוף וכו׳). ב־Netlify עם **AI Gateway**, Gemini Vision רץ רק למשתמש מחובר.
- במסך הוספה יש כפתורי **דוגמאות חיות** (תמונות אמיתיות) לבדיקה.
- בפרודקשן הגדירו את משתני Supabase ב־Netlify Environment Variables (לא ב־git).

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
- OCR מסחרי איכותי (אופציונלי דרך Gemini / `DOCUMENT_OCR_API_KEY`)

## פריסה

הקונפיגורציה בריפו היא **Netlify** (`netlify.toml`): `npm run build`, פרסום `.next`, Node 22. אין Dockerfile. בחירת ספק אחר (Vercel, קונטיינר) דורשת החלטה — אל תניחו שה־`netlify.toml` יעבוד שם כמו שהוא.

1. חברו את הריפו לאתר Netlify.
2. הגדירו את משתני הסביבה מהטבלה למעלה ב־Site configuration (לא ב־git).
3. הפעילו AI Gateway באתר אם רוצים חילוץ Gemini למשתמשים מחוברים.
4. אחרי deploy, ודאו התחברות Google מול ה־redirect של הדומיין האמיתי.
5. סנכרון BuyMe כל כמה שעות אינו רשום ב־`netlify.toml`. צריך מתזמן חיצוני:

```bash
curl -X POST "$SITE_URL/api/cron/buyme-sync" \
  -H "x-cron-secret: $CRON_SECRET"
```

בלי `CRON_SECRET` הקריאה נדחית. שרת Node רגיל: `npm run build && npm start`.

## בדיקות לפני שחרור

```bash
npm ci
npm audit --audit-level=high
npm run lint
npm run typecheck
npm test
npm run build
```
