import { SkeletonPage, SkeletonPanel } from "@/components/Skeleton";

/** Arena Plus, before the standing and the shop are read. */
export default function Loading() {
  return (
    <SkeletonPage title="w-36">
      <SkeletonPanel rows={4} />
      <SkeletonPanel rows={3} />
    </SkeletonPage>
  );
}
