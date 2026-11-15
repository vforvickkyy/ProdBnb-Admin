import { PageSkeleton } from "@/components/PageSkeleton";

/**
 * Next shows this inside the (still-mounted) console shell the moment a navigation starts -- and
 * prefetches it for every link in view -- so moving between pages never waits on the server first.
 */
export default function ConsoleLoading() {
  return <PageSkeleton />;
}
