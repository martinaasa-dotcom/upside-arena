import { RoomSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return <RoomSkeleton title="w-32" scores={4} panels={[3, 3]} />;
}
