import { describe, expect, it } from 'vitest';
import palette from './palette';

describe('FlowSync palette', () => {
  it('exposes the approved brand colors through the MUI theme contract', () => {
    expect(palette.primary.main).toBe('#6D3B07');
    expect(palette.secondary.main).toBe('#6F4E37');
    expect(palette.warning.main).toBe('#D47E30');
    expect(palette.background.default).toBe('#F5F5DC');
  });
});
