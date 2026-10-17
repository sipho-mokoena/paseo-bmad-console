import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { SearchShortcut } from "@/components/layout/search-shortcut";
import { BreadcrumbProvider } from "@/contexts/breadcrumb-context";
import { getRepos } from "@/lib/db/helpers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const repos = await getRepos();
  const localFsEnabled = process.env.ENABLE_LOCAL_FS === "true";

  return (
    <BreadcrumbProvider>
      <SidebarProvider>
        <SearchShortcut />
        <AppSidebar repos={repos} localFsEnabled={localFsEnabled} />
        <SidebarInset>
          <AppHeader repos={repos} />
          <div className="min-w-0 flex-1">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </BreadcrumbProvider>
  );
}
