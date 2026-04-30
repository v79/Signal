<script lang="ts">
  import type { HelpTopic } from '../../data/helpTopics';

  let {
    topic,
    onClose,
  }: {
    topic: HelpTopic;
    onClose: () => void;
  } = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' || e.key === 'Enter') {
      e.stopPropagation();
      onClose();
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="backdrop"
  role="dialog"
  aria-modal="true"
  aria-label={topic.title}
  onclick={handleBackdropClick}
  onkeydown={(e) => { if (e.key === 'Escape') onClose(); }}
  tabindex="-1"
>
  <div class="modal">
    <div class="modal-header">
      <span class="modal-label">HELP</span>
      <h2 class="modal-title">{topic.title}</h2>
      <button class="close-btn" type="button" onclick={onClose}>CLOSE</button>
    </div>

    <div class="modal-body">
      {#each topic.body as paragraph}
        <p class="help-paragraph">{paragraph}</p>
      {/each}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(2px);
  }

  .modal {
    width: 70vw;
    max-width: 720px;
    max-height: 80vh;
    background: var(--surface-1);
    border: 1px solid #2a6090;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 0 40px rgba(42, 96, 144, 0.25), 0 0 80px rgba(0, 0, 0, 0.6);
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.8rem 1.2rem;
    background: var(--surface-0);
    border-bottom: 1px solid var(--border-panel);
    flex-shrink: 0;
  }

  .modal-label {
    font-family: var(--ff-mono);
    font-size: var(--fs-xs);
    letter-spacing: 0.25em;
    color: #2a6090;
    border: 1px solid #2a6090;
    padding: 0.15rem 0.4rem;
    flex-shrink: 0;
  }

  .modal-title {
    font-family: var(--ff-mono);
    font-size: var(--fs-lg);
    letter-spacing: 0.12em;
    color: #c8dce8;
    font-weight: normal;
    margin: 0;
    flex: 1;
    text-transform: uppercase;
  }

  .close-btn {
    background: none;
    border: 1px solid var(--border-panel);
    color: #4a6070;
    font-family: var(--ff-mono);
    font-size: var(--fs-xs);
    letter-spacing: 0.2em;
    padding: 0.2rem 0.6rem;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    flex-shrink: 0;
  }

  .close-btn:hover {
    color: var(--text-accent);
    border-color: #4a6070;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.6rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .help-paragraph {
    font-family: var(--ff-mono);
    font-size: 0.85rem;
    line-height: 1.7;
    color: #a8c4d8;
    margin: 0;
    max-width: 68ch;
  }
</style>
