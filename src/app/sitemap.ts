import type { MetadataRoute } from "next";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/search`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE_URL}/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/signup`, changeFrequency: "monthly", priority: 0.3 },
  ];

  try {
    const admin = getSupabaseAdminClient();
    const [{ data: boards }, { data: posts }] = await Promise.all([
      admin
        .from("boards")
        .select("id,slug,updated_at")
        .eq("is_public", true)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(500),
      admin
        .from("posts")
        .select("id,created_at,updated_at,status,deleted_at,board_id")
        .eq("status", "published")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(1000),
    ]);

    const boardRoutes: MetadataRoute.Sitemap = (boards ?? []).map((board) => ({
      url: `${BASE_URL}/b/${board.slug}`,
      lastModified: board.updated_at,
      changeFrequency: "hourly",
      priority: 0.8,
    }));

    const publicBoardIdSet = new Set((boards ?? []).map((board) => board.id));
    const postRoutes: MetadataRoute.Sitemap = (posts ?? [])
      .filter((post) => post.status === "published" && !post.deleted_at && publicBoardIdSet.has(post.board_id))
      .map((post) => ({
        url: `${BASE_URL}/p/${post.id}`,
        lastModified: post.updated_at ?? post.created_at,
        changeFrequency: "daily" as const,
        priority: 0.6,
      }));

    if (boards?.length === 0) {
      return staticRoutes;
    }

    return [...staticRoutes, ...boardRoutes, ...postRoutes];
  } catch {
    return staticRoutes;
  }
}
