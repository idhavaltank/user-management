import { InputAdornment, OutlinedInput, Toolbar } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import type { ChangeEvent } from 'react';
import Iconify from '../../components/iconify/Iconify';

const StyledRoot = styled(Toolbar)(({ theme }) => ({
  height: 96,
  display: 'flex',
  justifyContent: 'space-between',
  padding: theme.spacing(0, 1, 0, 3),
}));

const StyledSearch = styled(OutlinedInput)(({ theme }) => ({
  width: 240,
  transition: theme.transitions.create(['box-shadow', 'width'], {
    easing: theme.transitions.easing.easeInOut,
    duration: theme.transitions.duration.shorter,
  }),
  '&.Mui-focused': {
    width: 320,
    boxShadow: theme.customShadows.z8,
  },
  '& fieldset': {
    borderWidth: `1px !important`,
    borderColor: `${alpha(theme.palette.grey[500], 0.32)} !important`,
  },
}));

export interface UserListToolbarProps {
  filterName: string;
  onFilterName: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

const UserListToolbar = ({ filterName, onFilterName }: UserListToolbarProps): JSX.Element => (
  <>
    <StyledRoot>
      <StyledSearch
        value={filterName}
        onChange={onFilterName}
        placeholder="Search user..."
        startAdornment={
          <InputAdornment position="start">
            <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled', width: 20, height: 20 }} />
          </InputAdornment>
        }
      />
    </StyledRoot>
  </>
);

export default UserListToolbar;
