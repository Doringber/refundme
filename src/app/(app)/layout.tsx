import { AppShell } from "@/components/layout/app-shell";
import { DemoProvider } from "@/lib/demo/context";
import { shouldPreferDemo } from "@/lib/demo/mode";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const demo = shouldPreferDemo();

  return (
    <DemoProvider>
      <AppShell demo={demo}>{children}</AppShell>
    </DemoProvider>
  );
}
