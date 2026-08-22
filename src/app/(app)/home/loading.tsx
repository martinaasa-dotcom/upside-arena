import { RoomSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return <RoomSkeleton title="w-48" scores={4} panels={[4, 3]} />;
}
