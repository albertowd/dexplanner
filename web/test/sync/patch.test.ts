import { describe, expect, it } from 'vitest';
import {
  applyPatch,
  diffStates,
  emptyPatch,
  fromRemote,
  isEmptyPatch,
  mergePatches,
  patchSize,
  sameState,
  toRemote,
  unionStates,
  type SyncPatch,
} from '../../src/sync/patch.ts';
import { emptyState, type UserState } from '../../src/store.ts';

const state = (partial: Partial<UserState>): UserState => ({ ...emptyState, ...partial });
const patch = (partial: Partial<SyncPatch>): SyncPatch => ({ ...emptyPatch(), ...partial });

describe('sync patches', () => {
  it('records additions and removals per entry in every set', () => {
    const p = diffStates(
      state({ registered: [1, 2], owned: ['sv'], forms: ['vulpix-alola'] }),
      state({ registered: [2, 3], owned: ['sv', 'za'], showRetro: true, shiny: [25], shinyForms: ['unown-b'] }),
    );
    expect(p).toEqual(
      patch({
        registered: { 3: true, 1: false },
        owned: { za: true },
        shiny: { 25: true },
        forms: { 'vulpix-alola': false },
        shinyForms: { 'unown-b': true },
        showRetro: true,
      }),
    );
    expect(patchSize(p)).toBe(7);
    expect(isEmptyPatch(diffStates(state({ registered: [1] }), state({ registered: [1] })))).toBe(true);
  });

  it('lets later changes win when merging', () => {
    const merged = mergePatches(patch({ registered: { 1: true, 2: true }, showRetro: true }), patch({ registered: { 1: false }, owned: { sv: true } }));
    expect(merged).toEqual(patch({ registered: { 1: false, 2: true }, owned: { sv: true }, showRetro: true }));
  });

  it('applies a patch, keeping species ids numeric and sorted', () => {
    const next = applyPatch(
      state({ registered: [5, 1], forms: ['a'] }),
      patch({ registered: { 3: true, 5: false }, owned: { sv: true }, forms: { b: true }, shiny: { 9: true }, showRetro: true }),
    );
    expect(next).toEqual(state({ registered: [1, 3], owned: ['sv'], forms: ['a', 'b'], shiny: [9], showRetro: true }));
    expect(applyPatch(state({ registered: [1] }), emptyPatch())).toEqual(state({ registered: [1] }));
  });

  it('converts to and from the cloud document', () => {
    const local = state({ registered: [25, 1], owned: ['sv'], showRetro: true, shiny: [25], forms: ['vulpix-alola'] });
    const doc = toRemote(local);
    expect(doc).toEqual({
      v: 1,
      showRetro: true,
      registered: { 1: true, 25: true },
      owned: { sv: true },
      shiny: { 25: true },
      forms: { 'vulpix-alola': true },
      shinyForms: {},
    });
    expect(fromRemote(doc)).toEqual(state({ registered: [1, 25], owned: ['sv'], showRetro: true, shiny: [25], forms: ['vulpix-alola'] }));
  });

  it('reads documents written before shiny and forms existed', () => {
    expect(fromRemote({ registered: { abc: true, 7: true } })).toEqual(state({ registered: [7] }));
  });

  it('merges two devices without losing anything on first sign-in', () => {
    expect(unionStates(state({ registered: [1, 2], owned: ['sv'], forms: ['x'] }), state({ registered: [2, 3], owned: ['za'], showRetro: true, shiny: [4] }))).toEqual(
      state({ registered: [1, 2, 3], owned: ['za', 'sv'], showRetro: true, shiny: [4], forms: ['x'] }),
    );
  });

  it('compares states ignoring order', () => {
    expect(sameState(state({ registered: [1, 2], owned: ['a', 'b'] }), state({ registered: [2, 1], owned: ['b', 'a'] }))).toBe(true);
    expect(sameState(state({ registered: [1] }), state({ registered: [1], showRetro: true }))).toBe(false);
    expect(sameState(state({}), state({ shinyForms: ['x'] }))).toBe(false);
  });
});
