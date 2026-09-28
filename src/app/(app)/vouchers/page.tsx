import { Suspense } from "react";
import { LoadingBlock } from "@/components/ui/loading";
import { VouchersClient } from "./vouchers-client";

export default function VouchersPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <VouchersClient />
    </Suspense>
  );
}
