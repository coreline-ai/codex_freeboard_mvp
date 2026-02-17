import { Suspense } from "react";
import SearchPageClient from "@/app/search/search-page-client";

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="empty-state">검색 화면을 준비 중입니다...</div>}>
      <SearchPageClient />
    </Suspense>
  );
}
