import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { strings } from '../strings';
import { deferred, renderApp, withEquipment } from '../test-utils/render-app';
import { closeFixtures, sec, setup, type Fixture } from '../test-utils/workout-fixtures';

afterEach(closeFixtures);

const dialogNamed = (name: string) => screen.getByRole<HTMLDialogElement>('dialog', { name });
const button = (name: string) => screen.getByRole('button', { name });

async function openAdd(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: strings.equipment.add }));
  return dialogNamed(strings.equipment.form.addTitle);
}

async function fillAndSave(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  name: string | null,
  kg: string,
) {
  if (name !== null) {
    const nameInput = within(dialog).getByRole('textbox', { name: strings.equipment.form.name });
    await user.clear(nameInput);
    await user.type(nameInput, name);
  }
  const kgInput = within(dialog).getByRole('spinbutton', { name: strings.equipment.form.kg });
  await user.clear(kgInput);
  await user.type(kgInput, kg);
  await user.click(within(dialog).getByRole('button', { name: strings.equipment.form.save }));
}

async function withRedBand(): Promise<Fixture> {
  const f = await setup();
  f.clock.set(sec(1));
  await f.store.equipment.add({ name: 'Red band', nominalKg: 15 });
  return f;
}

describe('Equipment screen list, add and edit', () => {
  it('is reached from Home and starts empty', async () => {
    const user = userEvent.setup();
    const f = await setup();
    renderApp(f.store, f.clock, '/');
    const link = await screen.findByRole('link', { name: 'Equipment items' });
    expect(link).toHaveAttribute('href', '/equipment');
    await user.click(link);
    expect(await screen.findByRole('heading', { name: 'Equipment items' })).toBeInTheDocument();
    expect(screen.getByText('No Equipment items yet.')).toBeInTheDocument();
  });

  it('adds an item, closes the dialog and focuses the add button', async () => {
    const user = userEvent.setup();
    const f = await setup();
    renderApp(f.store, f.clock, '/equipment');
    const dialog = await openAdd(user);
    expect(dialog).toHaveAttribute('open');
    await waitFor(() =>
      expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveFocus(),
    );

    await fillAndSave(user, dialog, 'Red band', '15');

    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
    await waitFor(() => expect(button('Add Equipment item')).toHaveFocus());
    const list = await screen.findByRole('list', { name: 'Equipment items' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(1);
    expect(within(rows[0]!).getByText('Red band')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('15 kg')).toBeInTheDocument();
  });

  it('edits an item and focuses its edit button', async () => {
    const user = userEvent.setup();
    const f = await withRedBand();
    renderApp(f.store, f.clock, '/equipment');
    await user.click(await screen.findByRole('button', { name: 'Edit Red band' }));
    const dialog = dialogNamed('Edit Equipment item');
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('Red band');
    expect(within(dialog).getByRole('spinbutton', { name: 'Nominal weight (kg)' })).toHaveValue(15);

    await fillAndSave(user, dialog, null, '20');

    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
    expect(await screen.findByText('20 kg')).toBeInTheDocument();
    await waitFor(() => expect(button('Edit Red band')).toHaveFocus());
  });

  it('shows the invalid and duplicate alerts and keeps the dialog open', async () => {
    const user = userEvent.setup();
    const f = await withRedBand();
    renderApp(f.store, f.clock, '/equipment');
    await user.click(await screen.findByRole('button', { name: 'Edit Red band' }));
    const edit = dialogNamed('Edit Equipment item');

    await fillAndSave(user, edit, null, '0.3');
    expect(within(edit).getByRole('alert')).toHaveTextContent(
      /^Enter a name and a weight from 0.5 to 500 kg in steps of 0.5.$/,
    );
    expect(edit).toHaveAttribute('open');
    expect((await f.dumpAll()).equipmentItems.map((e) => e.nominalKg)).toEqual([15]);

    await user.click(within(edit).getByRole('button', { name: 'Cancel' }));
    await user.click(button('Add Equipment item'));
    const add = dialogNamed('New Equipment item');
    await fillAndSave(user, add, 'red band', '5');
    expect(await within(add).findByRole('alert')).toHaveTextContent(
      /^An Equipment item with this name already exists.$/,
    );
    expect(add).toHaveAttribute('open');
  });

  it('cancels without writing and returns focus to the opener', async () => {
    const user = userEvent.setup();
    const f = await withRedBand();
    renderApp(f.store, f.clock, '/equipment');
    await user.click(await screen.findByRole('button', { name: 'Edit Red band' }));
    const dialog = dialogNamed('Edit Equipment item');
    const before = await f.dumpAll();
    const kg = within(dialog).getByRole('spinbutton', { name: 'Nominal weight (kg)' });
    await user.clear(kg);
    await user.type(kg, '99');

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
    await waitFor(() => expect(button('Edit Red band')).toHaveFocus());
    expect(await f.dumpAll()).toEqual(before);
  });

  it('writes nothing when the dialog is closed directly', async () => {
    const user = userEvent.setup();
    const f = await setup();
    renderApp(f.store, f.clock, '/equipment');
    const dialog = await openAdd(user);
    const before = await f.dumpAll();

    act(() => dialog.close());

    await waitFor(() => expect(button('Add Equipment item')).toHaveFocus());
    expect(await f.dumpAll()).toEqual(before);
  });

  it('disables Save while the add is in flight', async () => {
    const user = userEvent.setup();
    const f = await setup();
    const gate = deferred<void>();
    const store = withEquipment(f.store, {
      add: async (input) => {
        await gate.promise;
        return f.store.equipment.add(input);
      },
    });
    renderApp(store, f.clock, '/equipment');
    const dialog = await openAdd(user);

    await fillAndSave(user, dialog, 'Red band', '15');

    expect(within(dialog).getByRole('button', { name: 'Save' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await act(async () => gate.resolve());
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
  });

  it('shows the error text when the list rejects', async () => {
    const f = await setup();
    const store = withEquipment(f.store, { list: () => Promise.reject(new Error('boom')) });
    renderApp(store, f.clock, '/equipment');
    expect(await screen.findByText(strings.status.error)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Equipment items' })).toBeNull();
  });
});

describe('Equipment screen delete', () => {
  async function twoItems() {
    const f = await withRedBand();
    f.clock.set(sec(2));
    await f.store.equipment.add({ name: 'blue band', nominalKg: 7.5 });
    return f;
  }

  it('keeps the item when the user taps Keep', async () => {
    const user = userEvent.setup();
    const f = await twoItems();
    renderApp(f.store, f.clock, '/equipment');
    await user.click(await screen.findByRole('button', { name: 'Delete Red band' }));
    const dialog = dialogNamed('Delete Red band?');
    expect(within(dialog).getByText('Sets that used it keep it.')).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Keep' })).toHaveFocus());
    const before = await f.dumpAll();

    await user.click(within(dialog).getByRole('button', { name: 'Keep' }));

    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
    await waitFor(() => expect(button('Delete Red band')).toHaveFocus());
    expect(await f.dumpAll()).toEqual(before);
  });

  it('keeps the item when the dialog is closed directly', async () => {
    const user = userEvent.setup();
    const f = await twoItems();
    renderApp(f.store, f.clock, '/equipment');
    await user.click(await screen.findByRole('button', { name: 'Delete Red band' }));
    const dialog = dialogNamed('Delete Red band?');
    const before = await f.dumpAll();

    act(() => dialog.close());

    await waitFor(() => expect(button('Delete Red band')).toHaveFocus());
    expect(await f.dumpAll()).toEqual(before);
  });

  it('deletes the item and focuses the add button', async () => {
    const user = userEvent.setup();
    const f = await twoItems();
    renderApp(f.store, f.clock, '/equipment');
    await user.click(await screen.findByRole('button', { name: 'Delete Red band' }));
    const dialog = dialogNamed('Delete Red band?');
    f.clock.set(sec(9));

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
    await waitFor(() => expect(screen.queryByText('Red band')).toBeNull());
    await waitFor(() => expect(button('Add Equipment item')).toHaveFocus());
    const red = (await f.dumpAll()).equipmentItems.find((e) => e.name === 'Red band')!;
    expect(red.deletedAt).toBe(sec(9));
    expect(screen.getByText('blue band')).toBeInTheDocument();
  });

  it('disables Delete while the removal is in flight', async () => {
    const user = userEvent.setup();
    const f = await twoItems();
    const gate = deferred<void>();
    const redId = (await f.store.equipment.list()).find((e) => e.name === 'Red band')!.id;
    const store = withEquipment(f.store, {
      remove: async (id) => {
        await gate.promise;
        return f.store.equipment.remove(id);
      },
    });
    renderApp(store, f.clock, '/equipment');
    await user.click(await screen.findByRole('button', { name: 'Delete Red band' }));
    const dialog = dialogNamed('Delete Red band?');

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(within(dialog).getByRole('button', { name: 'Delete' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await act(async () => gate.resolve());
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
    expect((await f.equipmentItems.get(redId))?.deletedAt).toBe(f.clock.now());
  });

  it('shows an error and keeps the dialog open when the removal fails', async () => {
    const user = userEvent.setup();
    const f = await twoItems();
    const store = withEquipment(f.store, {
      remove: () => Promise.reject(new Error('storage failed')),
    });
    renderApp(store, f.clock, '/equipment');
    await user.click(await screen.findByRole('button', { name: 'Delete Red band' }));
    const dialog = dialogNamed('Delete Red band?');

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(strings.status.error);
    expect(dialog).toHaveAttribute('open');
    expect(within(dialog).getByRole('button', { name: 'Delete' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
