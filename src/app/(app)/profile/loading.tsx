import { RoomSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return <RoomSkeleton title="w-36" panels={[3, 4, 3, 2]} />;
}
