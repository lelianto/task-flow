import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CreateTaskDialog } from './CreateTaskDialog';

describe('CreateTaskDialog', () => {
  it('submits a trimmed title and optional description', async () => {
    const onCreate = vi.fn();
    render(<CreateTaskDialog open busy={false} onClose={vi.fn()} onCreate={onCreate}/>);
    await userEvent.type(screen.getByLabelText('Title'), '  Prepare invoice  ');
    await userEvent.type(screen.getByLabelText(/Description/), 'October billing');
    await userEvent.click(screen.getByRole('button', { name: 'Create task' }));
    expect(onCreate).toHaveBeenCalledWith({ title: 'Prepare invoice', description: 'October billing' });
  });
});
