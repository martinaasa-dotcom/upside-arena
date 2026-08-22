import { SkeletonPage, SkeletonPanel, SkeletonScoreboard } from "@/components/Skeleton";

/** The season, before its settled weeks are added up. */
export default function Loading() {
  return (
    <SkeletonPage title="w-48">
      <SkeletonScoreboard cells={3} />
      <SkeletonPanel rows={6} />
    </SkeletonPage>
  );
}
