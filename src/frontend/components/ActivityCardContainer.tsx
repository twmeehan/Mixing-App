import ActivityCard from "./ActivityCard";

type ActivityItem = {
  title: string;
  backgroundColor?: string;
  metrics: { label: string; value: number; color?: string }[];
  onClick?: () => void;
  onPlay?: () => void;
};

type Props = {
  items: ActivityItem[];
  className?: string;
  maxHeight?: string; // e.g., "70vh"
};

export default function ActivityCardContainer({
  items,
  className = "",
  maxHeight = "70vh",
}: Props) {
  return (
    <div className={`mx-auto w-[70vw] max-w-[1400px] ${className}`}>
      <div
        className={[
          "grid gap-6",
          "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          "overflow-y-auto",
          "pt-3 px-3", // padding
        ].join(" ")}
        style={{ maxHeight }}
      >
        {items.map((it, i) => (
          <ActivityCard key={i} {...it} />
        ))}
      </div>
    </div>
  );
}
