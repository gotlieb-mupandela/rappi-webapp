import { CatalogBrowser } from "@/components/catalog-browser";
import { MetaSearch } from "@/components/meta-search";
import { SearchEmpty } from "@/components/search-empty";
import { SearchHeader } from "@/components/search-header";
import { getCatalog } from "@/lib/supabase/catalog";

export const revalidate = 3600;

export default async function SearchPage() {
  const catalog = await getCatalog();

  return (
    <div>
      <MetaSearch />
      <SearchHeader catalogCount={catalog.length} />
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
