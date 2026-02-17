import type { Metadata } from "next";
import BoardPageClient from "./board-page-client";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const admin = getSupabaseAdminClient();

  const { data: board } = await admin
    .from("boards")
    .select("slug,name,description")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  const title = board ? `${board.name} | FreeBoard` : `${slug} | FreeBoard`;
  const description = board?.description?.trim() || "FreeBoard 게시판";

  return {
    title,
    description,
    alternates: {
      canonical: `/b/${slug}`,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/b/${slug}`,
    },
  };
}

export default function BoardPage() {
  return <BoardPageClient />;
}
