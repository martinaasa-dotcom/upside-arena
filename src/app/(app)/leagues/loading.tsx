import { RoomSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return <RoomSkeleton title="w-32" panels={[3, 2, 2]} />;
}
