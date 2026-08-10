import { useEffect, useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import type { Child } from "../types";
import { api } from "../api";
import { COLOR_KEYS, colorOf, initials } from "../lib";
import { Button, Card, EmptyState, Label, Spinner, TextInput } from "../ui";

export default function ParentChildren() {
  const [children, setChildren] = useState<Child[] | null>(null);
  const [adding, setAdding] = useState(false);

  async function load() {
    setChildren(await api.listChildren());
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-bold text-neutral-800">Niños</h1>
        <p className="text-sm text-neutral-500">Agrega a cada hijo y su instrumento.</p>
      </div>

      {children === null ? (
        <Spinner />
      ) : (
        <>
          {children.length === 0 && !adding && (
            <EmptyState title="Todavía no hay ningún niño" hint="Toca “Agregar niño” para empezar." />
          )}
          {children.map((c) => (
            <ChildRow key={c.id} child={c} onChanged={load} />
          ))}
        </>
      )}

      {adding ? (
        <ChildEditor
          onCancel={() => setAdding(false)}
          onSave={async (data) => {
            await api.createChild(data);
            setAdding(false);
            load();
          }}
        />
      ) : (
        <Button className="w-full" onClick={() => setAdding(true)}>
          <Plus size={18} /> Agregar niño
        </Button>
      )}
    </div>
  );
}

function ChildRow({ child, onChanged }: { child: Child; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const color = colorOf(child.color);

  if (editing) {
    return (
      <ChildEditor
        initial={child}
        onCancel={() => setEditing(false)}
        onSave={async (data) => {
          await api.updateChild(child.id, data);
          setEditing(false);
          onChanged();
        }}
      />
    );
  }

  return (
    <Card className="flex items-center gap-3">
      <div className={`grid h-11 w-11 place-items-center rounded-full text-lg font-bold ${color.bg} ${color.text}`}>
        {initials(child.name)}
      </div>
      <button type="button" className="flex-1 text-left" onClick={() => setEditing(true)}>
        <p className="font-semibold text-neutral-800">{child.name}</p>
        <p className="text-sm text-neutral-500">{child.instrument || "Sin instrumento"}</p>
      </button>
      <button
        type="button"
        onClick={async () => {
          if (confirm(`¿Eliminar a ${child.name} y todas sus prácticas?`)) {
            await api.deleteChild(child.id);
            onChanged();
          }
        }}
        className="rounded-full p-2 text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
      >
        <Trash2 size={18} />
      </button>
    </Card>
  );
}

function ChildEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Child;
  onSave: (data: { name: string; instrument: string; color: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [instrument, setInstrument] = useState(initial?.instrument ?? "");
  const [color, setColor] = useState(initial?.color ?? "teal");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), instrument: instrument.trim(), color });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <Label>Nombre</Label>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Sofía" />
      </div>
      <div>
        <Label>Instrumento</Label>
        <TextInput value={instrument} onChange={(e) => setInstrument(e.target.value)} placeholder="Ej. Violín" />
      </div>
      <div>
        <Label>Color</Label>
        <div className="flex gap-2">
          {COLOR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setColor(key)}
              className={`grid h-9 w-9 place-items-center rounded-full ${colorOf(key).dot} ${
                color === key ? "ring-2 ring-neutral-800 ring-offset-2" : ""
              }`}
            >
              {color === key && <Check size={16} className="text-white" />}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      <div className="flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button className="flex-1" onClick={submit} disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </Card>
  );
}
