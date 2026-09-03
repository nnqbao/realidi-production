import { whyThisMatchLines, type WhyThisMatchInput } from "@/lib/discovery/why-this-match";

export function WhyThisMatch(props: WhyThisMatchInput & { className?: string }) {
  const lines = whyThisMatchLines(props);
  if (lines.length === 0) return null;
  return (
    <div className={props.className}>
      <p className="text-xs font-medium text-brand">Vì sao gợi ý này</p>
      <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
