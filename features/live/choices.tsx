"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { pageOf } from "@/lib/api/identity-contract";
import { useIdentity } from "@/features/identity/queries";
import { Notice } from "./shared";
export function useChoices<T extends z.ZodType>(
  scope: string | null,
  path: string,
  item: T,
  enabled = true,
) {
  const user = useIdentity().data;
  const result = useInfiniteQuery({
    queryKey: ["live", scope, user?.id, "choices", path],
    enabled: enabled && !!user,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      apiRequest(
        "/api/v1/" + path + `?offset=${pageParam}&limit=50`,
        pageOf(item),
        { signal },
      ),
    getNextPageParam: (last, pages) =>
      last.items.length === 50 ? pages.length * 50 : undefined,
    staleTime: 15_000,
    gcTime: 60_000,
  });
  return {
    ...result,
    data:
      result.error instanceof ApiError &&
      [401, 403].includes(result.error.status)
        ? undefined
        : result.data,
  };
}
export function ChoiceLoader({
  query,
}: {
  query: {
    isPending: boolean;
    error: Error | null;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => unknown;
  };
}) {
  return (
    <>
      {query.isPending && <small role="status">Loading options…</small>}
      <Notice error={query.error} />
      {query.hasNextPage && (
        <button
          type="button"
          className="text-button"
          disabled={query.isFetchingNextPage}
          onClick={() => query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "Loading…" : "Load more options"}
        </button>
      )}
    </>
  );
}
