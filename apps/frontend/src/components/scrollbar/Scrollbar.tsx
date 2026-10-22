import { Box, type SxProps, type Theme } from '@mui/material';
import type { ReactNode } from 'react';
import { StyledRootScrollbar, StyledScrollbar } from './styles';

export interface ScrollbarProps {
  children?: ReactNode;
  sx?: SxProps<Theme>;
}

function Scrollbar({ children, sx }: ScrollbarProps): JSX.Element {
  const userAgent = typeof navigator === 'undefined' ? 'SSR' : navigator.userAgent;

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  if (isMobile) {
    return (
      <Box sx={{ overflowX: 'auto', ...sx }}>
        {children}
      </Box>
    );
  }

  return (
    <StyledRootScrollbar>
      <StyledScrollbar clickOnTrack={false} sx={sx}>
        {children}
      </StyledScrollbar>
    </StyledRootScrollbar>
  );
}

export default Scrollbar;
