import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

let pathname = "/repo/local/sovren";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ refresh: () => {} }),
}));
vi.mock("@/actions/repo-actions", () => ({ refreshRepoData: async () => ({ success: true, data: { totalFiles: 1 } }) }));
vi.mock("@/contexts/breadcrumb-context", () => ({ useBreadcrumb: () => ({ title: null }) }));
vi.mock("@/components/ui/sidebar", () => ({ SidebarTrigger: () => <button type="button">toggle</button> }));

import { AppHeader } from "./app-header";

describe("AppHeader refresh button", () => {
  it("shows on project routes", () => {
    pathname = "/repo/local/sovren";
    const html = renderToStaticMarkup(<AppHeader />);
    expect(html).toContain('aria-label="Refresh data"');
    expect(html).toContain('title="Refresh data"');
    expect(html).not.toContain("aria-hidden=\"true\" data-aria-hidden");
  });
  it("is absent elsewhere", () => {
    pathname = "/";
    expect(renderToStaticMarkup(<AppHeader />)).not.toContain("Refresh data");
  });
});
