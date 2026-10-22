export interface TableHeadCell {
  readonly id: string;
  readonly label: string;
  readonly alignRight?: boolean;
  readonly disabled?: boolean;
}

const TABLE_HEAD: readonly TableHeadCell[] = [
  { id: 'name', label: 'Name', alignRight: false },
  { id: 'email', label: 'Email', alignRight: false },
  { id: 'gender', label: 'gender', alignRight: false },
  { id: 'birthDate', label: 'Birth Date', alignRight: false },
  { id: 'college', label: 'College', alignRight: false },
  { id: 'address', label: 'Address', alignRight: false },
  { id: 'hobbies', label: 'Hobbies', alignRight: false },
  { id: 'action', label: 'Action', alignRight: true, disabled: true },
];
export default TABLE_HEAD;
