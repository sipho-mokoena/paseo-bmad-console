import {
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  FileText,
  LayoutTemplate,
  Lightbulb,
  Network,
  Palette,
  type LucideIcon,
} from "lucide-react";

/** Icon for a Specs / Design document group (ids come from `lib/doc-groups.ts`). */
export function groupIcon(groupId: string): LucideIcon {
  switch (groupId) {
    case "brief":
      return Lightbulb;
    case "prd":
      return ClipboardList;
    case "spec":
      return BookOpen;
    case "architecture":
      return Network;
    case "design":
      return Palette;
    case "wireframes":
      return LayoutTemplate;
    case "reviews":
      return ClipboardCheck;
    default:
      return FileText;
  }
}
