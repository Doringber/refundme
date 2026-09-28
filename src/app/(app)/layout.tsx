import { cookies } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { AppDataProvider } from "@/lib/app-data/context";
import { DEMO_COOKIE } from "@/lib/constants";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jar = await cookies();
  const demoCookie = jar.get(DEMO_COOKIE)?.value === "1";

  return (
    <AppDataProvider initialDemoCookie={demoCookie}>
      <AppShell>{children}</AppShell>
    </AppDataProvider>
  );
}
