import { SkeletonPage, SkeletonPanel } from "@/components/Skeleton";

/*
  The fallback for any room without one of its own.

  A room that adds its own loading.tsx describes itself more exactly; this is
  what stops a new room ever shipping with nothing at all.
*/
export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPanel rows={3} />
    </SkeletonPage>
  );
}
