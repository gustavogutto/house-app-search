import type { listings, filterCriteria } from "../db/schema";

type Listing = typeof listings.$inferSelect;
type FilterCriteria = typeof filterCriteria.$inferSelect;

/**
 * A field that failed to parse (null/undefined) is treated as a pass, not a
 * fail — a parser gap should never cause a silently missed apartment. This
 * favors false positives (an extra notification to double-check) over false
 * negatives (a missed listing).
 */
export function matchesFilter(listing: Listing, filter: FilterCriteria): boolean {
  if (!filter.isActive) return false;

  if (filter.minPrice != null && listing.price != null && listing.price < filter.minPrice) {
    return false;
  }
  if (filter.maxPrice != null && listing.price != null && listing.price > filter.maxPrice) {
    return false;
  }

  if (filter.minBedrooms != null && listing.bedrooms != null && listing.bedrooms < filter.minBedrooms) {
    return false;
  }
  if (filter.maxBedrooms != null && listing.bedrooms != null && listing.bedrooms > filter.maxBedrooms) {
    return false;
  }

  if (filter.areas && filter.areas.length > 0 && listing.address) {
    const address = listing.address.toLowerCase();
    const matchesArea = filter.areas.some((area) => address.includes(area.toLowerCase()));
    if (!matchesArea) return false;
  }

  if (filter.propertyTypes && filter.propertyTypes.length > 0 && listing.propertyType) {
    const matchesType = filter.propertyTypes.some(
      (type) => type.toLowerCase() === listing.propertyType!.toLowerCase()
    );
    if (!matchesType) return false;
  }

  return true;
}

export function findMatchingFilters(listing: Listing, filters: FilterCriteria[]): FilterCriteria[] {
  return filters.filter((f) => matchesFilter(listing, f));
}
