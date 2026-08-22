import { SkeletonPage, SkeletonPanel } from "@/components/Skeleton";

/** Leagues, before the list and the two forms are ready. */
export default function Loading() {
  return (
    <SkeletonPage title="w-32">
      <SkeletonPanel rows={2} />
      <div className="grid gap-6 lg:grid-cols-2">
        <SkeletonPanel rows={1} />
        <SkeletonPanel rows={1} />
      </div>
    </SkeletonPage>
  );
}
