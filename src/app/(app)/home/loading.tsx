import { SkeletonPage, SkeletonPanel, SkeletonScoreboard } from "@/components/Skeleton";

/*
  Home, before the prices land.

  Four number tiles and the holdings panel, in the places they will occupy.
  This is the screen people open every day, and it is the one waiting on the
  most: a portfolio, a streak, the leagues, the market. Laying it out first
  means the only thing still to arrive is the figures.
*/
export default function Loading() {
  return (
    <SkeletonPage title="w-32">
      <SkeletonScoreboard />
      <SkeletonPanel rows={2} />
    </SkeletonPage>
  );
}
