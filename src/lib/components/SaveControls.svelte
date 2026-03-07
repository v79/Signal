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
    onImport: (file: File) => void;
  } = $props();

  let copied = $state(false);

  function copySeed(): void {
    navigator.clipboard.writeText(seed).then(() => {
      copied = true;
      setTimeout(() => { copied = false; }, 1500);
    }).catch(() => {/* ignore */});
  }

  function handleFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      onImport(file);
      // Reset so the same file can be re-imported if needed
      input.value = '';
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
</style>
