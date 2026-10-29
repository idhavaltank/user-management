import { Card, CardContent, Stack, Typography } from '@mui/material';
import type { CrmDeal } from '../../api/clientTypes';

export const DealCard = ({ deal, onDragStart }: { deal: CrmDeal; onDragStart: (deal: CrmDeal) => void }): JSX.Element => (
  <Card
    draggable
    onDragStart={() => onDragStart(deal)}
    sx={{ mb: 1.5, cursor: 'grab', '&:active': { cursor: 'grabbing' } }}
  >
    <CardContent sx={{ '&:last-child': { pb: 2 } }}>
      <Stack spacing={0.5}>
        <Typography fontWeight={700}>{deal.name}</Typography>
        <Typography variant="body2" color="text.secondary">{deal.currency} {deal.amount.toLocaleString()}</Typography>
        <Typography variant="caption" color="text.secondary">{deal.expectedCloseDate || 'No close date'}</Typography>
      </Stack>
    </CardContent>
  </Card>
);
