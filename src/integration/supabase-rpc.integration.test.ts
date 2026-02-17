import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { POST as createBoardPostRoute } from "@/app/api/boards/[slug]/posts/route";

const enabled =
  process.env.RUN_SUPABASE_INTEGRATION_TESTS === "1" &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!enabled) {
  describe.skip("supabase integration", () => {
    it("requires RUN_SUPABASE_INTEGRATION_TESTS=1 and local Supabase env", () => {});
  });
}

if (enabled) {
  describe("supabase integration", () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const password = "Passw0rd!integration";
  const seed = randomUUID().slice(0, 8);

  const ownerEmail = `owner_${seed}@local.test`;
  const memberEmail = `member_${seed}@local.test`;
  const adminEmail = `admin_${seed}@local.test`;

  const createdUserIds: string[] = [];
  let ownerId = "";
  let memberId = "";
  let adminId = "";
  let privateBoardSlug = "";
  let postId = "";

  async function waitForProfile(userId: string) {
    for (let i = 0; i < 20; i += 1) {
      const { data } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
      if (data?.id === userId) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`profile not found for user ${userId}`);
  }

  async function createUser(email: string, nickname: string) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nickname },
    });

    if (error || !data.user) {
      throw error ?? new Error("failed to create user");
    }

    createdUserIds.push(data.user.id);
    await waitForProfile(data.user.id);
    return data.user.id;
  }

  async function getToken(email: string) {
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      throw error ?? new Error("failed to sign in");
    }
    return data.session.access_token;
  }

  beforeAll(async () => {
    ownerId = await createUser(ownerEmail, `owner_${seed}`);
    memberId = await createUser(memberEmail, `member_${seed}`);
    adminId = await createUser(adminEmail, `admin_${seed}`);

    const { error: setAdminError } = await admin
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", adminId);
    if (setAdminError) {
      throw setAdminError;
    }

    privateBoardSlug = `private-${seed}`;
    const { data: board, error: boardError } = await admin
      .from("boards")
      .insert({
        slug: privateBoardSlug,
        name: `Private ${seed}`,
        description: "integration test board",
        is_public: false,
        allow_post: true,
        allow_comment: true,
        require_post_approval: false,
        created_by: ownerId,
      })
      .select("id")
      .single();
    if (boardError || !board) {
      throw boardError ?? new Error("failed to create board");
    }

    const { data: post, error: postError } = await admin
      .from("posts")
      .insert({
        board_id: board.id,
        author_id: ownerId,
        title: `post ${seed}`,
        content: "integration content",
        status: "published",
      })
      .select("id")
      .single();
    if (postError || !post) {
      throw postError ?? new Error("failed to create post");
    }

    postId = post.id;
  });

  afterAll(async () => {
    if (postId) {
      await admin.from("post_likes").delete().eq("post_id", postId);
      await admin.from("posts").delete().eq("id", postId);
    }

    if (privateBoardSlug) {
      await admin.from("boards").delete().eq("slug", privateBoardSlug);
    }

    for (const userId of createdUserIds) {
      await admin.auth.admin.deleteUser(userId);
    }
  });

  it("denies non-admin post creation on private board", async () => {
    const token = await getToken(memberEmail);

    const request = new Request(`http://127.0.0.1:3000/api/boards/${privateBoardSlug}/posts`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "private write blocked",
        content: "member should not write private board",
      }),
    });

    const response = await createBoardPostRoute(request, {
      params: Promise.resolve({ slug: privateBoardSlug }),
    });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.ok).toBe(false);
  });

  it("toggles likes atomically via rpc", async () => {
    const first = await admin.rpc("toggle_post_like", {
      p_post_id: postId,
      p_user_id: memberId,
    });
    expect(first.error).toBeNull();
    expect(first.data?.[0]?.liked).toBe(true);

    const second = await admin.rpc("toggle_post_like", {
      p_post_id: postId,
      p_user_id: memberId,
    });
    expect(second.error).toBeNull();
    expect(second.data?.[0]?.liked).toBe(false);
  });

  it("search_profiles_admin handles special character query safely", async () => {
    const { data, error } = await admin.rpc("search_profiles_admin", {
      p_page: 1,
      p_page_size: 20,
      p_role: null,
      p_query: "%_",
      p_suspended_only: false,
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
  });
}
