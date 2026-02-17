import type { Metadata } from "next";
import PostDetailPageClient from "./post-detail-page-client";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ postId: string }>;
}

function summarize(content: string) {
  return content.replace(/\s+/g, " ").trim().slice(0, 160);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { postId } = await params;
  const admin = getSupabaseAdminClient();

  const { data: post } = await admin
    .from("posts")
    .select("id,title,content,board_id,status,deleted_at")
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!post || post.status !== "published") {
    return {
      title: "게시글 | FreeBoard",
      description: "FreeBoard 게시글",
      alternates: { canonical: `/p/${postId}` },
    };
  }

  const { data: board } = await admin
    .from("boards")
    .select("slug,name,is_public")
    .eq("id", post.board_id)
    .is("deleted_at", null)
    .maybeSingle();

  const title = `${post.title} | FreeBoard`;
  const description = summarize(post.content || "");

  return {
    title,
    description,
    alternates: {
      canonical: `/p/${postId}`,
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: `/p/${postId}`,
      siteName: "FreeBoard",
    },
    robots: board?.is_public ? undefined : { index: false, follow: false },
  };
}

export default function PostDetailPage() {
  return <PostDetailPageClient />;
}
