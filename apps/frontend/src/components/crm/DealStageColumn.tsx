import { Box, Paper, Stack, Typography } from '@mui/material';
import type { CrmDeal, FlowDealStage } from '../../api/clientTypes';
import { DealCard } from './DealCard';

export const DealStageColumn = ({ stage, deals, onDragStart, onDrop }: { stage: FlowDealStage; deals: CrmDeal[]; onDragStart: (deal: CrmDeal) => void; onDrop: (stage: FlowDealStage) => void }): JSX.Element => (
  <Paper
    component="section"
    aria-label={`${stage} deals`}
    onDragOver={(event) => event.preventDefault()}
    onDrop={() => onDrop(stage)}
    sx={{ p: 2, minWidth: 250, flex: 1, bgcolor: 'rgba(111, 78, 55, 0.06)' }}
  >
    <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
      <Typography fontWeight={700} sx={{ textTransform: 'capitalize' }}>{stage}</Typography>
      <Box component="span" sx={{ color: 'text.secondary' }}>{deals.length}</Box>
    </Stack>
    {deals.map((deal) => <DealCard key={deal.id} deal={deal} onDragStart={onDragStart} />)}
  </Paper>
);
