import { Skeleton, SkeletonPage } from "@/components/Skeleton";
import { BOX } from "@/lib/page-shell";

/** Trade, before the cash figure and the form are ready. */
export default function Loading() {
  return (
    <SkeletonPage title="w-24">
      <div className={BOX}>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-11 w-36 rounded-lg" />
        </div>
      </div>
    </SkeletonPage>
  );
}
