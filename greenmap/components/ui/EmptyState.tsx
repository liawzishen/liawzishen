import { cn } from "@/lib/utils";

/**
 * Centred empty state — guides toward the first action (06 §4).
 *
 * `headingLevel` exists because this component hard-coded <h2>. When an
 * empty state is the whole content of a screen it is that screen's <h1>;
 * when it sits inside a section it may need to be an <h3>. A fixed level
 * silently punched holes in the heading outline of whichever page it
 * happened to land on.
 */
export function EmptyState({
  icon,
  title,
  body,
  headingLevel = 2,
  className,
  children,
}: {
  icon?: string;
  title: string;
  body?: string;
  headingLevel?: 1 | 2 | 3;
  className?: string;
  children?: React.ReactNode;
}) {
  const Heading = `h${headingLevel}` as const;

  return (
    <div
      className={cn(
        "flex flex-col items-center px-6 py-16 text-center",
        className
      )}
    >
      {icon && (
        <div aria-hidden className="mb-3 text-[44px] leading-none">
          {icon}
        </div>
      )}
      <Heading className="text-[17px] font-semibold">{title}</Heading>
      {body && (
        <p className="mt-1.5 max-w-[280px] text-[15px] leading-relaxed text-secondary">
          {body}
        </p>
      )}
      {children && <div className="mt-5 w-full max-w-[280px]">{children}</div>}
    </div>
  );
}
