import { Typography } from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import * as React from 'react';
import Iconify from '../components/iconify/Iconify';

export interface ConfirmationModalProps {
  open: boolean;
  handleClose: (payload: { key: 'confirmationModal'; status?: boolean }) => void;
  handleConfirm: () => void | Promise<void>;
}

const ConfirmationModal = ({ open, handleClose, handleConfirm }: ConfirmationModalProps): JSX.Element => (
  <Dialog open={open} onClose={() => handleClose({ key: 'confirmationModal' })}>
    <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Iconify icon="emojione-v1:warning" width={50} />
      <Typography> Are you sure you want to remove this user?</Typography>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 3 }}>
      <Button variant="outlined" color="primary" autoFocus onClick={() => handleClose({ key: 'confirmationModal' })}>
        Cancel
      </Button>
      <Button variant="contained" color="error" onClick={handleConfirm} autoFocus>
        YES
      </Button>
    </DialogActions>
  </Dialog>
);

export default ConfirmationModal;
