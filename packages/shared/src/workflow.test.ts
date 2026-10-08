import { describe, expect, it } from 'vitest';
import { canTransition } from './workflow.js';

describe('workflow policy', () => {
  it('allows only one step forward by default', () => {
    expect(canTransition('to_do', 'pending', { allowBackwardTransitions: false, allowStatusSkipping: false })).toBe(true);
    expect(canTransition('to_do', 'in_progress', { allowBackwardTransitions: false, allowStatusSkipping: false })).toBe(false);
    expect(canTransition('pending', 'to_do', { allowBackwardTransitions: false, allowStatusSkipping: false })).toBe(false);
  });

  it('allows one step backward when configured', () => {
    expect(canTransition('in_progress', 'pending', { allowBackwardTransitions: true, allowStatusSkipping: false })).toBe(true);
    expect(canTransition('done', 'pending', { allowBackwardTransitions: true, allowStatusSkipping: false })).toBe(false);
  });

  it('allows forward skips when configured', () => {
    expect(canTransition('to_do', 'done', { allowBackwardTransitions: false, allowStatusSkipping: true })).toBe(true);
    expect(canTransition('done', 'to_do', { allowBackwardTransitions: false, allowStatusSkipping: true })).toBe(false);
  });

  it('allows any different status when both options are enabled', () => {
    expect(canTransition('done', 'to_do', { allowBackwardTransitions: true, allowStatusSkipping: true })).toBe(true);
  });

  it('treats the same status as an allowed idempotent no-op', () => {
    expect(canTransition('pending', 'pending', { allowBackwardTransitions: false, allowStatusSkipping: false })).toBe(true);
  });
});
