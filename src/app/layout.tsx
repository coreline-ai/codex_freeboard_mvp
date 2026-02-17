import type { Metadata } from "next";
import { Noto_Sans_KR, Space_Grotesk } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import { TopNav } from "@/components/top-nav";
import "./globals.css";

const bodyFont = Noto_Sans_KR({
  subsets: ["latin"],
  variable: "--font-body",
});

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "FreeBoard",
  description: "Supabase + Netlify 기반 자유 게시판",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <AuthProvider>
          <TopNav />
          <main className="container main-content">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
