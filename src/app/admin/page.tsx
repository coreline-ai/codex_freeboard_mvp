import type { Metadata } from "next";
import AdminHomePageClient from "./admin-home-client";

export const metadata: Metadata = {
  title: "관리자 대시보드",
  description: "FreeBoard 관리자 대시보드",
  alternates: { canonical: "/admin" },
};

export default function AdminHomePage() {
  return <AdminHomePageClient />;
}
