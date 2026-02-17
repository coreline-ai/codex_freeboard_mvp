import type { Metadata } from "next";
import AdminUsersPageClient from "./admin-users-client";

export const metadata: Metadata = {
  title: "유저 관리",
  description: "FreeBoard 사용자 권한/정지 관리",
  alternates: { canonical: "/admin/users" },
};

export default function AdminUsersPage() {
  return <AdminUsersPageClient />;
}
