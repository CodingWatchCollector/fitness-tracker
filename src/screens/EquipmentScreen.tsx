import { useEffect, useRef, useState, type RefObject } from 'react';
import { useDataStore } from '../app/DataStoreContext';
import { useStoreQuery } from '../app/useStoreQuery';
import {
  EQUIPMENT_NAME_MAX,
  WorkoutStateError,
  isValidEquipmentInput,
  normalizeLabel,
  type EquipmentItem,
  type EquipmentItemInput,
} from '../data';
import { strings } from '../strings';
import { Button } from '../ui/Button';

type FormTarget = { kind: 'add' } | { kind: 'edit'; item: EquipmentItem };

function useModalDialog(open: boolean, focusRef: RefObject<HTMLElement | null>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      focusRef.current?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, focusRef]);
  return dialogRef;
}

function ItemForm({
  target,
  nameRef,
  onSave,
  onCancel,
}: {
  target: FormTarget;
  nameRef: RefObject<HTMLInputElement | null>;
  onSave: (input: EquipmentItemInput) => Promise<void>;
  onCancel: () => void;
}) {
  const initial = target.kind === 'edit' ? target.item : null;
  const [name, setName] = useState(initial?.name ?? '');
  const [kg, setKg] = useState(initial ? String(initial.nominalKg) : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const input = { name: normalizeLabel(name), nominalKg: kg.trim() === '' ? NaN : Number(kg) };
    if (!isValidEquipmentInput(input)) {
      setError(strings.equipment.form.invalid);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(input);
    } catch (e) {
      setSaving(false);
      if (e instanceof WorkoutStateError && e.code === 'duplicate-name') {
        setError(strings.equipment.form.duplicate);
      } else if (e instanceof WorkoutStateError && e.code === 'invalid-value') {
        setError(strings.equipment.form.invalid);
      } else {
        setError(strings.status.error);
      }
    }
  }

  return (
    <form
      className="equipment-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <h2 id="equipment-form-title">
        {target.kind === 'add' ? strings.equipment.form.addTitle : strings.equipment.form.editTitle}
      </h2>
      <label>
        {strings.equipment.form.name}
        <input
          type="text"
          ref={nameRef}
          maxLength={EQUIPMENT_NAME_MAX}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label>
        {strings.equipment.form.kg}
        <input
          type="number"
          inputMode="decimal"
          step="0.5"
          min="0.5"
          max="500"
          value={kg}
          onChange={(event) => setKg(event.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <Button type="submit" className="button primary" disabled={saving}>
        {strings.equipment.form.save}
      </Button>
      <button type="button" className="button secondary" onClick={onCancel}>
        {strings.equipment.form.cancel}
      </button>
    </form>
  );
}

export function EquipmentScreen() {
  const { store } = useDataStore();
  const [revision, setRevision] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- revision only re-runs the read after a write
  const state = useStoreQuery(() => store.equipment.list(), [store, revision]);
  const [form, setForm] = useState<FormTarget | null>(null);
  const [removing, setRemoving] = useState<EquipmentItem | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const rowButtons = useRef(
    new Map<string, { edit: HTMLElement | null; del: HTMLElement | null }>(),
  );
  const returnTo = useRef<(() => HTMLElement | null | undefined) | null>(null);
  const formDialog = useModalDialog(form !== null, nameRef);
  const removeDialog = useModalDialog(removing !== null, keepRef);

  useEffect(() => {
    if (form !== null || removing !== null || !returnTo.current) return;
    returnTo.current()?.focus();
    returnTo.current = null;
  }, [form, removing]);

  const rowButton = (id: string, which: 'edit' | 'del') => () =>
    rowButtons.current.get(id)?.[which];

  const setRowButton = (id: string, which: 'edit' | 'del') => (el: HTMLElement | null) => {
    const entry = rowButtons.current.get(id) ?? { edit: null, del: null };
    entry[which] = el;
    rowButtons.current.set(id, entry);
  };

  function openForm(target: FormTarget) {
    returnTo.current =
      target.kind === 'add' ? () => addRef.current : rowButton(target.item.id, 'edit');
    setForm(target);
  }

  function openRemove(item: EquipmentItem) {
    setRemoveError(false);
    returnTo.current = rowButton(item.id, 'del');
    setRemoving(item);
  }

  async function saveForm(input: EquipmentItemInput) {
    if (form === null) return;
    if (form.kind === 'add') await store.equipment.add(input);
    else await store.equipment.update(form.item.id, input);
    setRevision((n) => n + 1);
    setForm(null);
  }

  async function confirmRemove() {
    if (removing === null || removeBusy) return;
    setRemoveBusy(true);
    setRemoveError(false);
    try {
      await store.equipment.remove(removing.id);
      returnTo.current = () => addRef.current;
      setRevision((n) => n + 1);
      setRemoving(null);
    } catch {
      setRemoveError(true);
    } finally {
      setRemoveBusy(false);
    }
  }

  if (state.kind === 'loading') return <p>{strings.status.loading}</p>;
  if (state.kind === 'error') return <p>{strings.status.error}</p>;

  const items = state.value;

  return (
    <div className="equipment">
      <h2>{strings.equipment.title}</h2>
      {items.length === 0 ? (
        <p>{strings.equipment.empty}</p>
      ) : (
        <ul className="equipment-list" aria-label={strings.equipment.listLabel}>
          {items.map((item) => (
            <li key={item.id} className="equipment-row">
              <span className="equipment-row-text">
                <span>{item.name}</span>
                <span className="equipment-row-meta">
                  {strings.equipment.nominal(item.nominalKg)}
                </span>
              </span>
              <Button
                type="button"
                className="button secondary"
                ref={setRowButton(item.id, 'edit')}
                onClick={() => openForm({ kind: 'edit', item })}
              >
                {strings.equipment.edit(item.name)}
              </Button>
              <Button
                type="button"
                className="button secondary"
                ref={setRowButton(item.id, 'del')}
                onClick={() => openRemove(item)}
              >
                {strings.equipment.delete(item.name)}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        className="button primary"
        ref={addRef}
        onClick={() => openForm({ kind: 'add' })}
      >
        {strings.equipment.add}
      </Button>
      <dialog
        ref={formDialog}
        aria-labelledby="equipment-form-title"
        className="dialog"
        onClose={() => setForm(null)}
      >
        {form && (
          <ItemForm
            key={form.kind === 'edit' ? form.item.id : 'add'}
            target={form}
            nameRef={nameRef}
            onSave={saveForm}
            onCancel={() => setForm(null)}
          />
        )}
      </dialog>
      <dialog
        ref={removeDialog}
        aria-labelledby="equipment-delete-title"
        className="dialog"
        onClose={() => setRemoving(null)}
      >
        {removing && (
          <>
            <h2 id="equipment-delete-title">
              {strings.equipment.deleteDialog.title(removing.name)}
            </h2>
            <p>{strings.equipment.deleteDialog.body}</p>
            {removeError && <p role="alert">{strings.status.error}</p>}
            <Button
              type="button"
              className="button primary"
              disabled={removeBusy}
              onClick={confirmRemove}
            >
              {strings.equipment.deleteDialog.confirm}
            </Button>
            <button
              type="button"
              className="button secondary"
              ref={keepRef}
              onClick={() => setRemoving(null)}
            >
              {strings.equipment.deleteDialog.cancel}
            </button>
          </>
        )}
      </dialog>
    </div>
  );
}
