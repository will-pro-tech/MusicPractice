import { useState } from "react";
import { X, KeyRound, Check } from "lucide-react";
import { api, APP_CODE_KEY } from "./api";
import type { AuthStatus } from "./types";
import { Button, Label, TextInput } from "./ui";

/** Parent-only sheet to change the app code and set/change the parent code. */
export function AccessSettings({
  status,
  onClose,
  onChanged,
}: {
  status: AuthStatus;
  onClose: () => void;
  onChanged: (s: AuthStatus) => void;
}) {
  const [currentCode, setCurrentCode] = useState("");
  const [newAppCode, setNewAppCode] = useState("");
  const [parentCode, setParentCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!newAppCode && !parentCode) {
      return setError("Enter a new app code or a parent code.");
    }
    if (!currentCode) return setError("Enter the current access code to confirm.");
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await api.setupCodes({
        currentCode,
        appCode: newAppCode || undefined,
        parentCode: parentCode || undefined,
      });
      if (newAppCode) localStorage.setItem(APP_CODE_KEY, newAppCode);
      onChanged(next);
      setSaved(true);
      setNewAppCode("");
      setParentCode("");
      setCurrentCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-neutral-50 sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-neutral-800">
            <KeyRound size={18} className="text-teal-600" /> Access codes
          </h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-200">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-sm text-neutral-500">
            The <b>app code</b> is required to open the app. The optional{" "}
            <b>parent code</b> protects the Parents section from the kids.
            {status.parentCodeSet ? " A parent code is currently set." : " No parent code is set yet."}
          </p>

          <div>
            <Label>Current app code</Label>
            <TextInput
              type="password"
              placeholder="Enter to confirm changes"
              value={currentCode}
              onChange={(e) => setCurrentCode(e.target.value)}
            />
          </div>

          <div className="rounded-2xl bg-white p-3 ring-1 ring-black/5">
            <Label>New app code (optional)</Label>
            <TextInput
              type="password"
              placeholder="Leave blank to keep it"
              value={newAppCode}
              onChange={(e) => setNewAppCode(e.target.value)}
            />
          </div>

          <div className="rounded-2xl bg-white p-3 ring-1 ring-black/5">
            <Label>{status.parentCodeSet ? "New parent code (optional)" : "Set a parent code (optional)"}</Label>
            <TextInput
              type="password"
              placeholder="Leave blank to keep it"
              value={parentCode}
              onChange={(e) => setParentCode(e.target.value)}
            />
          </div>

          {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
          {saved && (
            <p className="flex items-center gap-1 text-sm font-medium text-teal-700">
              <Check size={15} /> Saved
            </p>
          )}

          <div className="flex gap-3 pb-2">
            <Button variant="ghost" className="flex-1" onClick={onClose}>
              Close
            </Button>
            <Button className="flex-1" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Small modal asking for the parent code before entering the Parents side. */
export function ParentCodePrompt({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!code) return;
    setBusy(true);
    setError(null);
    try {
      const { ok } = await api.verifyCode(code, "parent");
      if (ok) onSuccess();
      else {
        setError("Wrong parent code.");
        setBusy(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't verify");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-sm rounded-3xl bg-neutral-50 p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-neutral-800">
          <KeyRound size={18} className="text-teal-600" /> Parents
        </h2>
        <p className="mt-1 text-sm text-neutral-500">Enter the parent code to continue.</p>
        <div className="mt-4 space-y-3">
          <TextInput
            type="password"
            autoFocus
            placeholder="Parent code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={submit} disabled={busy}>
              {busy ? "Checking…" : "Unlock"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
