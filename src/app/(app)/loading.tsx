import { RoomSkeleton } from "@/components/Skeleton";

/*
  The fallback for any room that has not written one of its own.

  Every room has one today, and each of those describes its own shape more
  exactly than this can. This is here so that the next room to be added
  cannot ship without a loading boundary at all, which is the state that
  makes a dock tab feel like it ignored the tap.
*/
export default function Loading() {
  return <RoomSkeleton panels={[3]} />;
}
