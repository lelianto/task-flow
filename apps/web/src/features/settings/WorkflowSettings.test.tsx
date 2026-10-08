import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorkflowSettings } from './WorkflowSettings';

describe('WorkflowSettings', () => {
  it('previews locally and only saves on explicit confirmation', async () => {
    const onChange = vi.fn();
    render(<WorkflowSettings settings={{ allowBackwardTransitions: false, allowStatusSkipping: false }} busy={false} onChange={onChange}/>);
    await userEvent.click(screen.getByRole('switch', { name: 'Allow backward transitions' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('In Progress', { selector: '.preview-row span' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onChange).toHaveBeenCalledWith({ allowBackwardTransitions: true, allowStatusSkipping: false });
  });
});
