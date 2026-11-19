<!-- Fixed overlay: crosses the screen in 3 s at the start of every 60 s cycle. -->
<div class="eval-ticker" aria-hidden="true">
  <span class="eval-ticker-text">Please do evaluations</span>
</div>

<style>
  .eval-ticker {
    position: fixed;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 100vw;
    height: 15vh;
    overflow: hidden;
    display: flex;
    align-items: center;
    pointer-events: none;
    z-index: 2147483647;
  }
  .eval-ticker-text {
    flex: none;
    white-space: nowrap;
    font-family: 'Roboto Mono', monospace;
    font-weight: 700;
    font-size: 9vh;
    line-height: 1.2;
    color: var(--hi);
    background: var(--bg);
    transform: translateX(-100%);
    /* 5% of 60 s = 3 s of motion, then idle until the next cycle. */
    animation: eval-ticker-scroll 60s linear infinite;
  }
  @keyframes eval-ticker-scroll {
    0%   { transform: translateX(100vw); }
    5%   { transform: translateX(-100%); }
    100% { transform: translateX(-100%); }
  }
</style>
