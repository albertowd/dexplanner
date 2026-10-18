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
} from '../../src/sync/patch.ts';
import type { UserState } from '../../src/store.ts';

const state = (registered: number[], owned: string[] = [], showRetro = false): UserState => ({ v: 1, registered, owned, showRetro });

describe('sync patches', () => {
  it('records additions and removals per entry', () => {
    const patch = diffStates(state([1, 2], ['sv']), state([2, 3], ['sv', 'za'], true));
    expect(patch).toEqual({ registered: { 3: true, 1: false }, owned: { za: true }, showRetro: true });
    expect(patchSize(patch)).toBe(4);
    expect(isEmptyPatch(diffStates(state([1]), state([1])))).toBe(true);
  });

  it('lets later changes win when merging', () => {
    const merged = mergePatches({ registered: { 1: true, 2: true }, owned: {}, showRetro: true }, { registered: { 1: false }, owned: { sv: true } });
    expect(merged).toEqual({ registered: { 1: false, 2: true }, owned: { sv: true }, showRetro: true });
  });

  it('applies a patch and keeps numbers sorted', () => {
    const next = applyPatch(state([5, 1]), { registered: { 3: true, 5: false }, owned: { sv: true }, showRetro: true });
    expect(next).toEqual(state([1, 3], ['sv'], true));
    expect(applyPatch(state([1], ['sv'], true), emptyPatch())).toEqual(state([1], ['sv'], true));
  });

  it('converts to and from the cloud document', () => {
    const doc = toRemote(state([25, 1], ['sv'], true));
    expect(doc).toEqual({ v: 1, registered: { 1: true, 25: true }, owned: { sv: true }, showRetro: true });
    expect(fromRemote(doc)).toEqual(state([1, 25], ['sv'], true));
    expect(fromRemote({ registered: { abc: true, 7: true } })).toEqual(state([7]));
  });

  it('merges two devices without losing anything on first sign-in', () => {
    expect(unionStates(state([1, 2], ['sv']), state([2, 3], ['za'], true))).toEqual(state([1, 2, 3], ['za', 'sv'], true));
  });

  it('compares states ignoring order', () => {
    expect(sameState(state([1, 2], ['a', 'b']), state([2, 1], ['b', 'a']))).toBe(true);
    expect(sameState(state([1]), state([1], [], true))).toBe(false);
  });
});
