import { Skeleton, SkeletonPage, SkeletonPanel } from "@/components/Skeleton";
import { BOX } from "@/lib/page-shell";

/*
  Profile, before six separate reads have come back.

  The avatar block is drawn at its real size so the rest of the page does not
  slide down the moment it appears.
*/
export default function Loading() {
  return (
    <SkeletonPage title="w-28">
      <div className={BOX}>
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      </div>
      <SkeletonPanel rows={3} />
      <SkeletonPanel rows={2} />
    </SkeletonPage>
  );
}
