<script lang="ts">
  let {
    seed,
    turn,
    onExport,
    onImport,
  }: {
    seed: string;
    turn: number;
    onExport: () => void;
    onImport: (file: File) => Promise<void>;
  } = $props();

  let copied = $state(false);
  let importError = $state<string | null>(null);
  let errorTimer: ReturnType<typeof setTimeout> | null = null;

  function showError(msg: string): void {
    if (errorTimer) clearTimeout(errorTimer);
    importError = msg;
    errorTimer = setTimeout(() => { importError = null; }, 5000);
  }

  function dismissError(): void {
    if (errorTimer) clearTimeout(errorTimer);
    importError = null;
  }

  function copySeed(): void {
    navigator.clipboard.writeText(seed).then(() => {
      copied = true;
      setTimeout(() => { copied = false; }, 1500);
    }).catch(() => {/* ignore */});
  }

  async function handleFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    // Reset so the same file can be re-imported if needed
    input.value = '';
    try {
      await onImport(file);
    } catch (err: unknown) {
      const msg = typeof err === 'string' ? err : (err instanceof Error ? err.message : 'Unknown error loading save file.');
      showError(msg);
    }
  }
</script>

<div class="save-controls">
  <span class="seed-label">SEED</span>
  <button class="seed-value" onclick={copySeed} title="Copy seed to clipboard">
    {seed}
    <span class="copy-hint">{copied ? '✓' : '⧉'}</span>
  </button>

  <span class="divider">│</span>

  <button class="ctrl-btn" onclick={onExport} title="Export save as JSON (Turn {turn})">
    EXPORT
  </button>

  <label class="ctrl-btn" title="Import a save file">
    IMPORT
    <input
      type="file"
      accept=".json,application/json"
      onchange={handleFileChange}
      class="hidden-input"
    />
  </label>
</div>

{#if importError}
  <div class="import-error" role="alert">
    <span class="error-icon">⚠</span>
    <span class="error-text">{importError}</span>
    <button class="error-dismiss" onclick={dismissError} aria-label="Dismiss">✕</button>
  </div>
{/if}

<style>
  .save-controls {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .seed-label {
    color: #5a6878;
    font-size: 0.6rem;
    letter-spacing: 0.08em;
  }

  .seed-value {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: none;
    border: 1px solid #2a3040;
    color: #4a8ab4;
    font-size: 0.62rem;
    font-family: inherit;
    letter-spacing: 0.06em;
    padding: 0.1rem 0.35rem;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .seed-value:hover {
    border-color: #4a8ab4;
  }

  .copy-hint {
    color: #5a6878;
    font-size: 0.55rem;
  }

  .divider {
    color: #2a3040;
  }

  .ctrl-btn {
    background: none;
    border: 1px solid #2a3040;
    color: #8a9aaa;
    font-family: inherit;
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    padding: 0.15rem 0.45rem;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
    display: inline-flex;
    align-items: center;
  }

  .ctrl-btn:hover {
    border-color: #4a8ab4;
    color: #c8d0d8;
  }

  .hidden-input {
    display: none;
  }

  .import-error {
    position: fixed;
    top: 3rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.6rem;
    background: #1a0e0e;
    border: 1px solid #8b3030;
    color: #d08080;
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    padding: 0.55rem 0.85rem;
    z-index: 1000;
    max-width: 36rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
  }

  .error-icon {
    color: #c04040;
    font-size: 0.85rem;
    flex-shrink: 0;
  }

  .error-text {
    flex: 1;
  }

  .error-dismiss {
    background: none;
    border: none;
    color: #6a4040;
    font-size: 0.7rem;
    cursor: pointer;
    padding: 0 0.1rem;
    flex-shrink: 0;
    line-height: 1;
  }

  .error-dismiss:hover {
    color: #d08080;
  }
</style>
