import { TableRow, TableCell, TableHead, TableSortLabel } from '@mui/material';
import type { MouseEvent } from 'react';

export type SortOrder = 'asc' | 'desc';
export interface UserListHeadCell {
  id: string;
  label: string;
  alignRight?: boolean;
  disabled?: boolean;
}

export interface UserListHeadProps {
  order: SortOrder;
  orderBy: string;
  headLabel: readonly UserListHeadCell[];
  onRequestSort: (event: MouseEvent<HTMLElement>, property: string) => void;
}

export default function UserListHead({ order, orderBy, headLabel, onRequestSort }: UserListHeadProps): JSX.Element {
  const createSortHandler = (property: string) => (event: MouseEvent<HTMLElement>): void => {
    onRequestSort(event, property);
  };

  return (
    <TableHead>
      <TableRow>
        {headLabel.map((headCell) => (
          <TableCell
            key={headCell.id}
            aria-disabled={headCell?.disabled || undefined}
            align={headCell.alignRight ? 'right' : 'left'}
            sortDirection={orderBy === headCell.id ? order : false}
          >
            <TableSortLabel
              hideSortIcon
              active={orderBy === headCell.id}
              direction={orderBy === headCell.id ? order : 'asc'}
              onClick={headCell?.disabled ? undefined : createSortHandler(headCell.id)}
            >
              {headCell.label}
            </TableSortLabel>
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );
}
