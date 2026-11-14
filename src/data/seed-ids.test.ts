// @vitest-environment node
import { expect, it } from 'vitest';
import { openDataStore } from './index';

const GOLDEN: Record<string, string> = {
  'Push-up': '877ec463-3998-4ea3-87a5-abb0ae6332d7',
  'Pull-up': '78067a12-eccb-4e83-a8b5-4e50b343b7a7',
  'Dips': 'fc2aede7-3a47-4573-a479-e7a057635a47',
  'Straight leg pull-up (L-sit pull-up)': '23b41154-8c8f-4cb7-97c1-f8a14f1f4619',
  'Back lever': '5e0e66b0-247b-40b9-bd77-2c14d9e75dd2',
  'Pike push-up': '1092bec5-2af4-4974-9683-218bf4b36fec',
  'Pike push-up (elbows out)': '0f1d2ea0-e8f8-45c3-a2d9-7433df94a837',
  'Calf raises': '68f39101-618f-4659-89e9-fa3163d9aca0',
  'Pistol squat': '92b8e7b4-a872-43f4-b600-359431363d69',
  'Ring rows': '00e72375-c5cc-46b8-9158-6bf6cbfcf2a4',
  'L-sit compression': '1e6b628f-8849-432c-a063-ed6c30038773',
  'Squat': '4dde6600-1ad9-4c92-9d6b-bc98673a3849',
  'RTO hold': '460566d2-66a1-41a1-ad18-ba7d04b1be99',
  'Full body warm-up': '6ac00890-dd69-43c4-aec1-771ed1d29104',
  'Face pull': '59905cb2-e11f-40d3-9f54-15224ee9ab25',
};

it('keeps the seeded ids stable', async () => {
  const store = openDataStore({ name: crypto.randomUUID() });
  await store.ensureSeeded();
  const actual = Object.fromEntries((await store.exercises.list()).map((e) => [e.name, e.id]));
  store.close();
  expect(actual).toEqual(GOLDEN);
});
