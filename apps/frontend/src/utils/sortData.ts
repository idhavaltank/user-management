export type SortOrder = 'asc' | 'desc';
type SortableRecord = Record<string, unknown>;

const descendingComparator = <T extends SortableRecord>(a: T, b: T, orderBy: string): number => {
  const left = String(a[orderBy] ?? '');
  const right = String(b[orderBy] ?? '');
  return right < left ? -1 : right > left ? 1 : 0;
};

export const getComparator =
  <T extends SortableRecord>(order: SortOrder, orderBy: string) =>
  (a: T, b: T): number =>
    order === 'desc' ? descendingComparator(a, b, orderBy) : -descendingComparator(a, b, orderBy);

export const applySortFilter = <T extends { name: string }>(
  array: T[],
  comparator: (a: T, b: T) => number,
  query: string
): T[] => {
  const stabilizedThis: Array<[T, number]> = array.map((el, index) => [el, index]);
  stabilizedThis.sort(([a, aIndex], [b, bIndex]) => {
    const order = comparator(a, b);
    if (order !== 0) return order;
    return aIndex - bIndex;
  });
  if (query) {
    return array.filter((user) => user.name.toLowerCase().includes(query.toLowerCase()));
  }
  return stabilizedThis.map((el) => el[0]);
};
