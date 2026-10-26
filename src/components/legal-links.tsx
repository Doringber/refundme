import Link from "next/link";

export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <p className={`text-center text-xs text-eggplant ${className}`}>
      <Link href="/privacy" className="font-bold text-forest">
        פרטיות
      </Link>
      <span aria-hidden> · </span>
      <Link href="/terms" className="font-bold text-forest">
        תנאים
      </Link>
    </p>
  );
}
