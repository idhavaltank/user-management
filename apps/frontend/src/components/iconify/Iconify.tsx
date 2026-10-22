import { Icon } from '@iconify/react';
import { Box, type BoxProps } from '@mui/material';
import { forwardRef, type ComponentProps } from 'react';

export type IconifyValue = ComponentProps<typeof Icon>['icon'];

export interface IconifyProps extends Omit<BoxProps, 'component' | 'width' | 'height'> {
  icon: IconifyValue;
  width?: number | string;
  height?: number | string;
}

const Iconify = forwardRef<HTMLDivElement, IconifyProps>(({ icon, width = 20, height = width, sx, ...other }, ref) => (
  <Box ref={ref} sx={{ width, height, display: 'inline-flex', ...sx }} {...other}>
    <Icon icon={icon} width="100%" height="100%" />
  </Box>
));

Iconify.displayName = 'Iconify';

export default Iconify;
