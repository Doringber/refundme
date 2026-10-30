# Manifest entry points. R8 would otherwise treat them as unused.
-keep class app.refundsbag.LauncherActivity { *; }
-keep class app.refundsbag.Application { *; }
-keep class app.refundsbag.DelegationService { *; }
-keep class com.google.androidbrowserhelper.** { *; }
-keep class androidx.browser.** { *; }
