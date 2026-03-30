import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, usePaginatedQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useSettingsStore } from '@/stores/useSettingsStore';
import {
  defaultFilters,
  computeFromDate,
  type FilterState,
} from '@/lib/filters';
import type { ResolvedBill } from '@/lib/filters';

export function useBillFilters(userId: string | undefined) {
  const { country: userCountry } = useSettingsStore();

  const [activeFilters, setActiveFilters] = useState<FilterState>(
    () => defaultFilters(userCountry),
  );
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);

  // Sync country default when user changes it in settings
  const prevCountry = useRef(userCountry);
  useEffect(() => {
    if (prevCountry.current !== userCountry) {
      setActiveFilters((f) => ({ ...f, country: userCountry }));
      prevCountry.current = userCountry;
    }
  }, [userCountry]);

  // Compute fromDate from preset
  const fromDate = useMemo(
    () => computeFromDate(activeFilters.datePreset, activeFilters.fromDate),
    [activeFilters.datePreset, activeFilters.fromDate],
  );

  // Filter options (state counts + contacts list)
  const filterOptions = useQuery(
    api.bills.billFilterOptions,
    userId ? { userId } : 'skip',
  );

  // Build query args for the paginated list
  const queryArgs = useMemo(() => {
    if (!userId) return 'skip' as const;
    return {
      userId,
      ...(activeFilters.state !== 'all' ? { state: activeFilters.state } : {}),
      ...(activeFilters.minAmount != null ? { minAmount: activeFilters.minAmount } : {}),
      ...(activeFilters.maxAmount != null ? { maxAmount: activeFilters.maxAmount } : {}),
      ...(activeFilters.country ? { country: activeFilters.country } : {}),
      ...(fromDate ? { fromDate } : {}),
      ...(activeFilters.toDate ? { toDate: activeFilters.toDate } : {}),
    };
  }, [userId, activeFilters, fromDate]);

  const {
    results: rawBills,
    status: paginationStatus,
    loadMore,
  } = usePaginatedQuery(api.bills.list, queryArgs, { initialNumItems: 20 });

  // Client-side contact filter (Convex can't filter nested arrays).
  // Type assertion needed: the list query joins contact data at runtime,
  // adding name/phone/imageUri fields not present in generated Convex types.
  const bills: ResolvedBill[] = useMemo(() => {
    const all = (rawBills ?? []) as ResolvedBill[];
    if (activeFilters.contactIds.length === 0) return all;
    const ids = new Set(activeFilters.contactIds.map(String));
    return all.filter((b) =>
      b.contacts.some((c) => ids.has(String(c.contactId))),
    );
  }, [rawBills, activeFilters.contactIds]);

  // Count active advanced filters (excludes state — shown inline)
  const defaults = defaultFilters(userCountry);
  const activeAdvancedFilterCount = [
    activeFilters.contactIds.length > 0,
    activeFilters.minAmount != null || activeFilters.maxAmount != null,
    activeFilters.country !== defaults.country,
    activeFilters.datePreset !== defaults.datePreset,
  ].filter(Boolean).length;

  return {
    activeFilters,
    setActiveFilters,
    filterSheetVisible,
    setFilterSheetVisible,
    filterOptions,
    bills,
    paginationStatus,
    loadMore,
    activeAdvancedFilterCount,
    userCountry,
  };
}
