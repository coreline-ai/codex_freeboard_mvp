import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "관리자 | FreeBoard",
    template: "%s | FreeBoard Admin",
  },
  description: "FreeBoard 관리자 운영 화면",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
