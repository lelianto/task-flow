import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterDialog } from './FilterDialog';

describe('FilterDialog', () => {
  it('keeps draft changes local until Apply filters is pressed', async () => {
    const onApply = vi.fn();
    render(<FilterDialog value={{ status: '', assignee: '', source: '', dueDate: '' }} onClose={vi.fn()} onApply={onApply}/>);

    await userEvent.click(screen.getByRole('button', { name: 'Filter status' }));
    await userEvent.click(screen.getByRole('option', { name: 'Done' }));
    expect(onApply).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(onApply).toHaveBeenCalledWith({ status: 'done', assignee: '', source: '', dueDate: '' });
  });
});
