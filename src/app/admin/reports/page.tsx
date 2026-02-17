import type { Metadata } from "next";
import AdminReportsPageClient from "./admin-reports-client";

export const metadata: Metadata = {
  title: "신고 관리",
  description: "FreeBoard 신고 검토/처리",
  alternates: { canonical: "/admin/reports" },
};

export default function AdminReportsPage() {
  return <AdminReportsPageClient />;
}
