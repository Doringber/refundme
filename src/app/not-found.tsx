import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
      <p className="font-display text-5xl text-forest">404</p>
      <h1 className="font-display text-2xl text-night">העמוד לא נמצא</h1>
      <p className="text-sm text-eggplant">
        הכתובת לא קיימת ב{APP_NAME}. אפשר לחזור לדף הבית.
      </p>
      <Link href="/" className="btn-primary px-5 py-3">
        לדף הבית
      </Link>
    </div>
  );
}
