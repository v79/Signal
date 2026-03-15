// =============================================================================
// Bloc map layout validity tests
// =============================================================================

import { describe, it, expect } from 'vitest';
import { BLOC_MAPS, BLOC_DEFS } from '../data/loader';

const BLOC_IDS = [...BLOC_DEFS.keys()];

describe('BLOC_MAPS', () => {
  it('has a layout for every bloc', () => {
    for (const blocId of BLOC_IDS) {
      expect(BLOC_MAPS[blocId], `Missing layout for bloc: ${blocId}`).toBeDefined();
    }
  });

  for (const [blocId, layout] of Object.entries(BLOC_MAPS)) {
    describe(`${blocId}`, () => {
      it('has 24–36 tiles', () => {
        expect(layout.length).toBeGreaterThanOrEqual(24);
        expect(layout.length).toBeLessThanOrEqual(36);
      });

      it('has exactly one tile at origin (0,0) of type urban', () => {
        const origins = layout.filter((t) => t.q === 0 && t.r === 0);
        expect(origins).toHaveLength(1);
        expect(origins[0].type).toBe('urban');
      });

      it('has no duplicate coordinates', () => {
        const seen = new Set<string>();
        for (const tile of layout) {
          const key = `${tile.q},${tile.r}`;
          expect(seen.has(key), `Duplicate coord ${key} in ${blocId}`).toBe(false);
          seen.add(key);
        }
      });

      it('uses only valid tile types', () => {
        const valid = new Set([
          'urban',
          'industrial',
          'coastal',
          'highland',
          'forested',
          'arid',
          'agricultural',
        ]);
        for (const tile of layout) {
          expect(valid.has(tile.type), `Invalid tile type '${tile.type}' in ${blocId}`).toBe(true);
        }
      });
    });
  }
});
