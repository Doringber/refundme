"use client";

import Link from "next/link";
import { LoadingBlock } from "@/components/ui/loading";
import { useDemo } from "@/lib/demo/context";

export default function ActivityPage() {
  const demo = useDemo();
  if (!demo.ready) return <LoadingBlock />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl text-night">פעילות אחרונה</h1>
        <p className="text-sm text-eggplant">כל פעולה מקשרת למסמך הרלוונטי</p>
      </div>
      {demo.activity.length === 0 ? (
        <p className="text-sm text-eggplant">אין פעילות עדיין.</p>
      ) : (
        <ul className="space-y-2">
          {demo.activity.map((a) => (
            <li key={a.id}>
              {a.voucherId ? (
                <Link
                  href={`/vouchers/${a.voucherId}`}
                  className="card-surface block px-4 py-3"
                >
                  <p className="font-medium text-night">{a.summaryHe}</p>
                  <p className="text-xs text-eggplant">
                    {new Date(a.createdAt).toLocaleString("he-IL")}
                  </p>
                </Link>
              ) : (
                <div className="card-surface px-4 py-3">
                  <p className="font-medium text-night">{a.summaryHe}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
