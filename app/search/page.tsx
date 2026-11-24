import { CatalogBrowser } from "@/components/catalog-browser";
import { MetaSearch } from "@/components/meta-search";
import { SearchEmpty } from "@/components/search-empty";
import { SearchHeader } from "@/components/search-header";
import { offlineCatalog } from "@/lib/offline-catalog";

// Rebuilt weekly at most; catalogue changes refresh pages straight away via the "catalog" tag.
export const revalidate = 604800;

export default async function SearchPage() {
  return (
    <div>
      <MetaSearch />
      <SearchHeader catalogCount={offlineCatalog.length} />
      <div className="page-shell py-8 sm:py-10">
        <CatalogBrowser
          basePath="/search"
          requireQuery
          grouped={false}
          showCategoryFilter
          emptyTitleKey="search.emptyTitle"
          emptyBodyKey="search.emptyBody"
          emptyQuery={<SearchEmpty />}
        />
      </div>
    </div>
  );
}
