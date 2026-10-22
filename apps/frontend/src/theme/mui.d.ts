import type { CustomShadows } from './customShadows';

declare module '@mui/material/styles' {
  interface PaletteColor {
    lighter?: string;
    darker?: string;
  }

  interface SimplePaletteColorOptions {
    lighter?: string;
    darker?: string;
  }

  interface Theme {
    customShadows: CustomShadows;
  }

  interface ThemeOptions {
    customShadows?: CustomShadows;
  }

  interface TypeBackground {
    neutral?: string;
  }
}
