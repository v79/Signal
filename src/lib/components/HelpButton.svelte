<script lang="ts">
  let {
    onClick,
    label = 'Open help for this view',
  }: {
    onClick: () => void;
    label?: string;
  } = $props();
</script>

<button class="help-btn" type="button" onclick={onClick} aria-label={label} title={label}>
  ?
</button>

<style>
  .help-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.3rem;
    height: 1.3rem;
    border-radius: 50%;
    background: transparent;
    border: 1px solid var(--help-border);
    color: var(--help);
    font-family: var(--ff-mono);
    font-size: var(--fs-md);
    font-weight: bold;
    line-height: 1;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }

  .help-btn:hover,
  .help-btn:focus-visible {
    background: var(--help-hover-bg);
    border-color: var(--help-hover-border);
    color: var(--help-hover-text);
    outline: none;
  }
</style>
