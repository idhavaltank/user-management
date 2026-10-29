import { Chip, Divider, Stack, Typography } from '@mui/material';
import type { CrmActivity } from '../../api/clientTypes';

interface ActivityTimelineProps {
  activities: CrmActivity[];
}

/** Compact, reusable timeline for record detail pages. */
const ActivityTimeline = ({ activities }: ActivityTimelineProps): JSX.Element => (
  <Stack spacing={1.5} divider={<Divider flexItem />}>
    {activities.length === 0 ? (
      <Typography color="text.secondary">No activity has been recorded for this record.</Typography>
    ) : activities.map((activity) => (
      <Stack key={activity.id} direction="row" spacing={1.5} alignItems="flex-start">
        <Chip size="small" label={activity.kind} color={activity.status === 'completed' ? 'success' : 'default'} />
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          <Typography fontWeight={700}>{activity.subject}</Typography>
          <Typography variant="body2" color="text.secondary">{activity.description || 'No description'}</Typography>
          <Typography variant="caption" color="text.secondary">
            {activity.dueAt ? new Date(activity.dueAt).toLocaleString() : 'No due date'}
          </Typography>
        </Stack>
      </Stack>
    ))}
  </Stack>
);

export default ActivityTimeline;
