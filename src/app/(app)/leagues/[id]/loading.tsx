import { SkeletonPage, SkeletonPanel, SkeletonScoreboard } from "@/components/Skeleton";

/** One league, before the table has been priced. */
export default function Loading() {
  return (
    <SkeletonPage title="w-44">
      <SkeletonScoreboard cells={2} />
      <SkeletonPanel rows={5} />
    </SkeletonPage>
  );
}
