// ==UserScript==
// @name         Wplace Template Tools
// @namespace    https://github.com/VWBeetle/wplace-template-tools
// @version      0.2.1
// @description  Adds visibility tools to Wplace's template overlay toolbar.
// @author       VWBeetle
// @match        https://wplace.live/*
// @run-at       document-start
// @sandbox      raw
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  const INSTALL_KEY = Symbol.for("wplace-template-tools.magenta-preview");

  const ENABLED_UNIFORM_NAME = "u_wptt_magenta_enabled";
  const COLOR_UNIFORM_NAME = "u_wptt_preview_color";

  const BUTTON_SELECTOR = "[data-wptt-magenta-toggle]";
  const COLOR_BUTTON_SELECTOR = "[data-wptt-preview-color]";
  const COLOR_NAME_SELECTOR = "[data-wptt-color-name]";
  const COLOR_PICKER_SELECTOR = "[data-wptt-color-picker]";
  const CHECKMARK_SELECTOR = "[data-wptt-checkmark]";

  const TOOLBAR_SELECTOR =
    '[data-wplace-clean-mode-overlay-toolbar="true"]';

  const STORAGE_KEY = "wplace-template-tools.preview-color";

  const COLOR_PRESETS = Object.freeze([
    {
      id: "magenta",
      label: "Magenta",
      hex: "#ff00ff",
      rgb: [1, 0, 1],
    },
    {
      id: "neon-green",
      label: "Neon green",
      hex: "#39ff14",
      rgb: [57 / 255, 1, 20 / 255],
    },
    {
      id: "neon-yellow",
      label: "Neon yellow",
      hex: "#fff01f",
      rgb: [1, 240 / 255, 31 / 255],
    },
    {
      id: "neon-orange",
      label: "Neon orange",
      hex: "#ff5f1f",
      rgb: [1, 95 / 255, 31 / 255],
    },
    {
      id: "neon-cyan",
      label: "Neon cyan",
      hex: "#00ffff",
      rgb: [0, 1, 1],
    },
  ]);

  /*
   * Prevent duplicate installation.
   *
   * If this script is somehow evaluated twice on the same page, reuse the
   * existing installation rather than wrapping WebGL methods again.
   */
  if (globalThis[INSTALL_KEY]) {
    globalThis[INSTALL_KEY].ensureUi?.();
    return;
  }

  const state = {
    color: loadSavedColor(),
    enabled: false,

    patchedShaders: new WeakSet(),
    programRecords: new WeakMap(),
    records: new Set(),

    ensureUi: () => {},
    setColor: () => {},
  };

  globalThis[INSTALL_KEY] = state;

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  function loadSavedColor() {
    try {
      const savedId = globalThis.localStorage?.getItem(STORAGE_KEY);

      return (
        COLOR_PRESETS.find(({ id }) => id === savedId) ??
        COLOR_PRESETS[0]
      );
    } catch {
      return COLOR_PRESETS[0];
    }
  }

  function saveColor(color) {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, color.id);
    } catch {
      // Persistence is optional. The selected color still works for this page.
    }
  }

  // ---------------------------------------------------------------------------
  // Shader detection / modification
  // ---------------------------------------------------------------------------

  function isOverlayFragmentShader(source) {
    return (
      typeof source === "string" &&
      source.includes("uniform bool u_highlight_enabled;") &&
      source.includes("uniform vec4 u_highlight_color;") &&
      source.includes("uniform float u_opacity;") &&
      source.includes("uniform float u_pixel_mode_resolution;") &&
      /(?:gl_FragColor|fragment_color)\s*=\s*color\s*;/.test(source)
    );
  }

  function addPreviewOverride(source) {
    /*
     * Don't modify the same source twice.
     */
    if (
      source.includes(`uniform bool ${ENABLED_UNIFORM_NAME};`) ||
      source.includes(`uniform vec3 ${COLOR_UNIFORM_NAME};`)
    ) {
      return source;
    }

    /*
     * Add our uniforms alongside the overlay texture uniform.
     */
    const withUniforms = source.replace(
      "uniform sampler2D u_texture;",
      [
        "uniform sampler2D u_texture;",
        `uniform bool ${ENABLED_UNIFORM_NAME};`,
        `uniform vec3 ${COLOR_UNIFORM_NAME};`,
      ].join("\n"),
    );

    /*
     * If the expected insertion point disappeared, leave the shader alone
     * rather than returning a half-patched shader.
     */
    if (withUniforms === source) {
      return source;
    }

    const withOverride = withUniforms.replace(
      "color.rgb *= color.a;",
      [
        `if (${ENABLED_UNIFORM_NAME}) {`,
        `  color.rgb = ${COLOR_UNIFORM_NAME};`,
        "}",
        "color.rgb *= color.a;",
      ].join("\n"),
    );

    if (withOverride === withUniforms) {
      return source;
    }

    return withOverride;
  }

  // ---------------------------------------------------------------------------
  // WebGL program tracking
  // ---------------------------------------------------------------------------

  function setProgramUniform(record) {
    const {
      colorLocation,
      enabledLocation,
      gl,
      native,
      program,
    } = record;

    try {
      if (native.isContextLost?.call(gl)) {
        return;
      }

      const previousProgram = native.getParameter.call(
        gl,
        gl.CURRENT_PROGRAM,
      );

      native.useProgram.call(gl, program);

      native.uniform1i.call(
        gl,
        enabledLocation,
        state.enabled ? 1 : 0,
      );

      native.uniform3f.call(
        gl,
        colorLocation,
        state.color.rgb[0],
        state.color.rgb[1],
        state.color.rgb[2],
      );

      native.useProgram.call(gl, previousProgram);
    } catch (error) {
      /*
       * A program may disappear because the renderer rebuilt itself. Stop
       * trying to update stale records.
       */
      state.records.delete(record);

      console.warn(
        "[Wplace Template Tools] Could not update an overlay renderer.",
        error,
      );
    }
  }

  function trackOverlayProgram(gl, program, native) {
    let attachedShaders;

    try {
      attachedShaders =
        native.getAttachedShaders.call(gl, program) ?? [];
    } catch {
      return;
    }

    /*
     * Only track programs containing a shader we actually modified.
     */
    if (
      !attachedShaders.some((shader) =>
        state.patchedShaders.has(shader),
      )
    ) {
      return;
    }

    const enabledLocation = native.getUniformLocation.call(
      gl,
      program,
      ENABLED_UNIFORM_NAME,
    );

    const colorLocation = native.getUniformLocation.call(
      gl,
      program,
      COLOR_UNIFORM_NAME,
    );

    if (
      enabledLocation === null ||
      colorLocation === null
    ) {
      console.warn(
        "[Wplace Template Tools] The preview color shader did not link correctly.",
      );

      return;
    }

    const previousRecord = state.programRecords.get(program);

    if (previousRecord) {
      state.records.delete(previousRecord);
    }

    const record = {
      colorLocation,
      enabledLocation,
      gl,
      native,
      program,
    };

    state.programRecords.set(program, record);
    state.records.add(record);

    setProgramUniform(record);
  }

  // ---------------------------------------------------------------------------
  // WebGL hooks
  // ---------------------------------------------------------------------------

  function patchContextPrototype(prototype) {
    if (
      !prototype ||
      typeof prototype.shaderSource !== "function" ||
      prototype.shaderSource.__wpttPatched
    ) {
      return;
    }

    const native = {
      deleteProgram: prototype.deleteProgram,
      getAttachedShaders: prototype.getAttachedShaders,
      getParameter: prototype.getParameter,
      getUniformLocation: prototype.getUniformLocation,
      isContextLost: prototype.isContextLost,
      linkProgram: prototype.linkProgram,
      shaderSource: prototype.shaderSource,
      uniform1i: prototype.uniform1i,
      uniform3f: prototype.uniform3f,
      useProgram: prototype.useProgram,
    };

    function shaderSource(shader, source) {
      let nextSource = source;

if (
  typeof source === "string" &&
  (
    source.includes("fragment_color") ||
    source.includes("gl_FragColor")
  )
) {
  console.log(
    "[Wplace Template Tools] FRAGMENT SHADER:\n",
    source,
  );
}

if (isOverlayFragmentShader(source)) {
  console.log(
    "[Wplace Template Tools] ORIGINAL OVERLAY SHADER:\n",
    source,
  );

  const patchedSource = addPreviewOverride(source);

  if (patchedSource !== source) {
    nextSource = patchedSource;
    state.patchedShaders.add(shader);
  }
}

      return native.shaderSource.call(
        this,
        shader,
        nextSource,
      );
    }

    Object.defineProperty(
      shaderSource,
      "__wpttPatched",
      {
        value: true,
      },
    );

    prototype.shaderSource = shaderSource;

    prototype.linkProgram = function linkProgram(program) {
      const result = native.linkProgram.call(this, program);

      try {
        trackOverlayProgram(this, program, native);
      } catch (error) {
        console.warn(
          "[Wplace Template Tools] Could not track an overlay renderer.",
          error,
        );
      }

      return result;
    };

    prototype.deleteProgram = function deleteProgram(program) {
      const record = state.programRecords.get(program);

      if (record) {
        state.records.delete(record);
        state.programRecords.delete(program);
      }

      return native.deleteProgram.call(this, program);
    };
  }

  patchContextPrototype(
    globalThis.WebGLRenderingContext?.prototype,
  );

  patchContextPrototype(
    globalThis.WebGL2RenderingContext?.prototype,
  );

  // ---------------------------------------------------------------------------
  // Toolbar toggle
  // ---------------------------------------------------------------------------

  function updateButtons() {
    document
      .querySelectorAll(BUTTON_SELECTOR)
      .forEach((button) => {
        button.classList.toggle(
          "btn-active",
          state.enabled,
        );

        button.setAttribute(
          "aria-pressed",
          String(state.enabled),
        );

        const title = state.enabled
          ? "Restore preview pixel colors"
          : `Show preview pixels in ${state.color.label.toLowerCase()}`;

        /*
         * Attribute mutations are intentionally fine here. Our observer only
         * watches childList changes.
         */
        if (button.title !== title) {
          button.title = title;
        }

        if (
          button.getAttribute("aria-label") !== title
        ) {
          button.setAttribute("aria-label", title);
        }
      });
  }

  function makeToggleButton() {
    const button = document.createElement("button");

    button.type = "button";
    button.className =
      "btn btn-ghost btn-xs btn-square";

    button.dataset.wpttMagentaToggle = "";

    button.setAttribute(
      "aria-pressed",
      "false",
    );

    button.innerHTML = `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="size-3.5"
        aria-hidden="true"
      >
        <path d="M13 2 4.5 13H11l-1 9L19.5 10H13V2Z"></path>
      </svg>
    `;

    button.addEventListener("click", () => {
      setEnabled(!state.enabled);
    });

    return button;
  }

  // ---------------------------------------------------------------------------
  // Color picker
  // ---------------------------------------------------------------------------

  function updateColorPickers() {
    document
      .querySelectorAll(COLOR_BUTTON_SELECTOR)
      .forEach((button) => {
        const selected =
          button.dataset.wpttPreviewColor ===
          state.color.id;

        button.classList.toggle(
          "ring-2",
          selected,
        );

        button.classList.toggle(
          "ring-primary",
          selected,
        );

        button.classList.toggle(
          "scale-110",
          selected,
        );

        button.setAttribute(
          "aria-checked",
          String(selected),
        );

        /*
         * IMPORTANT:
         *
         * Do not assign button.textContent here.
         *
         * The script observes childList mutations across the document. Changing
         * textContent destroys/recreates text nodes and can therefore trigger
         * the observer again.
         *
         * Instead, every swatch gets a permanent checkmark child and we only
         * toggle its hidden attribute.
         */
        const checkmark =
          button.querySelector(CHECKMARK_SELECTOR);

        if (checkmark) {
          checkmark.hidden = !selected;
        }
      });

    document
      .querySelectorAll(COLOR_NAME_SELECTOR)
      .forEach((label) => {
        const text =
          `${state.color.label} · ` +
          state.color.hex.toUpperCase();

        /*
         * The label is created with exactly one Text node. Updating nodeValue
         * produces a characterData mutation, not a childList mutation, so our
         * observer will not react to it.
         */
        const textNode = label.firstChild;

        if (
          textNode?.nodeType === Node.TEXT_NODE
        ) {
          if (textNode.nodeValue !== text) {
            textNode.nodeValue = text;
          }

          return;
        }

        /*
         * Fallback for unexpected DOM modification. This can cause one
         * childList mutation, but subsequent passes become stable.
         */
        if (label.textContent !== text) {
          label.textContent = text;
        }
      });
  }

  function makeColorPicker() {
    const picker = document.createElement("section");

    picker.dataset.wpttColorPicker = "";

    picker.className =
      "mx-4 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-base-200/60 px-3 py-2.5";

    picker.setAttribute(
      "aria-label",
      "Preview visibility color",
    );

    /*
     * Copy
     */
    const copy = document.createElement("div");

    const title = document.createElement("p");

    title.className = "text-sm font-medium";
    title.textContent = "Preview visibility color";

    const description =
      document.createElement("p");

    description.className =
      "text-base-content/50 text-xs";

    description.textContent =
      "Used when the lightning toggle is on";

    copy.append(title, description);

    /*
     * Controls
     */
    const controls = document.createElement("div");

    controls.className =
      "flex flex-col items-end gap-1.5";

    const swatches = document.createElement("div");

    swatches.className =
      "flex items-center gap-2";

    swatches.setAttribute(
      "role",
      "radiogroup",
    );

    swatches.setAttribute(
      "aria-label",
      "Preview visibility color",
    );

    for (const color of COLOR_PRESETS) {
      const button =
        document.createElement("button");

      button.type = "button";

      button.className =
        "btn btn-circle btn-xs border-base-content/20 p-0 text-black shadow-sm transition-transform";

      button.dataset.wpttPreviewColor =
        color.id;

      button.style.backgroundColor =
        color.hex;

      button.title =
        `${color.label} (${color.hex.toUpperCase()})`;

      button.setAttribute(
        "aria-label",
        button.title,
      );

      button.setAttribute(
        "role",
        "radio",
      );

      /*
       * Create the checkmark once. updateColorPickers() only changes `hidden`,
       * so selecting colors doesn't modify the button's child list.
       */
      const checkmark =
        document.createElement("span");

      checkmark.dataset.wpttCheckmark = "";
      checkmark.textContent = "✓";
      checkmark.setAttribute(
        "aria-hidden",
        "true",
      );

      button.append(checkmark);

      button.addEventListener(
        "click",
        () => {
          setColor(color.id);
        },
      );

      swatches.append(button);
    }

    /*
     * Current color label.
     *
     * Give it a Text node before putting it into the document so future
     * updates can change nodeValue without creating/removing DOM children.
     */
    const selectedName =
      document.createElement("span");

    selectedName.dataset.wpttColorName = "";

    selectedName.className =
      "text-base-content/60 text-[11px] font-medium";

    selectedName.append(
      document.createTextNode(
        `${state.color.label} · ${state.color.hex.toUpperCase()}`,
      ),
    );

    controls.append(
      swatches,
      selectedName,
    );

    picker.append(
      copy,
      controls,
    );

    /*
     * Initialize selected-state attributes/classes before insertion.
     */
    for (const button of swatches.querySelectorAll(
      COLOR_BUTTON_SELECTOR,
    )) {
      const selected =
        button.dataset.wpttPreviewColor ===
        state.color.id;

      button.classList.toggle(
        "ring-2",
        selected,
      );

      button.classList.toggle(
        "ring-primary",
        selected,
      );

      button.classList.toggle(
        "scale-110",
        selected,
      );

      button.setAttribute(
        "aria-checked",
        String(selected),
      );

      const checkmark =
        button.querySelector(CHECKMARK_SELECTOR);

      if (checkmark) {
        checkmark.hidden = !selected;
      }
    }

    return picker;
  }

  // ---------------------------------------------------------------------------
  // State changes
  // ---------------------------------------------------------------------------

  function requestMapRepaint() {
    requestAnimationFrame(() => {
      globalThis.dispatchEvent(
        new Event("resize"),
      );
    });
  }

  function setEnabled(enabled) {
    if (state.enabled === enabled) {
      return;
    }

    state.enabled = enabled;

    state.records.forEach(
      setProgramUniform,
    );

    updateButtons();
    requestMapRepaint();
  }

  function setColor(colorId) {
    const color = COLOR_PRESETS.find(
      ({ id }) => id === colorId,
    );

    if (!color) {
      return;
    }

    /*
     * Still refresh the UI if the user picked the currently-selected color,
     * but don't perform unnecessary WebGL/storage work.
     */
    if (state.color.id === color.id) {
      updateButtons();
      updateColorPickers();
      return;
    }

    state.color = color;

    saveColor(color);

    state.records.forEach(
      setProgramUniform,
    );

    updateButtons();
    updateColorPickers();
    requestMapRepaint();
  }

  // ---------------------------------------------------------------------------
  // Find / insert Wplace UI
  // ---------------------------------------------------------------------------

  function findOverlayToolbar() {
    const markedToolbar =
      document.querySelector(TOOLBAR_SELECTOR);

    if (markedToolbar) {
      return markedToolbar;
    }

    /*
     * Fallback for versions of the overlay UI that don't yet have our
     * identifying data attribute.
     */
    const optionButtons =
      document.querySelectorAll(
        "button.btn-xs.btn-square",
      );

    const possibleToolbars = new Set(
      [...optionButtons]
        .map((button) => button.parentElement)
        .filter(Boolean),
    );

    for (const toolbar of possibleToolbars) {
      const displayOptions =
        toolbar.querySelectorAll(
          ":scope > button.btn-xs.btn-square",
        );

      const backButton =
        toolbar.querySelector(
          ":scope > button.btn-sm.shrink-0:not(.btn-square)",
        );

      if (
        displayOptions.length >= 3 &&
        backButton
      ) {
        return toolbar;
      }
    }

    return null;
  }

  function ensureButton() {
    const toolbar = findOverlayToolbar();

    if (!toolbar) {
      return;
    }

    const existing =
      toolbar.querySelector(BUTTON_SELECTOR);

    if (existing) {
      updateButtons();
      return;
    }

    const firstDisplayOption =
      toolbar.querySelector(
        "button.btn-xs.btn-square",
      );

    const button = makeToggleButton();

    toolbar.insertBefore(
      button,
      firstDisplayOption ??
        toolbar.children[1] ??
        null,
    );

    updateButtons();
  }

  function ensureColorPicker() {
    const templateInput =
      document.querySelector(
        "#template-file-input",
      );

    const dialog =
      templateInput?.closest("dialog");

    const gallery =
      dialog?.querySelector(
        "[data-template-gallery-scroll]",
      );

    const container =
      gallery?.parentElement;

    if (
      !dialog ||
      !gallery ||
      !container
    ) {
      return;
    }

    let picker =
      dialog.querySelector(
        COLOR_PICKER_SELECTOR,
      );

    if (!picker) {
      picker = makeColorPicker();

      container.insertBefore(
        picker,
        gallery,
      );
    }

    updateColorPickers();
  }

  function ensureUi() {
    ensureButton();
    ensureColorPicker();
  }

  state.ensureUi = ensureUi;
  state.setColor = setColor;

  // ---------------------------------------------------------------------------
  // DOM observation
  // ---------------------------------------------------------------------------

  let ensureScheduled = false;

  function scheduleEnsureUi() {
    if (ensureScheduled) {
      return;
    }

    ensureScheduled = true;

    queueMicrotask(() => {
      ensureScheduled = false;
      ensureUi();
    });
  }

  /*
   * We deliberately observe ONLY childList changes.
   *
   * Wplace dynamically creates/removes its toolbar and template dialog, so we
   * need to notice new DOM nodes. We do not need to react to class, attribute,
   * or text-node changes.
   *
   * updateColorPickers() has been written specifically so its normal updates
   * do not create childList mutations.
   */
  const uiObserver =
    new MutationObserver(scheduleEnsureUi);

  uiObserver.observe(document, {
    childList: true,
    subtree: true,
  });

  /*
   * Attempt immediately as well. At document-start the relevant UI probably
   * doesn't exist yet, which is fine—the observer will catch it later.
   */
  ensureUi();
})();