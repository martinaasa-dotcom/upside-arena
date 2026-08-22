import { RoomSkeleton } from "@/components/Skeleton";

/*
  A scoreboard row, the table, what you hold, and the trade form. The battle
  room prices every member's book from live quotes, so it is the slowest room
  in the app and the one that most needs to answer a tap immediately.
*/
export default function Loading() {
  return <RoomSkeleton title="w-48" panels={[6, 4, 8]} />;
}
