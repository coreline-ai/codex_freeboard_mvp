import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Board } from "@/types/domain";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

interface LandingBoard {
  id: string;
  slug: string;
  name: string;
  description: string;
  postCount: number;
  isPublic: boolean;
  allowPost: boolean;
  allowComment: boolean;
  requirePostApproval: boolean;
}

interface LandingActivity {
  id: string;
  title: string;
  createdAt: string;
  authorNickname: string;
  boardSlug: string;
}

export const metadata: Metadata = {
  title: "Home",
  description: "실시간 기술 토론과 보드 활동을 한눈에 보는 FreeBoard 메인 랜딩 페이지",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "FreeBoard | Home",
    description: "실시간 기술 토론과 보드 활동을 한눈에 보는 FreeBoard 메인 랜딩 페이지",
    url: "/",
    siteName: "FreeBoard",
    type: "website",
  },
};

function formatRelativeTime(iso: string): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) {
    return "just now";
  }

  const diffSeconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function boardInitial(name: string): string {
  const normalized = name.replace(/\s+/g, "").trim();
  if (!normalized) {
    return "BD";
  }
  return normalized.slice(0, 2).toUpperCase();
}

type RailIconName = "home" | "search" | "discussion" | "ai" | "login" | "admin" | "brand" | "notice";

function RailIcon({ name }: { name: RailIconName }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "home") {
    return (
      <svg {...common}>
        <path d="M3 11.5L12 4l9 7.5" />
        <path d="M5.5 10.5V20h13V10.5" />
      </svg>
    );
  }

  if (name === "search") {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4 4" />
      </svg>
    );
  }

  if (name === "discussion") {
    return (
      <svg {...common}>
        <path d="M4 6.5h16v9H9l-5 4v-13z" />
      </svg>
    );
  }

  if (name === "ai") {
    return (
      <svg {...common}>
        <rect x="5" y="5" width="14" height="14" rx="3" />
        <path d="M9 12h6" />
        <path d="M12 9v6" />
      </svg>
    );
  }

  if (name === "login") {
    return (
      <svg {...common}>
        <path d="M14 4h5v16h-5" />
        <path d="M10 12h9" />
        <path d="M7 9l-3 3 3 3" />
      </svg>
    );
  }

  if (name === "admin") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3" />
        <path d="M5 20c1.4-3 4-4.5 7-4.5s5.6 1.5 7 4.5" />
      </svg>
    );
  }

  if (name === "brand") {
    return (
      <svg {...common}>
        <path d="M12 3l2.1 4.4L19 9l-3.5 3.4.8 4.8-4.3-2.3-4.3 2.3.8-4.8L5 9l4.9-1.6L12 3z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M12 4a8 8 0 108 8" />
      <path d="M12 2v4" />
      <path d="M22 12h-4" />
    </svg>
  );
}

