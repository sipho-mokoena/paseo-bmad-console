import { Suspense } from "react";
import { SearchView } from "@/components/search/search-view";

export const metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <div className="page-pad">
      <Suspense fallback={null}>
        <SearchView />
      </Suspense>
    </div>
  );
}
