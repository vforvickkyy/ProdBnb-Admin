import { Badge } from "@/components/ui/Badge";
import type { components } from "@/types/admin-api";

export type SitePage = components["schemas"]["SitePage"];
export type Placement = SitePage["placement"];

export const PLACEMENT_LABEL: Record<Placement, string> = {
  company: "Footer · Company",
  legal: "Footer · Legal",
  hidden: "Not in footer",
};

export function PageStatus({ page }: { page: SitePage }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {page.is_published ? <Badge tone="success">Published</Badge> : <Badge>Draft</Badge>}
      {page.needs_review && <Badge tone="warning">Needs review</Badge>}
      {page.placeholders.length > 0 && (
        <Badge tone="warning">
          {page.placeholders.length} blank{page.placeholders.length === 1 ? "" : "s"} to fill
        </Badge>
      )}
    </div>
  );
}