export default async function HomePage() {
  const admin = getSupabaseAdminClient();

  let boards: LandingBoard[] = [];
  let activities: LandingActivity[] = [];
  let boardError = false;
  let activityError = false;

  try {
    const { data: boardRows, error: boardRowsError } = await admin
      .from("boards")
      .select("id,slug,name,description,is_public,allow_post,allow_comment,require_post_approval,created_by,created_at,updated_at,deleted_at")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (boardRowsError) {
      boardError = true;
    } else {
      const allBoards = (boardRows ?? []) as Board[];
      const visibleBoards = allBoards;
      const boardById = new Map(allBoards.map((board) => [board.id, board]));

      const countRows = await Promise.all(
        visibleBoards.map(async (board) => {
          const { count, error } = await admin
            .from("posts")
            .select("id", { count: "exact", head: true })
            .eq("board_id", board.id)
            .eq("status", "published")
            .is("deleted_at", null);

          return [board.id, error ? 0 : (count ?? 0)] as const;
        }),
      );

      const postCountByBoard = new Map(countRows);
      boards = visibleBoards.map((board) => ({
        id: board.id,
        slug: board.slug,
        name: board.name,
        description: board.description?.trim() || "새로운 기술 토론을 시작해 보세요.",
        postCount: postCountByBoard.get(board.id) ?? 0,
        isPublic: board.is_public,
        allowPost: board.allow_post,
        allowComment: board.allow_comment,
        requirePostApproval: board.require_post_approval,
      }));

      const boardIds = allBoards.filter((board) => board.is_public).map((board) => board.id);
      if (boardIds.length > 0) {
        const { data: activityRows, error: activityRowsError } = await admin
          .from("posts")
          .select("id,title,created_at,author_id,board_id")
          .eq("status", "published")
          .is("deleted_at", null)
          .in("board_id", boardIds)
          .order("created_at", { ascending: false })
          .limit(5);

        if (activityRowsError) {
          activityError = true;
        } else {
          const rows = activityRows ?? [];
          const authorIds = [...new Set(rows.map((row) => row.author_id))];
          const { data: profiles } = authorIds.length
            ? await admin.from("profiles").select("id,nickname").in("id", authorIds)
            : { data: [] as Array<{ id: string; nickname: string }> };

          const nicknameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.nickname]));
          activities = rows
            .map((row) => {
              const board = boardById.get(row.board_id);
              if (!board) {
                return null;
              }

              return {
                id: row.id,
                title: row.title,
                createdAt: row.created_at,
                authorNickname: nicknameById.get(row.author_id) ?? "unknown",
                boardSlug: board.slug,
              } satisfies LandingActivity;
            })
            .filter((row): row is LandingActivity => Boolean(row));
        }
      }
    }
  } catch {
    boardError = true;
    activityError = true;
  }

  return (
    <div className={styles.landingShell}>
      <nav className={styles.landingRail} aria-label="Primary">
        <Link href="/" className={styles.landingRailBrand} aria-label="FreeBoard Home">
          <RailIcon name="brand" />
        </Link>

        <div className={styles.landingRailLinks}>
          <Link
            href="/"
            className={`${styles.landingRailLink} ${styles.landingRailLinkActive}`}
            aria-label="Home"
            aria-current="page"
          >
            <RailIcon name="home" />
          </Link>
          <Link href="/search?page=1" className={styles.landingRailLink} aria-label="Search">
            <RailIcon name="search" />
          </Link>
          <Link href="/b/freeboard" className={styles.landingRailLink} aria-label="Discussions">
            <RailIcon name="discussion" />
          </Link>
          <Link href="/b/ai-freeboard" className={styles.landingRailLink} aria-label="Trending AI Board">
            <RailIcon name="ai" />
          </Link>
          <Link href="/login" className={styles.landingRailLink} aria-label="Login">
            <RailIcon name="login" />
          </Link>
          <Link href="/admin" className={styles.landingRailLink} aria-label="Settings">
            <RailIcon name="admin" />
          </Link>
        </div>

        <div className={styles.landingRailProfile} aria-label="Current user profile shortcut">
          <span>ME</span>
        </div>
      </nav>

      <div className={styles.landingCanvas}>
        <header className={styles.landingTopbar}>
          <div className={styles.landingBrandGroup}>
            <p className={styles.landingWordmark}>
              FreeBoard<span>.</span>
            </p>
            <span className={styles.landingVersion}>Beta 2026</span>
          </div>

          <div className={styles.landingTopbarActions}>
            <form action="/search" method="get" className={styles.landingSearchForm} aria-label="Search discussions">
              <input type="hidden" name="page" value="1" />
              <input
                className={styles.landingSearchInput}
                type="search"
                name="q"
                placeholder="Search discussions..."
                aria-label="Search discussions"
              />
            </form>
            <button type="button" className={styles.landingNoticeButton} aria-label="Notifications">
              <RailIcon name="notice" />
            </button>
          </div>
        </header>

        <main className={styles.landingMain}>
          <section className={styles.landingHero} aria-label="Hero">
            <div className={styles.landingHeroBlobOne} />
            <div className={styles.landingHeroBlobTwo} />
            <div className={styles.landingHeroBody}>
              <p className={styles.landingEyebrow}>Editorial Edition</p>
              <h1 className={styles.landingHeroTitle}>
                The Future of <br />
                <span>Tech Dialogue.</span>
              </h1>
              <div className={styles.landingHeroRow}>
                <p className={styles.landingHeroDescription}>
                  Join the decentralized conversation. Share insights on AI architectures, quantum computing, and the
                  next web evolution in a curated space.
                </p>
                <div className={styles.landingHeroActions}>
                  <Link className={styles.landingPrimaryButton} href="/b/freeboard/write">
                    Start Discussion
                  </Link>
                  <Link className={styles.landingSecondaryButton} href="/search?page=1">
                    Explore Boards
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <div className={styles.landingContentGrid}>
            <section className={styles.landingBoardsSection} aria-labelledby="active-boards-heading">
              <header className={styles.landingPanelHeader}>
                <h3 id="active-boards-heading" className={styles.landingPanelTitle}>
                  Active Boards
                </h3>
                <span className={styles.landingBoardCount}>총 {boards.length}개</span>
              </header>

              {boardError ? <p className={styles.landingError}>보드 정보를 불러오지 못했습니다.</p> : null}

              {boards.length === 0 ? (
                <article className={styles.landingEmptyCard}>
                  <h4>아직 공개 보드가 없습니다.</h4>
                  <p>관리자가 첫 번째 보드를 생성하면 여기에 표시됩니다.</p>
                </article>
              ) : (
                <div className={styles.landingBoardGrid}>
                  {boards.map((board) => (
                    <Link key={board.id} href={`/b/${board.slug}`} className={styles.landingBoardCard}>
                      <div className={styles.landingBoardHead}>
                        <span className={styles.landingBoardIcon}>{boardInitial(board.name)}</span>
                        <span className={styles.landingBoardSlug}>/{board.slug}</span>
                      </div>

                      <div className={styles.landingBoardBody}>
                        <h4 className={styles.landingBoardTitle}>{board.name}</h4>
                        <p className={styles.landingBoardDescription}>{board.description}</p>
                      </div>

                      <div className={styles.landingBoardStats}>
                        <span>posts {board.postCount.toLocaleString()}</span>
                        <div className={styles.landingBoardBadges}>
                          <span className={`${styles.landingBadge} ${board.isPublic ? styles.landingBadgePublic : styles.landingBadgePrivate}`}>
                            {board.isPublic ? "public" : "private"}
                          </span>
                          {!board.allowPost ? <span className={styles.landingBadge}>no-post</span> : null}
                          {!board.allowComment ? <span className={styles.landingBadge}>no-comment</span> : null}
                          {board.requirePostApproval ? <span className={styles.landingBadge}>approval-on</span> : null}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <aside className={styles.landingActivitySection} aria-labelledby="latest-activity-heading">
              <header className={styles.landingPanelHeader}>
                <h3 id="latest-activity-heading" className={styles.landingPanelTitle}>
                  Latest Activity
                </h3>
                <span className={styles.landingLiveChip}>Live</span>
              </header>

              {activityError ? <p className={styles.landingError}>활동 데이터를 불러오지 못했습니다.</p> : null}

              {activities.length === 0 ? (
                <article className={styles.landingEmptyCard}>
                  <h4>새로운 활동이 없습니다.</h4>
                  <p>가장 최근 게시글이 등록되면 타임라인이 갱신됩니다.</p>
                </article>
              ) : (
                <div className={styles.landingTimeline}>
                  {activities.map((activity) => (
                    <Link key={activity.id} href={`/p/${activity.id}`} className={styles.landingTimelineItem}>
                      <span className={styles.landingTimelineDot} aria-hidden="true" />
                      <h4>{activity.title}</h4>
                      <p>
                        @{activity.authorNickname} · /{activity.boardSlug} · {formatRelativeTime(activity.createdAt)}
                      </p>
                    </Link>
                  ))}
                </div>
              )}

              <div className={styles.landingTimelineFooter}>
                <Link href="/search?page=1">View all updates</Link>
              </div>
            </aside>
          </div>
        </main>

        <footer className={styles.landingFooter}>
          <p>© 2026 FreeBoard Community.</p>
          <div className={styles.landingFooterLinks}>
            <Link href="/search?page=1">Explore</Link>
            <Link href="/login">Login</Link>
            <Link href="/admin">Admin</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
