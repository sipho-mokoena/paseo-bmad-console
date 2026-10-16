import { NextResponse } from "next/server";
import { getAuthenticatedSession, getAuthenticatedRepos } from "@/lib/db/helpers";
import { searchAllRepos } from "@/lib/search-server";
import { MAX_QUERY_LENGTH } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const repos = await getAuthenticatedRepos(session.userId);
    const result = await searchAllRepos(q.slice(0, MAX_QUERY_LENGTH * 2), session.userId, repos);
    return NextResponse.json(
      { result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[search] failed", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
