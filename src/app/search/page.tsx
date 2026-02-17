import type { Metadata } from "next";
import { Suspense } from "react";
import SearchPageClient from "@/app/search/search-page-client";

interface Props {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  const query = q?.trim();

  if (query) {
    return {
      title: `검색: ${query} | FreeBoard`,
      description: `"${query}" 검색 결과`,
      alternates: {
        canonical: `/search?q=${encodeURIComponent(query)}`,
      },
    };
  }

  return {
    title: "통합 검색 | FreeBoard",
    description: "FreeBoard 통합 검색",
    alternates: {
      canonical: "/search",
    },
  };
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="empty-state">검색 화면을 준비 중입니다...</div>}>
      <SearchPageClient />
    </Suspense>
  );
}
