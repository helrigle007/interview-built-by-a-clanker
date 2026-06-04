import { useId } from "react";

interface StarRatingProps {
  rating: number;
  size?: "sm" | "md";
}

export function StarRating({ rating, size = "md" }: StarRatingProps) {
  const starSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  // Unique per instance so multiple StarRatings on a page don't collide on
  // a shared "half" gradient id (issue #27).
  const gradientId = useId();

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.min(1, Math.max(0, rating - i));
        return (
          <svg
            key={i}
            className={`${starSize} ${fill > 0 ? "text-yellow-400" : "text-gray-200"}`}
            fill={fill >= 1 ? "currentColor" : fill > 0 ? `url(#${gradientId})` : "none"}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {fill > 0 && fill < 1 && (
              <defs>
                <linearGradient id={gradientId}>
                  <stop offset={`${fill * 100}%`} stopColor="currentColor" />
                  <stop offset={`${fill * 100}%`} stopColor="transparent" />
                </linearGradient>
              </defs>
            )}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        );
      })}
      <span className={`ml-1 font-medium ${size === "sm" ? "text-xs text-gray-600" : "text-sm text-gray-700"}`}>
        {rating.toFixed(1)}
      </span>
    </div>
  );
}
