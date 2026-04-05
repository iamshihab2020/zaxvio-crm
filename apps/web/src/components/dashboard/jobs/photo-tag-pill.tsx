interface PhotoTagPillProps {
  tag: "before" | "after" | "general";
  size?: "sm" | "xs";
}

const TAG_STYLES = {
  before: "bg-blue-100 text-blue-700",
  after: "bg-green-100 text-green-700",
  general: "bg-gray-100 text-gray-600",
};

const TAG_LABELS = {
  before: "Before",
  after: "After",
  general: "General",
};

export function PhotoTagPill({ tag, size = "xs" }: PhotoTagPillProps) {
  const base = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center rounded-full font-medium font-body ${base} ${TAG_STYLES[tag]}`}>
      {TAG_LABELS[tag]}
    </span>
  );
}
