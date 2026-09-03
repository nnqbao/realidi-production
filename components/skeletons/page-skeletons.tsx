import { Skeleton } from "@/components/ui/skeleton";

export function FeedPageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-40" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>
      <Skeleton className="h-72 w-full rounded-3xl" />
      <Skeleton className="h-56 w-full rounded-3xl" />
    </div>
  );
}

export function PlacePageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="aspect-[16/10] w-full rounded-3xl" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  );
}

export function ProfilePageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex gap-4">
        <Skeleton className="size-20 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-56 w-full rounded-3xl" />
    </div>
  );
}

export function MessagesPageSkeleton() {
  return (
    <div className="space-y-2 p-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

export function FormPageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-11 w-28" />
    </div>
  );
}
