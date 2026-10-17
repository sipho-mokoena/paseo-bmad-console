import {
  Book,
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  FilePlus,
  FileText,
  GitMerge,
  LayoutDashboard,
  LayoutTemplate,
  Lightbulb,
  Network,
  Palette,
  Route,
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

/** Icon for one document: well-known names first, then the group's icon. */
export function docIcon(groupId: string, name: string): LucideIcon {
  const n = name.toLowerCase();
  if (n === "design") return Palette;
  if (n === "experience") return Route;
  if (groupId === "design" && n.startsWith("ux")) return LayoutDashboard;
  if (n.includes("glossary")) return Book;
  if (n.includes("diagram")) return Network;
  if (n.includes("addendum")) return FilePlus;
  if (n.includes("reconcile")) return GitMerge;
  if (n.includes("review") || n.includes("rubric")) return ClipboardCheck;
  return groupIcon(groupId);
}
