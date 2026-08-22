import { RoomSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return <RoomSkeleton title="w-40" panels={[6, 2]} />;
}
