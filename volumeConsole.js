// the volume "terminal": prints the volume breakdown as if a console were
// typing it, and plays a signal-lost sequence when the dimensions change
// after a run. main.js supplies the numbers through readout() / dimensions()

const glitchChars = "░▒▓#%&*/\\<>?";
const leaderWidth = 14; // label + dots, so values line up
const lostLeaderWidth = 20;

class Cancelled extends Error {}

function randomItem(text) {
  return text[Math.floor(Math.random() * text.length)];
}

function format(value) {
  return value.toFixed(2);
}

export function createVolumeConsole({
  root,
  output,
  status,
  button,
  closeButton,
  backdrop,
  docked,
  readout,
  dimensions,
  reducedMotion,
}) {
  // idle | printing | done | aborting | lost
  let state = "idle";
  let token = { cancelled: true };
  let lastRun = null; // dimensions of the last calculation

  const cursor = document.createElement("span");
  cursor.className = "console-cursor";

  function instant() {
    return reducedMotion.matches;
  }

  function setState(next) {
    state = next;
    root.dataset.state = next;
    button.dataset.state = next;
  }

  // --- printing primitives; every wait checks for cancellation ---

  function check(run) {
    if (run.cancelled) throw new Cancelled();
  }

  async function wait(run, ms) {
    if (!instant()) await new Promise((resolve) => setTimeout(resolve, ms));
    check(run);
  }

  async function nextFrame(run) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    check(run);
  }

  function scroll() {
    output.scrollTop = output.scrollHeight;
  }

  function line(className = "") {
    const element = document.createElement("div");
    element.className = `console-line ${className}`;
    output.append(element);
    element.append(cursor);
    scroll();
    return element;
  }

  function span(parent, className = "") {
    const element = document.createElement("span");
    element.className = className;
    // keep the cursor riding the end of the line
    if (cursor.parentElement === parent) cursor.before(element);
    else parent.append(element);
    return element;
  }

  // types text into target; glitch (0..1) adds flickering wrong characters
  // and a stuttering pace, for the signal-lost sequence
  async function type(run, target, text, { speed = 7, glitch = 0 } = {}) {
    if (instant()) {
      target.textContent += text;
      check(run);
      return;
    }
    for (const char of text) {
      if (glitch && char !== " " && Math.random() < glitch * 0.35) {
        target.textContent += randomItem(glitchChars);
        await wait(run, 30 + Math.random() * 60);
        target.textContent = target.textContent.slice(0, -1);
      }
      target.textContent += char;
      scroll();
      let delay = speed * (0.6 + Math.random() * 0.8);
      if (glitch) {
        delay *= 1 + glitch * Math.random() * 3;
        if (Math.random() < glitch * 0.08) delay += 120 + Math.random() * 200;
      }
      await wait(run, delay);
    }
  }

  // "label ......" with the dots filling in, then a space before the value
  async function leader(run, parent, label, width, options = {}) {
    const target = span(parent, "c-label");
    await type(run, target, `${label} `, options);
    const dots = ".".repeat(Math.max(1, width - label.length - 1));
    await type(run, target, `${dots} `, { ...options, speed: 16 });
  }

  // counts a number up to its final value
  async function rollUp(run, target, value, { prefix = "", suffix = "" } = {}) {
    const show = (v) => (target.textContent = `${prefix}${format(v)}${suffix}`);
    if (instant()) {
      show(value);
      check(run);
      return;
    }
    const duration = 450 + Math.random() * 200;
    const start = performance.now();
    for (;;) {
      const t = Math.min(1, (performance.now() - start) / duration);
      show(value * (1 - (1 - t) ** 3));
      scroll();
      if (t === 1) break;
      await nextFrame(run);
    }
  }

  function bar(cells, filled, partial = 0) {
    return `[${"█".repeat(filled)}${"▒".repeat(partial)}${"░".repeat(cells - filled - partial)}]`;
  }

  // --- scripts ---

  async function prompt(run, command, options) {
    const row = line("c-command");
    span(row, "c-prompt").textContent = "> ";
    await type(run, span(row), command, { speed: 38, ...options });
    await wait(run, 220);
    return row;
  }

  async function calculate(run) {
    const r = readout();
    lastRun = dimensions();

    await prompt(run, "volumetrics --segment");

    // scan progress bar filling up before OK
    let row = line();
    await type(run, span(row, "c-label"), "  initializing ");
    const progress = span(row, "c-dim");
    const cells = 10;
    for (let filled = 0; filled <= cells; filled++) {
      progress.textContent = `${bar(cells, filled)} ${filled * 10}%`;
      await wait(run, 50 + Math.random() * 90);
    }
    await wait(run, 260);
    await type(run, span(row, "c-ok"), "  OK");
    await wait(run, 200);

    const d = r.dimensions;
    row = line();
    await leader(run, row, "  segment", leaderWidth + 2);
    await type(
      run,
      span(row),
      `L ${d.length} ft · Ø ${d.bottom} → ${d.top} in`,
    );

    row = line();
    await leader(run, row, "  flaws", leaderWidth + 2);
    await type(
      run,
      span(row, "c-flaw"),
      r.flawsDetected ? "2 confirmed" : "2 found by volume scan",
    );
    await wait(run, 150);

    row = line();
    await leader(run, row, "  gross", leaderWidth + 2);
    await rollUp(run, span(row), r.gross, { suffix: " ft³" });

    for (const [label, volume] of [
      ["  flaw[B]", r.bottomFlaw],
      ["  flaw[T]", r.topFlaw],
    ]) {
      row = line("c-flaw");
      await leader(run, row, label, leaderWidth + 2);
      await rollUp(run, span(row), volume, { prefix: "-", suffix: " ft³" });
    }

    row = line("c-dim");
    await type(run, span(row), `  ${"─".repeat(30)}`, { speed: 3 });
    await wait(run, 420);

    row = line("c-net");
    await leader(run, row, "  NET", leaderWidth + 2);
    await rollUp(run, span(row), r.net, { suffix: " ft³" });
    const sound = (r.net / r.gross) * 100;
    await type(run, span(row, "c-dim"), ` (${sound.toFixed(1)}% sound)`);

    await wait(run, 200);
    row = line("c-command");
    span(row, "c-prompt").textContent = "> ";

    status.textContent =
      `Net volume ${format(r.net)} cubic feet, ${sound.toFixed(1)}% sound. ` +
      `Gross ${format(r.gross)} cubic feet minus ` +
      `${format(r.bottomFlaw + r.topFlaw)} cubic feet of flaws.`;
  }

  // what changed since the last run, one entry per dimension
  function changes() {
    const now = dimensions();
    const list = [];
    if (lastRun.length !== now.length) {
      list.push(`L ${lastRun.length} → ${now.length} ft`);
    }
    if (lastRun.bottom !== now.bottom) {
      list.push(`base Ø ${lastRun.bottom} → ${now.bottom} in`);
    }
    if (lastRun.top !== now.top) {
      list.push(`top Ø ${lastRun.top} → ${now.top} in`);
    }
    return list.length ? list : ["geometry drift"];
  }

  async function loseSignal(run) {
    const lost = { speed: 9 };
    // the anomaly takes over the finished readout's empty prompt line
    const last = output.lastElementChild;
    if (last && last.textContent === "> ") last.remove();

    let row = line("c-flaw");
    span(row, "c-prompt").textContent = "> ";
    await type(run, span(row), "⚠ ANOMALY: geometry shifted mid-scan", {
      ...lost,
      speed: 14,
      glitch: 0.1,
    });
    await wait(run, 300);

    const [first, ...rest] = changes();
    row = line("c-flaw");
    await leader(run, row, "  changes detected", lostLeaderWidth + 2, {
      glitch: 0.15,
    });
    await type(run, span(row), first, { ...lost, glitch: 0.15 });
    for (const change of rest) {
      row = line("c-flaw");
      await type(
        run,
        span(row),
        `${" ".repeat(lostLeaderWidth + 3)}${change}`,
        { ...lost, glitch: 0.2 },
      );
    }
    await wait(run, 250);

    // sensor bar drains while it prints
    row = line("c-flaw");
    await leader(run, row, "  sensors failing", lostLeaderWidth + 2, {
      glitch: 0.25,
    });
    const sensors = span(row);
    const cells = 10;
    const target = 30 + Math.random() * 15;
    for (
      let percent = 100;
      percent > target;
      percent -= 3 + Math.random() * 6
    ) {
      const filled = Math.floor(percent / 10);
      sensors.textContent = `${bar(cells, filled, filled < cells ? 1 : 0)} ${Math.round(percent)}% ▼`;
      await wait(run, 45 + Math.random() * 70);
    }
    const settled = Math.round(target);
    sensors.textContent = `${bar(cells, Math.floor(settled / 10), 2)} ${settled}% ▼`;
    await wait(run, 300);

    row = line("c-dim");
    await type(run, span(row), "  telemetry desync: readings untrusted", {
      ...lost,
      glitch: 0.4,
    });
    await wait(run, 250);

    // signal readout garbles before settling on 0.0%
    row = line("c-flaw");
    await leader(run, row, "  coms lost", lostLeaderWidth + 2, {
      glitch: 0.55,
    });
    const signal = span(row);
    await type(run, signal, "signal ", { ...lost, glitch: 0.55 });
    const readoutSpan = span(row);
    if (!instant()) {
      const end = performance.now() + 900;
      while (performance.now() < end) {
        const noise = Array.from({ length: 6 }, () =>
          randomItem("▂▁▃· ░▒#%"),
        ).join("");
        readoutSpan.textContent = `${noise} ${(Math.random() * 40).toFixed(1)}%`;
        await wait(run, 55 + Math.random() * 60);
      }
    }
    readoutSpan.textContent = "▂▁ ·· ·  0.0%";
    await wait(run, 400);

    row = line("c-flaw");
    await leader(run, row, "  aborting operation", lostLeaderWidth + 2, {
      glitch: 0.7,
    });
    await type(run, span(row, "c-strong"), "✕ ABORTED", {
      ...lost,
      glitch: 0.7,
    });
    await wait(run, 500);

    row = line("c-dim");
    await type(run, span(row), "  -- transmission ends --", {
      ...lost,
      glitch: 0.85,
    });
    cursor.remove();

    status.textContent =
      "Dimensions changed. Volume readout aborted; run Calculate volume again.";
  }

  // --- control ---

  async function start(next, script) {
    token.cancelled = true;
    const run = (token = { cancelled: false });
    setState(next);
    try {
      await script(run);
      return true;
    } catch (error) {
      if (!(error instanceof Cancelled)) throw error;
      return false;
    }
  }

  // waiting for a command; what the docked console shows before a run
  function standBy() {
    output.replaceChildren();
    line("c-dim").prepend("  volumetrics console · standing by");
    span(line("c-command"), "c-prompt").textContent = "> ";
  }

  async function calculateVolume() {
    // on phones it's a pop-up; move focus into it
    if (!docked.matches && !root.classList.contains("open")) {
      root.classList.add("open");
      closeButton.focus();
    }
    output.replaceChildren();
    status.textContent = "";
    if (await start("printing", calculate)) setState("done");
  }

  // a slider moved: an open readout loses its signal (once)
  async function dimensionsChanged() {
    if (state !== "printing" && state !== "done") return;
    if (await start("aborting", loseSignal)) setState("lost");
  }

  // only the phone pop-up closes; the docked console is always shown
  function close() {
    if (!root.classList.contains("open")) return;
    token.cancelled = true;
    root.classList.remove("open");
    setState("idle");
    standBy();
    button.focus();
  }

  button.addEventListener("click", calculateVolume);
  closeButton.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  // the pop-up state means nothing once the console is docked
  docked.addEventListener("change", () => {
    if (docked.matches) root.classList.remove("open");
  });

  setState("idle");
  standBy();
  return { dimensionsChanged };
}
