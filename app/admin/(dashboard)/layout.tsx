import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { RappiAgentPanel } from "@/components/admin/rappi-agent";

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--bg)] lg:flex-row">
      <AdminSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-5 lg:px-6 lg:py-8">
          {children}
        </div>
      </div>
      <RappiAgentPanel />
    </div>
  );
}
