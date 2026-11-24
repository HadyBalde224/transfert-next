import type { ReactNode } from "react";
import { exigerProfil } from "@/lib/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await exigerProfil();
  return <div className="min-h-screen bg-gray-50 pb-28 print:bg-white print:pb-0">{children}</div>;
}
