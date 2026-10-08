import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorkflowSettings } from './WorkflowSettings';

describe('WorkflowSettings', () => {
  it('requests the toggled workflow value', async () => {
    const onChange = vi.fn();
    render(<WorkflowSettings settings={{ allowBackwardTransitions: false, allowStatusSkipping: false }} busy={false} onChange={onChange}/>);
    await userEvent.click(screen.getByRole('switch', { name: 'Allow backward transitions' }));
    expect(onChange).toHaveBeenCalledWith({ allowBackwardTransitions: true, allowStatusSkipping: false });
  });
});
