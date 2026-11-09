"use client";

import { KeyRound } from "lucide-react";
import { useState, useTransition } from "react";
import { removeAssistantApiKey, saveAssistantApiKey } from "@/lib/assistant/actions";
import type { SavedApiKey } from "@/lib/assistant/api-keys";
import { OWN_KEY_PROVIDERS, PROVIDER_INFO, type OwnKeyProvider } from "@/lib/assistant/providers";

export function AccountAiKeys({ available, demo, keys }: { available: boolean; demo: boolean; keys: SavedApiKey[] }) {
  return (
    <section className="account-assistant" id="ai-keys" aria-labelledby="account-ai-keys-title">
      <header className="account-section-head">
        <span className="assistant-mark" aria-hidden="true"><KeyRound size={16} /></span>
        <div>
          <h2 id="account-ai-keys-title">Your AI keys</h2>
          <p>Connect your own account, then pick it in the trip assistant. Your chat and this trip&rsquo;s details go to that provider, and it bills you for what you use.</p>
        </div>
      </header>
      {available ? (
        <ul className="account-keys">
          {OWN_KEY_PROVIDERS.map((provider) => (
            <KeyRow initialHint={keys.find((key) => key.provider === provider)?.hint ?? null} key={provider} provider={provider} />
          ))}
        </ul>
      ) : (
        <p className="account-empty">{demo ? "Adding your own keys needs a live account." : "Adding your own keys isn't set up on this server yet."}</p>
      )}
    </section>
  );
}

function KeyRow({ provider, initialHint }: { provider: OwnKeyProvider; initialHint: string | null }) {
  const { name, company, model, keysUrl, placeholder } = PROVIDER_INFO[provider];
  const [hint, setHint] = useState(initialHint);
  const [editing, setEditing] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const showForm = !hint || editing;
  const inputId = `ai-key-${provider}`;

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const result = await saveAssistantApiKey(provider, value);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setHint(result.key.hint);
        setValue("");
        setEditing(false);
      } catch {
        setError("That key didn't save. Try again.");
      }
    });
  }

  function remove() {
    setError("");
    setConfirmingRemove(false);
    startTransition(async () => {
      try {
        await removeAssistantApiKey(provider);
        setHint(null);
        setEditing(false);
      } catch {
        setError("That key couldn't be removed. Try again.");
      }
    });
  }

  return (
    <li className="account-key">
      <div className="account-key-head">
        <div>
          <strong>{name}</strong>
          <p>{hint ? `Connected, key ending in ${hint}` : `Uses ${model}. `}{hint ? null : <a href={keysUrl} rel="noreferrer" target="_blank">Get a key from {company}</a>}</p>
        </div>
        {hint ? (
          confirmingRemove ? (
            <span className="account-confirm">
              Remove?
              <button className="text-danger" disabled={pending} onClick={remove} type="button">Remove</button>
              <button onClick={() => setConfirmingRemove(false)} type="button">Cancel</button>
            </span>
          ) : (
            <span className="account-key-actions">
              <button className="account-link-button" disabled={pending} onClick={() => { setEditing(!editing); setValue(""); setError(""); }} type="button">{editing ? "Cancel" : "Replace"}</button>
              <button className="account-link-button" disabled={pending} onClick={() => setConfirmingRemove(true)} type="button">Remove</button>
            </span>
          )
        ) : null}
      </div>
      {showForm ? (
        <form className="account-key-form" onSubmit={save}>
          <label className="sr-only" htmlFor={inputId}>{company} API key</label>
          <input
            autoComplete="off"
            id={inputId}
            onChange={(event) => setValue(event.target.value)}
            placeholder={placeholder}
            spellCheck={false}
            type="password"
            value={value}
          />
          <button className="button button-small button-ink" disabled={pending || !value.trim()} type="submit">{pending ? "Checking…" : "Save"}</button>
        </form>
      ) : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </li>
  );
}
