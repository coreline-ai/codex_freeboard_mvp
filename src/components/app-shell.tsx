"use client";

import { usePathname } from "next/navigation";
import { TopNav } from "@/components/top-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/") {
    return <>{children}</>;
  }

  return (
    <>
      <TopNav />
      <main className="container main-content">{children}</main>
    </>
  );
}
