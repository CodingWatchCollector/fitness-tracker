import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../App';
import { DataStoreProvider } from '../app/DataStoreContext';
import { openDataStore, type DataStore, type Exercise } from '../data';
import { strings } from '../strings';
import { rawExercises } from '../test-utils/raw-idb';

const T = 1_700_000_000_000;
const ORDER = [
  'Back lever',
  'Calf raises',
  'Dips',
  'Face pull',
  'Full body warm-up',
  'L-sit compression',
  'Pike push-up',
  'Pike push-up (elbows out)',
  'Pistol squat',
  'Pull-up',
  'Push-up',
  'Ring rows',
  'RTO hold',
  'Squat',
  'Straight leg pull-up (L-sit pull-up)',
];
const L = strings.labels;

const stores: DataStore[] = [];
afterEach(() => {
  for (const s of stores.splice(0)) s.close();
});

async function seeded() {
  const name = crypto.randomUUID();
  const store = openDataStore({ name, now: () => T });
  stores.push(store);
  await store.ensureSeeded();
  const byName = new Map((await store.exercises.list()).map((e) => [e.name, e]));
  const id = (exerciseName: string) => byName.get(exerciseName)!.id;
  const renderAt = (to: string) =>
    render(
      <MemoryRouter initialEntries={[to]}>
        <DataStoreProvider store={store}>
          <AppRoutes />
        </DataStoreProvider>
      </MemoryRouter>,
    );
  return { name, id, byName, renderAt };
}

describe('exercise list', () => {
  it('shows the header and the 15 Exercises in order', async () => {
    const { renderAt } = await seeded();
    renderAt('/exercises');
    expect(await screen.findByRole('heading', { name: strings.appName })).toBeInTheDocument();

    const list = await screen.findByRole('list', { name: strings.exerciseList.title });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(15);
    ORDER.forEach((name, i) => {
      expect(within(items[i]!).getByRole('link')).toHaveTextContent(name);
    });

    const link = within(items[ORDER.indexOf('Push-up')]!).getByRole('link');
    expect(link).toHaveTextContent(L.exerciseType.rep);
    expect(link).toHaveTextContent(L.pattern.push);
    const img = link.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/exercise-images/Pushups/0.jpg');
    expect(img).toHaveAttribute('alt', '');
  });
});

describe('exercise detail', () => {
  it('opens Push-up from the list and goes back', async () => {
    const user = userEvent.setup();
    const { renderAt } = await seeded();
    renderAt('/exercises');
    await user.click(await screen.findByRole('link', { name: /Push-up/ }));

    expect(await screen.findByRole('heading', { name: 'Push-up' })).toBeInTheDocument();
    const detail = screen.getByRole('main');
    expect(within(detail).getByText(L.exerciseType.rep)).toBeInTheDocument();
    expect(within(detail).getByText(L.pattern.push)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Push-up start position' }).getAttribute('src')).toBe(
      '/exercise-images/Pushups/0.jpg',
    );
    expect(screen.getByRole('img', { name: 'Push-up end position' }).getAttribute('src')).toBe(
      '/exercise-images/Pushups/1.jpg',
    );
    expect(within(detail).getByText(L.apparatus.floor)).toBeInTheDocument();
    expect(within(detail).getByText(L.muscle.chest)).toBeInTheDocument();
    expect(
      within(detail).getByText(`${L.muscle['front delts']}, ${L.muscle.triceps}`),
    ).toBeInTheDocument();
    expect(within(detail).getByText(L.phase.main)).toBeInTheDocument();
    expect(within(detail).getByText(strings.seconds(90))).toBeInTheDocument();
    expect(within(detail).getByText(strings.seconds(3))).toBeInTheDocument();
    expect(within(detail).getByText(strings.seconds(0))).toBeInTheDocument();
    expect(within(detail).getByText(L.loadDirection.harder)).toBeInTheDocument();
    expect(within(detail).getByText(/Lower the chest/)).toBeInTheDocument();
    expect(within(detail).queryByRole('link', { name: strings.exerciseDetail.video })).toBeNull();
    expect(within(detail).queryByText(strings.exerciseDetail.unilateral)).toBeNull();

    await user.click(screen.getByRole('link', { name: strings.back }));
    expect(
      await screen.findByRole('list', { name: strings.exerciseList.title }),
    ).toBeInTheDocument();
  });

  it('shows placeholders and both apparatus for an Exercise without photos', async () => {
    const { renderAt, id } = await seeded();
    renderAt(`/exercises/${id('Back lever')}`);

    expect(await screen.findAllByRole('img', { name: 'Back lever (no photo)' })).toHaveLength(2);
    expect(screen.getByText(`${L.apparatus.rings}, ${L.apparatus.bar}`)).toBeInTheDocument();
  });

  it('shows the unilateral note for Pistol squat', async () => {
    const { renderAt, id } = await seeded();
    renderAt(`/exercises/${id('Pistol squat')}`);

    expect(await screen.findByText(strings.exerciseDetail.unilateral)).toBeInTheDocument();
  });

  it('links to the video when the Exercise has one', async () => {
    const { renderAt, name, byName } = await seeded();
    const withVideo: Exercise = {
      ...byName.get('Dips')!,
      id: crypto.randomUUID(),
      name: 'Video Dips',
      videoUrl: 'https://example.com/dips',
    };
    await rawExercises.put(name, withVideo);
    renderAt(`/exercises/${withVideo.id}`);

    const link = await screen.findByRole('link', { name: strings.exerciseDetail.video });
    expect(link).toHaveAttribute('href', 'https://example.com/dips');
  });

  it('shows not-found for an unknown id', async () => {
    const { renderAt } = await seeded();
    renderAt('/exercises/unknown-id');

    expect(await screen.findByText(strings.exerciseDetail.notFound)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: strings.back })).toHaveAttribute('href', '/exercises');
  });

  it('shows not-found for a soft-deleted Exercise', async () => {
    const { renderAt, id, byName, name } = await seeded();
    await rawExercises.put(name, { ...byName.get('Squat')!, deletedAt: T, updatedAt: T });
    renderAt(`/exercises/${id('Squat')}`);

    expect(await screen.findByText(strings.exerciseDetail.notFound)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: strings.back })).toHaveAttribute('href', '/exercises');
  });
});
