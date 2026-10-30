# פרסום Refunds Bag ב-Google Play

האפליקציה היא מעטפת Android מסוג Trusted Web Activity (TWA) סביב
`https://justrefundme.netlify.app`. האתר נשאר מקור האמת: עדכון באתר מופיע
באפליקציה בלי גרסת חנות. גרסת חנות חדשה נדרשת רק כשמשתנים מעטפת ה-Android
(מזהה חבילה, הרשאות, אייקון שיושב בתוך ה-APK, חתימה).

הפרויקט בנוי לפי תבנית [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
(Apache 2.0) עם `androidbrowserhelper` 2.7.4. יעד ה-API הוא 36, כדי לעמוד
בדרישת Play מ-31 באוגוסט 2026.

## מזהה החבילה

`app.refundsbag`

כדי לשנות אותו, עדכנו את שלושת המקומות האלה לאותו ערך:

1. `android/gradle.properties` — `APP_ID` (זה מה שנכנס ל-APK ול-AAB)
2. `android/twa-manifest.json` — `packageId`
3. `public/.well-known/assetlinks.json` — `package_name`

אם משנים את הדומיין (`APP_HOST`), מעדכנים גם את `site` ב-`android/app/src/main/res/values/strings.xml`.

חבילת ה-Java `app.refundsbag` (התיקייה `android/app/src/main/java/app/refundsbag`)
יכולה להישאר גם אם `APP_ID` משתנה.

כתובת האתר שה-TWA פותח נמצאת באותו `gradle.properties`: `APP_HOST` ו-`APP_START_PATH`
(ברירת מחדל `justrefundme.netlify.app` ו-`/dashboard`, כמו `start_url` במניפסט).
כל העלאה ל-Play דורשת `APP_VERSION_CODE` גבוה יותר מהקודם.

## חתימה

אסור להכניס ל-git קובץ keystore או סיסמה. `android/.signing/` ב-`.gitignore`.

לבדיקות מקומיות:

```bash
android/scripts/generate-test-keystore.sh
```

הסקריפט יוצר מפתח זמני (אם עדיין אין) ומדפיס את טביעת ה-SHA-256.
הסיסמה נשמרת רק ב-`android/.signing/signing.properties`.

טביעת האצבע שב-`assetlinks.json` כרגע היא של המפתח הזמני הזה. המפתח הפרטי
לא נשמר ב-git. אחרי ש-`assetlinks.json` פרוס באתר, רק בנייה שנחתמה במפתח
הזה תיפתח בלי שורת כתובת. מפתח שנוצר מחדש במחשב אחר מקבל טביעת אצבע אחרת
וצריך לעדכן את הקובץ.

לפני העלאה ל-Play יוצרים **מפתח העלאה** חדש במחשב שלכם. לא משתמשים במפתח
הזמני, כי הוא לא נשמר:

```bash
keytool -genkeypair -v \
  -keystore "$HOME/refunds-bag-upload.jks" \
  -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

`keytool` יבקש סיסמה. שמרו את הקובץ ואת הסיסמה מחוץ ל-repo.
אחר כך העתיקו את ה-keystore אל `android/.signing/` (התיקייה לא נכנסת ל-git)
ועדכנו את `android/.signing/signing.properties`:

```
storeFile=.signing/upload.jks
keyAlias=upload
storePassword=...
keyPassword=...
```

ב-Play Console משאירים את **Play App Signing** דלוק (ברירת המחדל). Play חותם
מחדש את מה שמשתמשים מורידים, במפתח שנשאר אצל Google. לכן אחרי ההעלאה הראשונה
מעתיקים את **App signing key certificate → SHA-256** (לא את ה-upload key)
מ-Play Console → **Test and release → App integrity → App signing**, ומוסיפים
אותו למערך `sha256_cert_fingerprints` ב-`assetlinks.json`. אפשר להשאיר גם את
טביעת המפתח הזמני, כדי שבניית הבדיקה תמשיך להיפתח במסך מלא.

בניית ה-AAB לחנות:

```bash
export ANDROID_HOME="$HOME/android-sdk"   # או הנתיב אצלכם
cd android
./gradlew bundleRelease
```

הקובץ: `android/app/build/outputs/bundle/release/app-release.aab`.

בלי `signing.properties` ה-release יוצא לא חתום, וה-debug נחתם במפתח debug
של המחשב. את ה-AAB הלא חתום אי אפשר להעלות. ה-AAB שנבנה לבדיקה עם המפתח
הזמני גם הוא לא המפתח שכדאי להעלות ל-Play — צרו מפתח העלאה משלכם.

## בניית בדיקה

נדרשים JDK 17+ (נבדק על 21) ו-Android SDK עם `platforms;android-36` ו-build-tools.
האפליקציה דורשת Android 7 ומעלה (`minSdk` 24), כי `androidbrowserhelper` 2.7.4 לא תומך בגרסאות ישנות יותר.

```bash
export ANDROID_HOME="$HOME/android-sdk"
cd android
./gradlew assembleDebug bundleRelease
```

- APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`

## Digital Asset Links — לפני ואחרי הפריסה

ה-TWA מסתיר את שורת הכתובת רק אחרי ש-Chrome מאמת את
`https://justrefundme.netlify.app/.well-known/assetlinks.json`
מול תעודת החתימה של האפליקציה המותקנת.

- **לפני שהקובץ באוויר:** האפליקציה נפתחת, אבל Chrome מציג את האתר **עם**
  שורת כתובת (Custom Tab רגיל). זה צפוי. האימות לא יכול להצליח מול האתר
  הישן.
- **אחרי מיזוג ופריסה ל-Netlify:** הקובץ נגיש כ-`application/json`, בלי
  הפניה ובלי התחברות. בנייה שנחתמה בטביעת האצבע שבקובץ נפתחת במסך מלא, בלי
  שורת כתובת. האימות יכול לקחת כמה דקות, ולפעמים שעות, בגלל מטמון של Chrome.
- **אחרי העלאה ל-Play:** החבילה שמשתמשים מתקינים חתומה במפתח של Play App
  Signing, לא במפתח הזמני. בלי להוסיף את ה-SHA-256 של **App signing key**,
  שורת הכתובת חוזרת גם אחרי שהקובץ פרוס.

בדיקה אחרי פריסה:

`https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://justrefundme.netlify.app&relation=delegate_permission/common.handle_all_urls`

האתר מגיש את הקובץ מ-`public/.well-known/assetlinks.json`. הכותרת
`Content-Type: application/json` מוגדרת גם ב-`next.config.ts` וגם ב-`netlify.toml`.
`src/proxy.ts` לא מרענן סשן על `/.well-known/`, כדי שהקובץ לא יהיה תלוי ב-Supabase.

## Google Play

1. פותחים חשבון ב-[Play Console](https://play.google.com/console). דמי הרישום
   **25$** חד-פעמיים. משלימים את אימות הזהות ש-Google מבקשים.
2. יוצרים אפליקציה בשם **Refunds Bag**. סוג: App. בלי תשלום בתוך האפליקציה.
3. חשבונות **אישיים** שנפתחו אחרי 13 בנובמבר 2023 חייבים **בדיקה סגורה**
   לפני מסלול הייצור: לפחות **12 בודקים** שנשארו opted-in ברצף **14 יום**,
   ואז ב-Dashboard לוחצים **Apply for production**. בדיקה פנימית
   (Internal testing) לא נספרת. חשבון ארגון, או חשבון אישי ישן יותר, לא
   כפוף לכלל הזה.
   [מדיניות הבדיקה](https://support.google.com/googleplay/android-developer/answer/14151465).
4. נכסי חנות (**Grow users → Store presence → Main store listing**). אפשר בעברית:
   - שם: Refunds Bag (עד 30 תווים)
   - תיאור קצר: עד 80 תווים
   - תיאור מלא: עד 4000 תווים
   - אייקון 512×512: `public/icons/icon-512.png` (עותק גם ב-`android/store_icon.png`)
   - Feature graphic: 1024×500
   - לפחות שני צילומי מסך של טלפון
   - מדיניות פרטיות: `https://justrefundme.netlify.app/privacy`
5. משלימים את טפסי המדיניות (**Policy → App content**): דירוג תוכן, קהל יעד,
   מודעות (אין), ו-Data safety לפי מה שהאפליקציה באמת עושה — חשבון דרך
   Supabase, מיקום בדפדפן שלא נשמר בשרת, תמונות של שוברים. לא מסמנים איסוף
   שלא קיים.
6. העלאה: **Test and release → Testing → Closed testing → Create release**.
   מעלים את ה-AAB שנחתם ב**מפתח ההעלאה**. Play App Signing נשאר פעיל.
   אחרי שהבדיקה הסגורה עמדה בתנאים, מגישים **Apply for production** ומעלים
   את אותה חבילה (או חבילה חדשה יותר) למסלול **Production**.

אחרי ההעלאה הראשונה חוזרים לסעיף החתימה ומוסיפים ל-`assetlinks.json` את
ה-SHA-256 של מפתח ה-App signing, ואז מפרסמים את האתר. בלי הצעד הזה משתמשי
החנות יראו שורת כתובת.
