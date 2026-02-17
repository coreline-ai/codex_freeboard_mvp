import type { Metadata } from "next";
import AdminBoardsPageClient from "./admin-boards-client";

export const metadata: Metadata = {
  title: "게시판 관리",
  description: "FreeBoard 게시판 생성/복제 관리",
  alternates: { canonical: "/admin/boards" },
};

export default function AdminBoardsPage() {
  return <AdminBoardsPageClient />;
}
