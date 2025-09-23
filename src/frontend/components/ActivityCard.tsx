import React from "react";
import { Play } from "lucide-react";

type Metric = { label: string; value: number; color?: string }; // 0..100

type ActivityCardProps = {
  title: string;
  backgroundColor?: string; // hex, rgb, or tailwind class
  metrics: Metric[];
  onClick?: () => void; // whole card click
  onPlay?: () => void; // play button click
  className?: string;
  width?: number;     // optional card width (default full)
  height?: number; // optional card height (default 16rem)
};

// ---------------------------
// Progress Wheel Component
// ---------------------------
function ProgressWheel({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));

  // Map 0 → 100 into a color gradient (red → yellow → green)
  function valueToColor(v: number) {
    const r = v < 50 ? 255 : Math.round(255 - (v - 50) * 5.1); // stays 255 then decreases
    const g = v < 50 ? Math.round(v * 5.1) : 255; // increases then stays max
    return `rgb(${r},${g},0)`; // no blue component, gives red→yellow→green
  }

  const wheelColor = valueToColor(pct);

  return (
    <div className="flex flex-col items-center min-w-[20%]">
      <div
        className="relative h-10 w-10 rounded-full grid place-items-center shadow"
        style={{
          background: `conic-gradient(${wheelColor} ${pct}%, #E5E7EB 0)`,
        }}
        aria-label={`${label} ${pct}%`}
        role="img"
      >
        <div className="absolute h-8 w-8 bg-white rounded-full grid place-items-center text-xs font-semibold">
          {pct}
        </div>
      </div>
      <div className="mt-1 text-xs text-gray-600">{label}</div>
    </div>
  );
}

// ---------------------------
// Play Button Component
// ---------------------------
type PlayButtonProps = {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

function PlayButton({ onClick }: PlayButtonProps) {
  return (
    <button
      onClick={onClick}
      className="ml-auto mr-1 shrink-0 h-12 w-12 rounded-full bg-gray-100 hover:bg-indigo-600 hover:text-white grid place-items-center shadow transition-colors"
      aria-label="Play"
    >
      <Play className="h-6 w-6" />
    </button>
  );
}


// ---------------------------
// Activity Card Component
// ---------------------------
export default function ActivityCard({
  title,
  backgroundColor = "#fca5a5", // default pinkish red
  metrics,
  onClick,
  onPlay,
  className = "",
  width = 16,
  height = 16,
}: ActivityCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.();
      }}
      className={[
        "relative overflow-hidden rounded-2xl shadow-md cursor-pointer",
        "transition-transform hover:-translate-y-0.5",
        className,
      ].join(" ")}
      style={{ height: `${height}rem`, width: `${width}rem` }}
    >
      {/* Top color background (80%) */}
      <div
        className="absolute top-0 left-0 w-full h-[80%]"
        style={{ backgroundColor }}
      />

      {/* Title */}
      <div className="relative p-4">
        <h3 className="text-2xl font-semibold text-black/70 drop-shadow-sm">
          {title}
        </h3>
      </div>

      {/* Bottom stats bar */}
      <div className="absolute bottom-0 left-0 right-0">
        <div className="mx-3 mb-3 rounded-2xl bg-white/95 backdrop-blur px-3 py-2 shadow-sm">
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
            {metrics.map((m, i) => (
              <ProgressWheel key={i} {...m} />
            ))}

            <PlayButton
              onClick={(e) => {
                e.stopPropagation(); // prevent card click
                onPlay?.();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
