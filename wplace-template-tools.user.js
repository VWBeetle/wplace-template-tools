// ==UserScript==
// @name         Wplace Template Tools
// @namespace    https://github.com/VWBeetle/wplace-template-tools
// @version      1.3.0
// @license      MIT
// @description  Extra tools for use with Wplace overlays
// @downloadURL  https://raw.githubusercontent.com/vwbeetle/wplace-template-tools/main/wplace-template-tools.user.js
// @updateURL    https://raw.githubusercontent.com/vwbeetle/wplace-template-tools/main/wplace-template-tools.user.js
// @author       VWBeetle
// @match        *://*.wplace.live/*
// @run-at       document-start
// @sandbox      raw
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  // ===========================================================================
  // Configuration
  // ===========================================================================

  const INSTALL_KEY = Symbol.for(
    "wplace-template-tools.magenta-preview",
  );

  const ENABLED_UNIFORM_NAME =
    "u_wptt_magenta_enabled";

  const COLOR_UNIFORM_NAME =
    "u_wptt_preview_color";

  const MASK_UNIFORM_NAME =
    "u_wptt_mismatch_mask";

  const MASK_READY_UNIFORM_NAME =
    "u_wptt_mismatch_mask_ready";

  const PULSE_BRIGHTNESS_UNIFORM_NAME =
    "u_wptt_pulse_brightness";

  const FULL_PREVIEW_UNIFORM_NAME =
    "u_wptt_full_preview_enabled";

  const PLUS_PREVIEW_UNIFORM_NAME =
    "u_wptt_plus_preview_enabled";

  const BUTTON_SELECTOR =
    "[data-wptt-magenta-toggle]";

  const FULL_PIXEL_TOGGLE_SELECTOR =
    "[data-wptt-full-pixel-toggle]";

  const PLUS_PREVIEW_BUTTON_SELECTOR =
    "[data-wptt-plus-preview-toggle]";

  const COLOR_BUTTON_SELECTOR =
    "[data-wptt-preview-color]";

  const SETTINGS_SELECTOR =
    "[data-wptt-settings]";

  const TEMPLATE_PROGRESS_SELECTOR =
    "[data-wptt-template-progress]";

  const TEMPLATE_COMPLETE_ACTION_SELECTOR =
    "[data-wptt-template-complete-action]";

  const TEMPLATE_DRAG_HANDLE_SELECTOR =
    "[data-wptt-template-drag-handle]";

  const REORDER_MODE_BUTTON_SELECTOR =
    "[data-wptt-reorder-mode-button]";

  const TEMPLATE_GALLERY_ITEM_SELECTOR =
    "[data-overlay-gallery-item]";

  const PULSE_TOGGLE_SELECTOR =
    "[data-wptt-enable-pulse]";

  const CHECKMARK_SELECTOR =
    "[data-wptt-checkmark]";

  const TOOLBAR_SELECTOR =
    '[data-wplace-clean-mode-overlay-toolbar="true"]';

  const BACK_DIVIDER_SELECTOR =
    "[data-wptt-back-divider]";

  const COLOR_STORAGE_KEY =
    "wplace-template-tools.preview-color";

  const PULSE_STORAGE_KEY =
    "wplace-template-tools.enable-pulse";

  const MANUAL_COMPLETE_STORAGE_KEY =
    "wplace-template-tools.manual-complete";

  const TEMPLATE_ORDER_STORAGE_KEY =
    "wplace-template-tools.template-order";

  const PROGRESS_DB_NAME =
    "wplace-template-tools";

  const PROGRESS_DB_VERSION = 1;

  const PROGRESS_STORE_NAME =
    "template-progress";

  const PROGRESS_STORAGE_FORMAT_VERSION = 3;

  const ARTWORK_TILE_ZOOM = 11;

  const ARTWORK_TILE_COUNT =
    2 ** ARTWORK_TILE_ZOOM;

  const ARTWORK_TILE_ROOT =
    "https://backend.wplace.live/files/s0/tiles";

  const COMPARISON_REFRESH_MS = 15_000;

  const MUTATION_REFRESH_DELAY_MS = 1_000;

  const COLOR_TOLERANCE = 2;

  const TILE_FETCH_CONCURRENCY = 6;

  const MAX_MASKS_PER_PROGRAM = 6;

  const MAP_CAPTURE_TIMEOUT_MS = 3_000;

  /*
   * Pulse appearance.
   */
  const PULSE_MIN_BRIGHTNESS = 0.4;
  const PULSE_MAX_BRIGHTNESS = 1.0;
  const PULSE_PERIOD_MS = 3_000;
  const PULSE_FRAME_INTERVAL_MS = 1_000 / 30;

  const HIGHLIGHT_OFF = 0;
  const HIGHLIGHT_SOLID = 1;
  const HIGHLIGHT_PULSE = 2;

  const FALLBACK_FULL_PIXEL_ICON_MARKUP = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      class="size-3.5"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="1"></rect>
    </svg>
  `;

  const CHECKERBOARD_ICON_MARKUP = `
<svg
  data-wptt-checkerboard-svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  class="size-3.5"
  aria-hidden="true"
>
  <rect
    x="3"
    y="3"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  ></rect>

  <path
    d="M3 3h9v9H3V3Zm9 9h9v9h-9v-9Z"
    fill="currentColor"
  ></path>

  <path
    d="M12 3v18M3 12h18"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  ></path>
</svg>
  `;

  const PLUS_PREVIEW_ICON_MARKUP = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      class="size-3.5"
      aria-hidden="true"
    >
      <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"></path>
    </svg>
  `;

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

  // ===========================================================================
  // Duplicate-install protection
  // ===========================================================================

  if (globalThis[INSTALL_KEY]) {
    globalThis[INSTALL_KEY].ensureUi?.();
    return;
  }

  // ===========================================================================
  // State
  // ===========================================================================

  const state = {
    color: loadSavedColor(),
    pulseEnabled: loadPulseEnabled(),

    highlightMode: HIGHLIGHT_OFF,
    fullPreviewEnabled: false,
    plusPreviewEnabled: false,

    progressModalVisible: false,
    progressCaptureActive: false,
    progressCaptureToken: 0,
    progressCaptureTimer: 0,
    progressCaptureSequence: 0,
    progressCaptureCandidates: new Map(),
    progressDesiredCounts: new Map(),
    progressEntries: [],
    progressLastError: null,
    progressStoredSlots: new Map(),
    progressStoragePromise: null,
    progressStorageError: null,
    progressManualCompleteKeys:
      loadManualCompleteKeys(),
    progressGallery: null,

    templateOrder:
      loadTemplateOrder(),

    showReorderHandles: false,

    templateDragRow: null,
    templateDragPointerId: null,

    /*
     * Added preview buttons behave like extra display modes.
     * Remember the native mode so it can be visually restored afterward.
     */
    nativeModeSelectionIndex: null,
    fullPixelIconMarkup: null,

    pulseBrightness: 1,

    map: null,
    mapPromise: null,

    patchedShaders: new WeakSet(),
    programRecords: new WeakMap(),
    records: new Set(),

    ensureUi: () => {},
  };

  globalThis[INSTALL_KEY] = state;

  const textureIds = new WeakMap();

  const templatePixelCache =
    new WeakMap();

  const textureContentVersions =
    new WeakMap();

  const galleryTemplatePixelCache =
    new WeakMap();

  const artworkTileCache =
    new Map();

  const nativeModeButtonsBound =
    new WeakSet();

  const reorderDialogBound =
    new WeakSet();

  let nextTextureId = 1;

  let artworkGeneration = 0;

  let mutationRefreshTimer = 0;

  let pulseAnimationFrame = 0;
  let lastPulseFrameTime = 0;

  // ===========================================================================
  // Settings
  // ===========================================================================

  function loadSavedColor() {
    try {
      const savedId =
        globalThis.localStorage?.getItem(
          COLOR_STORAGE_KEY,
        );

      return (
        COLOR_PRESETS.find(
          ({ id }) => id === savedId,
        ) ??
        COLOR_PRESETS[0]
      );
    } catch {
      return COLOR_PRESETS[0];
    }
  }

  function saveColor(color) {
    try {
      globalThis.localStorage?.setItem(
        COLOR_STORAGE_KEY,
        color.id,
      );
    } catch {
      // Persistence is optional.
    }
  }

  function loadPulseEnabled() {
    try {
      const saved =
        globalThis.localStorage?.getItem(
          PULSE_STORAGE_KEY,
        );

      return saved !== "false";
    } catch {
      return true;
    }
  }

  function savePulseEnabled(enabled) {
    try {
      globalThis.localStorage?.setItem(
        PULSE_STORAGE_KEY,
        String(enabled),
      );
    } catch {
      // Persistence is optional.
    }
  }

  function loadManualCompleteKeys() {
    try {
      const raw =
        globalThis.localStorage?.getItem(
          MANUAL_COMPLETE_STORAGE_KEY,
        );

      const parsed =
        JSON.parse(raw ?? "[]");

      return new Set(
        Array.isArray(parsed)
          ? parsed.filter(
              (value) =>
                typeof value ===
                "string",
            )
          : [],
      );
    } catch {
      return new Set();
    }
  }

  function saveManualCompleteKeys() {
    try {
      globalThis.localStorage?.setItem(
        MANUAL_COMPLETE_STORAGE_KEY,
        JSON.stringify(
          [
            ...state
              .progressManualCompleteKeys,
          ],
        ),
      );
    } catch {
      // Persistence is optional.
    }
  }

  function loadTemplateOrder() {
    try {
      const raw =
        globalThis.localStorage?.getItem(
          TEMPLATE_ORDER_STORAGE_KEY,
        );

      const parsed =
        JSON.parse(raw ?? "[]");

      return Array.isArray(parsed)
        ? parsed.filter(
            (value) =>
              typeof value ===
              "string",
          )
        : [];
    } catch {
      return [];
    }
  }

  function saveTemplateOrder(order) {
    state.templateOrder =
      [...order];

    try {
      globalThis.localStorage?.setItem(
        TEMPLATE_ORDER_STORAGE_KEY,
        JSON.stringify(
          state.templateOrder,
        ),
      );
    } catch {
      // Persistence is optional.
    }
  }

  function updateReorderModeButton() {
    document
      .querySelectorAll(
        REORDER_MODE_BUTTON_SELECTOR,
      )
      .forEach((button) => {
        const active =
          state.showReorderHandles;

        const nextClassName =
          active
            ? "btn btn-primary btn-sm btn-square"
            : "btn btn-ghost btn-sm btn-square";

        if (
          button.className !==
          nextClassName
        ) {
          button.className =
            nextClassName;
        }

        button.setAttribute(
          "aria-pressed",
          String(active),
        );

        button.setAttribute(
          "aria-label",
          active
            ? "Finish reordering overlays"
            : "Reorder overlays",
        );

        button.title =
          active
            ? "Finish reordering"
            : "Reorder overlays";
      });
  }

  function setShowReorderHandles(
    enabled,
  ) {
    enabled =
      Boolean(enabled);

    if (
      !enabled &&
      state.templateDragRow
    ) {
      state.templateDragRow
        .removeAttribute(
          "data-wptt-template-dragging",
        );

      state.templateDragRow =
        null;

      state.templateDragPointerId =
        null;
    }

    state.showReorderHandles =
      enabled;

    document
      .querySelectorAll(
        TEMPLATE_DRAG_HANDLE_SELECTOR,
      )
      .forEach((handle) => {
        handle.hidden =
          !state.showReorderHandles;
      });

    updateReorderModeButton();
  }

  function isProgressManuallyComplete(
    storageKey,
  ) {
    return (
      typeof storageKey ===
        "string" &&
      state.progressManualCompleteKeys
        .has(storageKey)
    );
  }

  function setProgressManuallyComplete(
    storageKey,
    complete,
  ) {
    if (
      typeof storageKey !==
      "string"
    ) {
      return;
    }

    if (complete) {
      state.progressManualCompleteKeys
        .add(storageKey);
    } else {
      state.progressManualCompleteKeys
        .delete(storageKey);
    }

    saveManualCompleteKeys();
    updateTemplateProgressUi();

    const templateInput =
      document.querySelector(
        "#template-file-input",
      );

    const dialog =
      templateInput?.closest(
        "dialog",
      );

    const gallery =
      dialog?.querySelector(
        "[data-template-gallery-scroll]",
      );

    if (gallery) {
      ensureTemplateCompletionMenus(
        gallery,
      );
    }
  }

  // ===========================================================================
  // Progress persistence
  // ===========================================================================

  let progressDatabasePromise = null;

  function describeError(error) {
    return error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);
  }

  function getProgressDatabase() {
    if (progressDatabasePromise) {
      return progressDatabasePromise;
    }

    progressDatabasePromise =
      new Promise(
        (resolve, reject) => {
          if (!globalThis.indexedDB) {
            reject(
              new Error(
                "IndexedDB is not available",
              ),
            );

            return;
          }

          const request =
            globalThis.indexedDB.open(
              PROGRESS_DB_NAME,
              PROGRESS_DB_VERSION,
            );

          request.onupgradeneeded =
            () => {
              const database =
                request.result;

              if (
                !database.objectStoreNames
                  .contains(
                    PROGRESS_STORE_NAME,
                  )
              ) {
                database.createObjectStore(
                  PROGRESS_STORE_NAME,
                  {
                    keyPath:
                      "storageKey",
                  },
                );
              }
            };

          request.onsuccess =
            () => {
              resolve(
                request.result,
              );
            };

          request.onerror =
            () => {
              reject(
                request.error ??
                  new Error(
                    "Could not open progress database",
                  ),
              );
            };

          request.onblocked =
            () => {
              reject(
                new Error(
                  "Progress database upgrade was blocked",
                ),
              );
            };
        },
      );

    return progressDatabasePromise;
  }

  function waitForRequest(request) {
    return new Promise(
      (resolve, reject) => {
        request.onsuccess =
          () =>
            resolve(
              request.result,
            );

        request.onerror =
          () =>
            reject(
              request.error ??
                new Error(
                  "IndexedDB request failed",
                ),
            );
      },
    );
  }

  function waitForTransaction(
    transaction,
  ) {
    return new Promise(
      (resolve, reject) => {
        transaction.oncomplete =
          () => resolve();

        transaction.onerror =
          () =>
            reject(
              transaction.error ??
                new Error(
                  "IndexedDB transaction failed",
                ),
            );

        transaction.onabort =
          () =>
            reject(
              transaction.error ??
                new Error(
                  "IndexedDB transaction was aborted",
                ),
            );
      },
    );
  }

  async function ensureProgressStorageLoaded() {
    if (state.progressStoragePromise) {
      return state.progressStoragePromise;
    }

    state.progressStoragePromise =
      (async () => {
        try {
          const database =
            await getProgressDatabase();

          const transaction =
            database.transaction(
              PROGRESS_STORE_NAME,
              "readonly",
            );

          const store =
            transaction.objectStore(
              PROGRESS_STORE_NAME,
            );

          const records =
            await waitForRequest(
              store.getAll(),
            );

          await waitForTransaction(
            transaction,
          );

          state.progressStoredSlots.clear();

          for (
            const record of
            records
          ) {
            if (
              !record ||
              record.formatVersion !==
                PROGRESS_STORAGE_FORMAT_VERSION ||
              typeof record.storageKey !==
                "string" ||
              !record.lookupData
            ) {
              continue;
            }

            state.progressStoredSlots.set(
              record.storageKey,
              record,
            );
          }

          state.progressStorageError =
            null;
        } catch (error) {
          state.progressStorageError =
            describeError(error);

          console.warn(
            "[Wplace Template Tools] Could not load saved template progress.",
            error,
          );
        }

        return state.progressStoredSlots;
      })();

    return state.progressStoragePromise;
  }

  async function saveProgressStoredSlot(
    stored,
  ) {
    if (
      !stored?.storageKey ||
      !stored.lookupData
    ) {
      return;
    }

    state.progressStoredSlots.set(
      stored.storageKey,
      stored,
    );

    try {
      const database =
        await getProgressDatabase();

      const transaction =
        database.transaction(
          PROGRESS_STORE_NAME,
          "readwrite",
        );

      transaction
        .objectStore(
          PROGRESS_STORE_NAME,
        )
        .put(stored);

      await waitForTransaction(
        transaction,
      );

      state.progressStorageError =
        null;
    } catch (error) {
      state.progressStorageError =
        describeError(error);

      console.warn(
        "[Wplace Template Tools] Could not save template progress.",
        error,
      );
    }
  }

  function getProgressStorageKey(
    width,
    height,
    slotIndex,
  ) {
    return (
      `${width}x${height}:` +
      slotIndex
    );
  }

  function getTemplateRowProgressKey(
    row,
    duplicateIndex = null,
  ) {
    if (!row) {
      return null;
    }

    let key =
      `row:${getTemplateRowOrderId(
        row,
      )}`;

    if (
      Number.isInteger(
        duplicateIndex,
      )
    ) {
      key +=
        `:duplicate:${duplicateIndex}`;
    }

    return key;
  }

  function fingerprintTemplatePixels(
    width,
    height,
    pixels,
  ) {
    let hash = 2166136261;

    for (
      let index = 0;
      index < pixels.length;
      index += 1
    ) {
      hash ^=
        pixels[index];

      hash =
        Math.imul(
          hash,
          16777619,
        );
    }

    return (
      `${width}x${height}:` +
      (hash >>> 0)
        .toString(16)
        .padStart(8, "0")
    );
  }

  async function getGalleryTemplatePixels(
    target,
  ) {
    const row =
      target?.row;

    if (!row) {
      return null;
    }

    const image =
      row.querySelector(
        "img",
      );

    if (!image) {
      return null;
    }

    const source =
      image.getAttribute(
        "src",
      ) ?? "";

    const cached =
      galleryTemplatePixelCache.get(
        row,
      );

    if (
      cached &&
      cached.width ===
        target.width &&
      cached.height ===
        target.height &&
      cached.source ===
        source
    ) {
      return cached.data;
    }

    if (
      !image.complete ||
      image.naturalWidth < 1 ||
      image.naturalHeight < 1
    ) {
      try {
        await image.decode();
      } catch {
        return null;
      }
    }

    let canvas;
    let context;

    if (
      typeof OffscreenCanvas !==
      "undefined"
    ) {
      canvas =
        new OffscreenCanvas(
          target.width,
          target.height,
        );

      context =
        canvas.getContext(
          "2d",
          {
            willReadFrequently:
              true,
          },
        );
    } else {
      canvas =
        document.createElement(
          "canvas",
        );

      canvas.width =
        target.width;

      canvas.height =
        target.height;

      context =
        canvas.getContext(
          "2d",
          {
            willReadFrequently:
              true,
          },
        );
    }

    if (!context) {
      return null;
    }

    context.clearRect(
      0,
      0,
      target.width,
      target.height,
    );

    context.imageSmoothingEnabled =
      false;

    context.drawImage(
      image,
      0,
      0,
      target.width,
      target.height,
    );

    let data;

    try {
      data =
        context.getImageData(
          0,
          0,
          target.width,
          target.height,
        ).data;
    } catch {
      return null;
    }

    const copy =
      new Uint8Array(
        data.length,
      );

    copy.set(data);

    galleryTemplatePixelCache.set(
      row,
      {
        width:
          target.width,

        height:
          target.height,

        source,

        data:
          copy,
      },
    );

    return copy;
  }

  function getTemplatePixelMatchScore(
    candidatePixels,
    galleryPixels,
    width,
    height,
  ) {
    if (
      !candidatePixels ||
      !galleryPixels ||
      candidatePixels.length !==
        galleryPixels.length
    ) {
      return Number.POSITIVE_INFINITY;
    }

    let best =
      Number.POSITIVE_INFINITY;

    for (
      const flipX of [
        false,
        true,
      ]
    ) {
      for (
        const flipY of [
          false,
          true,
        ]
      ) {
        let score = 0;

        for (
          let y = 0;
          y < height;
          y += 1
        ) {
          const sourceY =
            flipY
              ? height - 1 - y
              : y;

          for (
            let x = 0;
            x < width;
            x += 1
          ) {
            const sourceX =
              flipX
                ? width - 1 - x
                : x;

            const candidateOffset =
              (
                sourceY *
                  width +
                sourceX
              ) * 4;

            const galleryOffset =
              (
                y *
                  width +
                x
              ) * 4;

            const candidateAlpha =
              candidatePixels[
                candidateOffset + 3
              ];

            const galleryAlpha =
              galleryPixels[
                galleryOffset + 3
              ];

            const candidateVisible =
              candidateAlpha > 0;

            const galleryVisible =
              galleryAlpha > 0;

            if (
              !candidateVisible &&
              !galleryVisible
            ) {
              continue;
            }

            if (
              candidateVisible !==
              galleryVisible
            ) {
              score += 2048;
              continue;
            }

            score +=
              Math.abs(
                candidateAlpha -
                  galleryAlpha,
              ) * 4;

            score +=
              Math.abs(
                candidatePixels[
                  candidateOffset
                ] -
                  galleryPixels[
                    galleryOffset
                  ],
              );

            score +=
              Math.abs(
                candidatePixels[
                  candidateOffset + 1
                ] -
                  galleryPixels[
                    galleryOffset + 1
                  ],
              );

            score +=
              Math.abs(
                candidatePixels[
                  candidateOffset + 2
                ] -
                  galleryPixels[
                    galleryOffset + 2
                  ],
              );

            if (score >= best) {
              break;
            }
          }

          if (score >= best) {
            break;
          }
        }

        if (score < best) {
          best = score;
        }
      }
    }

    return best;
  }

  async function matchProgressCandidatesToTargets(
    candidates,
    targets,
  ) {
    const assignments =
      new Map();

    if (
      !candidates.length ||
      !targets.length
    ) {
      return assignments;
    }

    const galleryPixels =
      await Promise.all(
        targets.map(
          getGalleryTemplatePixels,
        ),
      );

    const pairs = [];

    for (
      let candidateIndex = 0;
      candidateIndex <
        candidates.length;
      candidateIndex += 1
    ) {
      const candidate =
        candidates[
          candidateIndex
        ];

      const candidatePixels =
        candidate?.lookupData
          ?.templatePixels;

      if (!candidatePixels) {
        continue;
      }

      for (
        let targetIndex = 0;
        targetIndex <
          targets.length;
        targetIndex += 1
      ) {
        const pixels =
          galleryPixels[
            targetIndex
          ];

        if (!pixels) {
          continue;
        }

        pairs.push(
          {
            candidateIndex,
            targetIndex,

            score:
              getTemplatePixelMatchScore(
                candidatePixels,
                pixels,
                targets[
                  targetIndex
                ].width,
                targets[
                  targetIndex
                ].height,
              ),
          },
        );
      }
    }

    pairs.sort(
      (first, second) =>
        first.score -
          second.score ||
        first.candidateIndex -
          second.candidateIndex ||
        first.targetIndex -
          second.targetIndex,
    );

    const usedCandidates =
      new Set();

    const usedTargets =
      new Set();

    for (
      const pair of pairs
    ) {
      if (
        !Number.isFinite(
          pair.score,
        ) ||
        usedCandidates.has(
          pair.candidateIndex,
        ) ||
        usedTargets.has(
          pair.targetIndex,
        )
      ) {
        continue;
      }

      const target =
        targets[
          pair.targetIndex
        ];

      assignments.set(
        target,
        candidates[
          pair.candidateIndex
        ],
      );

      usedCandidates.add(
        pair.candidateIndex,
      );

      usedTargets.add(
        pair.targetIndex,
      );
    }

    /*
     * If image readback is unavailable, preserve the previously working
     * native-order fallback instead of dropping progress entirely.
     */
    const remainingCandidates =
      candidates.filter(
        (_, index) =>
          !usedCandidates.has(
            index,
          ),
      );

    const remainingTargets =
      targets.filter(
        (_, index) =>
          !usedTargets.has(
            index,
          ),
      );

    for (
      let index = 0;
      index <
        Math.min(
          remainingCandidates.length,
          remainingTargets.length,
        );
      index += 1
    ) {
      assignments.set(
        remainingTargets[index],
        remainingCandidates[index],
      );
    }

    return assignments;
  }

  function makeStoredProgressRecord(
    entry,
  ) {
    if (
      !entry?.progressStorageKey ||
      !entry.lookupData
    ) {
      return null;
    }

    const templatePixels =
      entry.lookupData
        .templatePixels;

    return {
      formatVersion:
        PROGRESS_STORAGE_FORMAT_VERSION,

      storageKey:
        entry.progressStorageKey,

      width:
        entry.width,

      height:
        entry.height,

      slotIndex:
        entry.progressSlotIndex ?? 0,

      fingerprint:
        entry.progressFingerprint ??
        (
          templatePixels
            ? fingerprintTemplatePixels(
                entry.width,
                entry.height,
                templatePixels,
              )
            : null
        ),

      anchor:
        entry.progressAnchor
          ? [
              ...entry.progressAnchor,
            ]
          : null,

      lookupData:
        entry.lookupData,

      comparedCount:
        entry.comparedCount,

      mismatchCount:
        entry.mismatchCount,

      savedAt:
        Date.now(),
    };
  }

  function persistProgressEntry(
    entry,
  ) {
    const stored =
      makeStoredProgressRecord(
        entry,
      );

    if (!stored) {
      return;
    }

    const previous =
      state.progressStoredSlots.get(
        stored.storageKey,
      );

    const sameAnchor =
      (
        !stored.anchor &&
        !previous?.anchor
      ) ||
      (
        stored.anchor &&
        previous?.anchor &&
        progressAnchorsMatch(
          stored.anchor,
          previous.anchor,
        )
      );

    if (
      previous &&
      previous.fingerprint ===
        stored.fingerprint &&
      previous.comparedCount ===
        stored.comparedCount &&
      previous.mismatchCount ===
        stored.mismatchCount &&
      sameAnchor
    ) {
      return;
    }

    void saveProgressStoredSlot(
      stored,
    );
  }

  function makeLiveProgressEntry(
    candidate,
    slot,
  ) {
    const {
      drawInfo,
    } = candidate;

    return {
      key:
        `progress:${slot.storageKey}`,

      sourceTextureId:
        drawInfo.textureId,

      width:
        drawInfo.width,

      height:
        drawInfo.height,

      lastSeenAt:
        performance.now(),

      /*
       * Progress-only entries never need a WebGL mismatch texture. They only
       * need the fixed geographic lookup and comparison counts.
       */
      texture:
        null,

      lookupData:
        candidate.lookupData,

      ready:
        false,

      building:
        false,

      builtGeneration:
        -1,

      comparedCount:
        0,

      mismatchCount:
        0,

      buildToken:
        0,

      progressStorageKey:
        slot.storageKey,

      progressSlotIndex:
        slot.slotIndex,

      progressFingerprint:
        fingerprintTemplatePixels(
          drawInfo.width,
          drawInfo.height,
          candidate.lookupData
            .templatePixels,
        ),

      progressAnchor:
        candidate.anchor
          ? [
              ...candidate.anchor,
            ]
          : null,

      persisted:
        false,
    };
  }

  function makeProgressEntryFromStored(
    stored,
  ) {
    return {
      key:
        `stored:${stored.storageKey}`,

      sourceTextureId:
        null,

      width:
        stored.width,

      height:
        stored.height,

      lastSeenAt:
        0,

      texture:
        null,

      lookupData:
        stored.lookupData,

      ready:
        Number.isFinite(
          stored.comparedCount,
        ) &&
        stored.comparedCount > 0,

      building:
        false,

      builtGeneration:
        -1,

      comparedCount:
        Number.isFinite(
          stored.comparedCount,
        )
          ? stored.comparedCount
          : 0,

      mismatchCount:
        Number.isFinite(
          stored.mismatchCount,
        )
          ? stored.mismatchCount
          : 0,

      buildToken:
        0,

      progressStorageKey:
        stored.storageKey,

      progressSlotIndex:
        stored.slotIndex ?? 0,

      progressFingerprint:
        stored.fingerprint ?? null,

      progressAnchor:
        stored.anchor
          ? [
              ...stored.anchor,
            ]
          : null,

      persisted:
        true,
    };
  }

  async function refreshStoredProgressEntry(
    entry,
    captureToken,
  ) {
    if (
      !entry?.lookupData ||
      entry.building
    ) {
      return;
    }

    entry.building = true;

    try {
      const generation =
        artworkGeneration;

      const result =
        await buildMismatchMask(
          null,
          {
            width:
              entry.width,

            height:
              entry.height,
          },
          entry,
        );

      if (
        captureToken !==
        state.progressCaptureToken
      ) {
        return;
      }

      entry.ready = true;

      entry.builtGeneration =
        generation;

      entry.comparedCount =
        result.comparedCount;

      entry.mismatchCount =
        result.mismatchCount;

      persistProgressEntry(
        entry,
      );

      updateTemplateProgressUi();
    } catch (error) {
      state.progressLastError =
        describeError(error);

      console.warn(
        "[Wplace Template Tools] Could not refresh saved template progress.",
        error,
      );
    } finally {
      entry.building = false;
    }
  }

  void ensureProgressStorageLoaded();

  // ===========================================================================
  // MapLibre capture
  // ===========================================================================

  function looksLikeMapInstance(instance) {
    if (
      !instance ||
      typeof instance !== "object"
    ) {
      return false;
    }

    const container =
      instance._container;

    if (
      !container?.classList?.contains(
        "maplibregl-map",
      )
    ) {
      return false;
    }

    return [
      "getCanvas",
      "getCenter",
      "getZoom",
      "project",
      "unproject",
      "on",
    ].every(
      (method) =>
        typeof instance[method] ===
        "function",
    );
  }

  function waitForMapCanvas(timeoutMs) {
    const existing =
      document.querySelector(
        ".maplibregl-canvas",
      );

    if (existing) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve) => {
      const observer =
        new MutationObserver(() => {
          const canvas =
            document.querySelector(
              ".maplibregl-canvas",
            );

          if (!canvas) {
            return;
          }

          observer.disconnect();
          clearTimeout(timeout);

          resolve(canvas);
        });

      observer.observe(
        document.documentElement,
        {
          childList: true,
          subtree: true,
        },
      );

      const timeout =
        setTimeout(() => {
          observer.disconnect();
          resolve(null);
        }, timeoutMs);
    });
  }

  function captureExistingMap(timeoutMs) {
    return new Promise((resolve) => {
      const originalCall =
        Function.prototype.call;

      const originalApply =
        Function.prototype.apply;

      let settled = false;
      let timeout;

      const finish = (instance) => {
        if (settled) {
          return;
        }

        settled = true;

        clearTimeout(timeout);

        if (
          Function.prototype.call ===
          callWrapper
        ) {
          Function.prototype.call =
            originalCall;
        }

        if (
          Function.prototype.apply ===
          applyWrapper
        ) {
          Function.prototype.apply =
            originalApply;
        }

        resolve(instance);
      };

      const callWrapper = function(
        thisArgument,
        ...args
      ) {
        if (
          looksLikeMapInstance(
            thisArgument,
          )
        ) {
          finish(thisArgument);
        }

        return Reflect.apply(
          originalCall,
          this,
          [
            thisArgument,
            ...args,
          ],
        );
      };

      const applyWrapper = function(
        thisArgument,
        args
      ) {
        if (
          looksLikeMapInstance(
            thisArgument,
          )
        ) {
          finish(thisArgument);
        }

        return Reflect.apply(
          originalApply,
          this,
          [
            thisArgument,
            args,
          ],
        );
      };

      Function.prototype.call =
        callWrapper;

      Function.prototype.apply =
        applyWrapper;

      timeout =
        setTimeout(
          () => finish(null),
          timeoutMs,
        );

      globalThis.dispatchEvent(
        new Event("resize"),
      );
    });
  }

  async function getMapInstance() {
    if (
      state.map &&
      looksLikeMapInstance(
        state.map,
      )
    ) {
      return state.map;
    }

    if (state.mapPromise) {
      return state.mapPromise;
    }

    state.mapPromise =
      (async () => {
        const canvas =
          await waitForMapCanvas(
            20_000,
          );

        if (!canvas) {
          return null;
        }

        for (
          let attempt = 0;
          attempt < 3;
          attempt += 1
        ) {
          const instance =
            await captureExistingMap(
              MAP_CAPTURE_TIMEOUT_MS,
            );

          if (instance) {
            state.map = instance;

            return instance;
          }

          await delay(250);
        }

        return null;
      })();

    const result =
      await state.mapPromise;

    if (!result) {
      state.mapPromise = null;
    }

    return result;
  }

  function delay(milliseconds) {
    return new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          milliseconds,
        ),
    );
  }

  void getMapInstance();

  // ===========================================================================
  // Shader patching
  // ===========================================================================

  function isOverlayFragmentShader(source) {
    return (
      typeof source === "string" &&
      source.includes(
        "uniform bool u_highlight_enabled;",
      ) &&
      source.includes(
        "uniform vec4 u_highlight_color;",
      ) &&
      source.includes(
        "uniform float u_opacity;",
      ) &&
      source.includes(
        "uniform float u_pixel_mode_resolution;",
      ) &&
      /(?:gl_FragColor|fragment_color)\s*=\s*color\s*;/.test(
        source,
      )
    );
  }

  function addPreviewOverride(source) {
    if (
      source.includes(
        `uniform bool ${ENABLED_UNIFORM_NAME};`,
      )
    ) {
      return source;
    }

    const samplerNeedle =
      "uniform sampler2D u_texture;";

    const modeNeedle =
      "int mode = u_mode;";

    const opacityNeedle =
      "color.a *= u_opacity;";

    const modeBranchNeedle =
      "if (mode != 0) {";

    const colorNeedle =
      "color.rgb *= color.a;";

    if (
      !source.includes(
        samplerNeedle,
      ) ||
      !source.includes(
        modeNeedle,
      ) ||
      !source.includes(
        opacityNeedle,
      ) ||
      !source.includes(
        modeBranchNeedle,
      ) ||
      !source.includes(
        colorNeedle,
      )
    ) {
      console.warn(
        "[Wplace Template Tools] Overlay shader changed and could not be patched safely.",
      );

      return source;
    }

    const withUniforms =
      source.replace(
        samplerNeedle,
        [
          samplerNeedle,
          `uniform bool ${ENABLED_UNIFORM_NAME};`,
          `uniform vec3 ${COLOR_UNIFORM_NAME};`,
          `uniform sampler2D ${MASK_UNIFORM_NAME};`,
          `uniform bool ${MASK_READY_UNIFORM_NAME};`,
          `uniform float ${PULSE_BRIGHTNESS_UNIFORM_NAME};`,
          `uniform bool ${FULL_PREVIEW_UNIFORM_NAME};`,
          `uniform bool ${PLUS_PREVIEW_UNIFORM_NAME};`,
        ].join("\n"),
      );

    /*
     * Finished preview removes the center/diagonal pixel pattern.
     */
    const withPreviewMode =
      withUniforms.replace(
        modeNeedle,
        `int mode = ${FULL_PREVIEW_UNIFORM_NAME} ? 0 : u_mode;`,
      );

    /*
     * Wplace's transparent display mode also lowers u_opacity.
     * Finished preview must override that separately so switching
     * from the transparent mode still produces an opaque image.
     */
    const withPreviewOpacity =
      withPreviewMode.replace(
        opacityNeedle,
        `color.a *= ((${FULL_PREVIEW_UNIFORM_NAME} || ${PLUS_PREVIEW_UNIFORM_NAME}) ? 1.0 : u_opacity);`,
      );

    /*
     * Plus preview keeps a centered cross inside each template pixel.
     * The arms stop short of the pixel edges so neighboring crosses
     * stay visually separate.
     */
    const withPlusPreview =
      withPreviewOpacity.replace(
        modeBranchNeedle,
        [
          `if (${PLUS_PREVIEW_UNIFORM_NAME}) {`,
          `  float wptt_arm_inset = 0.125;`,
          `  float wptt_half_thickness = 0.125;`,
          `  float wptt_arm_length = 1.0 - 2.0 * wptt_arm_inset;`,
          `  float wptt_bar_thickness = 2.0 * wptt_half_thickness;`,
          `  float wptt_coverage =`,
          `    2.0 * wptt_bar_thickness * wptt_arm_length -`,
          `    wptt_bar_thickness * wptt_bar_thickness;`,
          ``,
          `  if (!pixel_mode_detail_supported || pixels_per_source < 3.0) {`,
          `    color.a *= wptt_coverage;`,
          `  } else {`,
          `    vec2 wptt_local = fract(source_coordinate + vec2(0.00001));`,
          ``,
          `    bool wptt_vertical =`,
          `      abs(wptt_local.x - 0.5) <= wptt_half_thickness &&`,
          `      wptt_local.y >= wptt_arm_inset &&`,
          `      wptt_local.y <= 1.0 - wptt_arm_inset;`,
          ``,
          `    bool wptt_horizontal =`,
          `      abs(wptt_local.y - 0.5) <= wptt_half_thickness &&`,
          `      wptt_local.x >= wptt_arm_inset &&`,
          `      wptt_local.x <= 1.0 - wptt_arm_inset;`,
          ``,
          `    if (!wptt_vertical && !wptt_horizontal) {`,
          `      discard;`,
          `    }`,
          `  }`,
          `} else if (mode != 0) {`,
        ].join("\n"),
      );

    return withPlusPreview.replace(
      colorNeedle,
      [
        `if (${ENABLED_UNIFORM_NAME} && ${MASK_READY_UNIFORM_NAME}) {`,
        `  float wptt_mismatch = texture(`,
        `    ${MASK_UNIFORM_NAME},`,
        `    (source_pixel + 0.5) / u_source_size`,
        `  ).r;`,
        ``,
        `  if (wptt_mismatch > 0.5) {`,
        `    color.rgb = ${COLOR_UNIFORM_NAME} * ${PULSE_BRIGHTNESS_UNIFORM_NAME};`,
        `  }`,
        `}`,
        colorNeedle,
      ].join("\n"),
    );
  }

  // ===========================================================================
  // Overlay program tracking
  // ===========================================================================

  function trackOverlayProgram(
    gl,
    program,
    native,
  ) {
    let attachedShaders;

    try {
      attachedShaders =
        native.getAttachedShaders.call(
          gl,
          program,
        ) ?? [];
    } catch {
      return;
    }

    if (
      !attachedShaders.some(
        (shader) =>
          state.patchedShaders.has(
            shader,
          ),
      )
    ) {
      return;
    }

    const locations = {
      enabled:
        native.getUniformLocation.call(
          gl,
          program,
          ENABLED_UNIFORM_NAME,
        ),

      previewColor:
        native.getUniformLocation.call(
          gl,
          program,
          COLOR_UNIFORM_NAME,
        ),

      mask:
        native.getUniformLocation.call(
          gl,
          program,
          MASK_UNIFORM_NAME,
        ),

      maskReady:
        native.getUniformLocation.call(
          gl,
          program,
          MASK_READY_UNIFORM_NAME,
        ),

      pulseBrightness:
        native.getUniformLocation.call(
          gl,
          program,
          PULSE_BRIGHTNESS_UNIFORM_NAME,
        ),

      fullPreview:
        native.getUniformLocation.call(
          gl,
          program,
          FULL_PREVIEW_UNIFORM_NAME,
        ),

      plusPreview:
        native.getUniformLocation.call(
          gl,
          program,
          PLUS_PREVIEW_UNIFORM_NAME,
        ),

      texture:
        native.getUniformLocation.call(
          gl,
          program,
          "u_texture",
        ),

      sourceSize:
        native.getUniformLocation.call(
          gl,
          program,
          "u_source_size",
        ),

      matrix:
        native.getUniformLocation.call(
          gl,
          program,
          "u_matrix",
        ),

      worldSize:
        native.getUniformLocation.call(
          gl,
          program,
          "u_world_size",
        ),

      topLeft:
        native.getUniformLocation.call(
          gl,
          program,
          "u_top_left",
        ),

      topRight:
        native.getUniformLocation.call(
          gl,
          program,
          "u_top_right",
        ),

      bottomRight:
        native.getUniformLocation.call(
          gl,
          program,
          "u_bottom_right",
        ),

      bottomLeft:
        native.getUniformLocation.call(
          gl,
          program,
          "u_bottom_left",
        ),
    };

    if (
      locations.enabled === null ||
      locations.previewColor === null ||
      locations.mask === null ||
      locations.maskReady === null ||
      locations.pulseBrightness === null ||
      locations.fullPreview === null ||
      locations.plusPreview === null ||
      locations.matrix === null ||
      locations.worldSize === null
    ) {
      console.warn(
        "[Wplace Template Tools] Required overlay uniforms did not link correctly.",
      );

      return;
    }

    const previousRecord =
      state.programRecords.get(
        program,
      );

    if (previousRecord) {
      cleanupProgramRecord(
        previousRecord,
      );
    }

    const record = {
      gl,
      native,
      program,
      locations,

      maskCache: new Map(),

      maxTextureUnits:
        native.getParameter.call(
          gl,
          gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS,
        ),
    };

    state.programRecords.set(
      program,
      record,
    );

    state.records.add(record);

    setProgramUniforms(record);
  }

  function setProgramUniforms(record) {
    const {
      gl,
      native,
      program,
      locations,
    } = record;

    try {
      if (
        native.isContextLost?.call(gl)
      ) {
        return;
      }

      const previousProgram =
        native.getParameter.call(
          gl,
          gl.CURRENT_PROGRAM,
        );

      native.useProgram.call(
        gl,
        program,
      );

      native.uniform1i.call(
        gl,
        locations.enabled,
        state.highlightMode !==
          HIGHLIGHT_OFF
          ? 1
          : 0,
      );

      native.uniform3f.call(
        gl,
        locations.previewColor,
        state.color.rgb[0],
        state.color.rgb[1],
        state.color.rgb[2],
      );

      native.uniform1f.call(
        gl,
        locations.pulseBrightness,
        state.pulseBrightness,
      );

      native.uniform1i.call(
        gl,
        locations.fullPreview,
        state.fullPreviewEnabled ? 1 : 0,
      );

      native.uniform1i.call(
        gl,
        locations.plusPreview,
        state.plusPreviewEnabled ? 1 : 0,
      );

      native.useProgram.call(
        gl,
        previousProgram,
      );
    } catch (error) {
      console.warn(
        "[Wplace Template Tools] Could not update overlay uniforms.",
        error,
      );
    }
  }

  function setPulseBrightnessUniform(
    record,
    brightness,
  ) {
    const {
      gl,
      native,
      program,
      locations,
    } = record;

    try {
      if (
        native.isContextLost?.call(gl)
      ) {
        return;
      }

      const previousProgram =
        native.getParameter.call(
          gl,
          gl.CURRENT_PROGRAM,
        );

      native.useProgram.call(
        gl,
        program,
      );

      native.uniform1f.call(
        gl,
        locations.pulseBrightness,
        brightness,
      );

      native.useProgram.call(
        gl,
        previousProgram,
      );
    } catch {
      // Animation should never interfere with Wplace.
    }
  }

  function cleanupProgramRecord(
    record,
  ) {
    state.records.delete(record);

    for (
      const entry of
      record.maskCache.values()
    ) {
      if (!entry.texture) {
        continue;
      }

      try {
        record.native.deleteTexture.call(
          record.gl,
          entry.texture,
        );
      } catch {
        // Context may already be gone.
      }
    }

    record.maskCache.clear();
  }

  // ===========================================================================
  // Current template draw
  // ===========================================================================

  function getTextureId(texture) {
    let id =
      textureIds.get(texture);

    if (!id) {
      id = nextTextureId++;

      textureIds.set(
        texture,
        id,
      );
    }

    return id;
  }

  function readVec2(
    native,
    gl,
    program,
    location,
  ) {
    if (location === null) {
      return null;
    }

    const value =
      native.getUniform.call(
        gl,
        program,
        location,
      );

    if (
      !value ||
      value.length < 2
    ) {
      return null;
    }

    return [
      Number(value[0]),
      Number(value[1]),
    ];
  }

  function readMat4(
    native,
    gl,
    program,
    location,
  ) {
    if (location === null) {
      return null;
    }

    const value =
      native.getUniform.call(
        gl,
        program,
        location,
      );

    if (
      !value ||
      value.length !== 16
    ) {
      return null;
    }

    return Array.from(
      value,
      Number,
    );
  }

  function readNumber(
    native,
    gl,
    program,
    location,
  ) {
    if (location === null) {
      return null;
    }

    const value =
      Number(
        native.getUniform.call(
          gl,
          program,
          location,
        ),
      );

    return Number.isFinite(value)
      ? value
      : null;
  }

  function inspectOverlayDraw(
    record,
  ) {
    const {
      gl,
      native,
      program,
      locations,
    } = record;

    try {
      const sourceSize =
        readVec2(
          native,
          gl,
          program,
          locations.sourceSize,
        );

      const matrix =
        readMat4(
          native,
          gl,
          program,
          locations.matrix,
        );

      const worldSize =
        readNumber(
          native,
          gl,
          program,
          locations.worldSize,
        );

      const topLeft =
        readVec2(
          native,
          gl,
          program,
          locations.topLeft,
        );

      const topRight =
        readVec2(
          native,
          gl,
          program,
          locations.topRight,
        );

      const bottomRight =
        readVec2(
          native,
          gl,
          program,
          locations.bottomRight,
        );

      const bottomLeft =
        readVec2(
          native,
          gl,
          program,
          locations.bottomLeft,
        );

      if (
        !sourceSize ||
        !matrix ||
        worldSize === null ||
        !topLeft ||
        !topRight ||
        !bottomRight ||
        !bottomLeft ||
        locations.texture === null
      ) {
        return null;
      }

      const width =
        Math.round(
          sourceSize[0],
        );

      const height =
        Math.round(
          sourceSize[1],
        );

      if (
        width <= 0 ||
        height <= 0
      ) {
        return null;
      }

      const samplerUnit =
        Number(
          native.getUniform.call(
            gl,
            program,
            locations.texture,
          ),
        );

      if (
        !Number.isFinite(
          samplerUnit,
        )
      ) {
        return null;
      }

      const previousActiveTexture =
        native.getParameter.call(
          gl,
          gl.ACTIVE_TEXTURE,
        );

      native.activeTexture.call(
        gl,
        gl.TEXTURE0 +
          samplerUnit,
      );

      const texture =
        native.getParameter.call(
          gl,
          gl.TEXTURE_BINDING_2D,
        );

      native.activeTexture.call(
        gl,
        previousActiveTexture,
      );

      if (!texture) {
        return null;
      }

      const textureId =
        getTextureId(texture);

      const key =
        [
          textureId,
          width,
          height,
          ...topLeft,
          ...topRight,
          ...bottomRight,
          ...bottomLeft,
        ]
          .map((value) =>
            Number(value).toFixed(
              10,
            ),
          )
          .join("|");

      return {
        key,

        texture,
        textureId,
        samplerUnit,

        width,
        height,

        matrix,
        worldSize,

        topLeft,
        topRight,
        bottomRight,
        bottomLeft,
      };
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // Template texture readback
  // ===========================================================================

  function getTextureContentVersion(
    texture,
  ) {
    return (
      textureContentVersions.get(
        texture,
      ) ?? 0
    );
  }

  function markTextureContentChanged(
    texture,
  ) {
    if (!texture) {
      return;
    }

    textureContentVersions.set(
      texture,
      getTextureContentVersion(
        texture,
      ) + 1,
    );

    /*
     * Wplace can reuse one WebGL texture object for a different template.
     * That is especially easy to miss when both images have the same size.
     * Clear the readback cache as soon as new texture content is uploaded.
     */
    templatePixelCache.delete(
      texture,
    );
  }

  function readTemplatePixels(
    record,
    drawInfo,
  ) {
    const contentVersion =
      getTextureContentVersion(
        drawInfo.texture,
      );

    const cached =
      templatePixelCache.get(
        drawInfo.texture,
      );

    if (
      cached &&
      cached.width ===
        drawInfo.width &&
      cached.height ===
        drawInfo.height &&
      cached.contentVersion ===
        contentVersion
    ) {
      return cached.data;
    }

    const {
      gl,
      native,
    } = record;

    const framebuffer =
      native.createFramebuffer.call(
        gl,
      );

    if (!framebuffer) {
      throw new Error(
        "Could not create framebuffer for template readback",
      );
    }

    const previousFramebuffer =
      native.getParameter.call(
        gl,
        gl.FRAMEBUFFER_BINDING,
      );

    try {
      native.bindFramebuffer.call(
        gl,
        gl.FRAMEBUFFER,
        framebuffer,
      );

      native.framebufferTexture2D.call(
        gl,
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        drawInfo.texture,
        0,
      );

      const status =
        native.checkFramebufferStatus.call(
          gl,
          gl.FRAMEBUFFER,
        );

      if (
        status !==
        gl.FRAMEBUFFER_COMPLETE
      ) {
        throw new Error(
          `Template framebuffer incomplete: ${status}`,
        );
      }

      const pixels =
        new Uint8Array(
          drawInfo.width *
            drawInfo.height *
            4,
        );

      native.readPixels.call(
        gl,
        0,
        0,
        drawInfo.width,
        drawInfo.height,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );

      templatePixelCache.set(
        drawInfo.texture,
        {
          width:
            drawInfo.width,

          height:
            drawInfo.height,

          contentVersion,

          data:
            pixels,
        },
      );

      return pixels;
    } finally {
      native.bindFramebuffer.call(
        gl,
        gl.FRAMEBUFFER,
        previousFramebuffer,
      );

      native.deleteFramebuffer.call(
        gl,
        framebuffer,
      );
    }
  }

  // ===========================================================================
  // Template coordinates
  // ===========================================================================

  function lerp(a, b, t) {
    return (
      a +
      (b - a) * t
    );
  }

  function getTemplateLocalPosition(
    drawInfo,
    x,
    y,
  ) {
    const u =
      (x + 0.5) /
      drawInfo.width;

    const v =
      (y + 0.5) /
      drawInfo.height;

    const topX =
      lerp(
        drawInfo.topLeft[0],
        drawInfo.topRight[0],
        u,
      );

    const topY =
      lerp(
        drawInfo.topLeft[1],
        drawInfo.topRight[1],
        u,
      );

    const bottomX =
      lerp(
        drawInfo.bottomLeft[0],
        drawInfo.bottomRight[0],
        u,
      );

    const bottomY =
      lerp(
        drawInfo.bottomLeft[1],
        drawInfo.bottomRight[1],
        u,
      );

    return [
      lerp(
        topX,
        bottomX,
        v,
      ),

      lerp(
        topY,
        bottomY,
        v,
      ),
    ];
  }

  function transformLocalToClip(
    drawInfo,
    localX,
    localY,
  ) {
    const m =
      drawInfo.matrix;

    const x =
      localX *
      drawInfo.worldSize;

    const y =
      localY *
      drawInfo.worldSize;

    return [
      m[0] * x +
        m[4] * y +
        m[12],

      m[1] * x +
        m[5] * y +
        m[13],

      m[2] * x +
        m[6] * y +
        m[14],

      m[3] * x +
        m[7] * y +
        m[15],
    ];
  }

  function clipToMapScreenPoint(
    record,
    clip,
  ) {
    const {
      gl,
      native,
    } = record;

    const [
      clipX,
      clipY,
      ,
      clipW,
    ] = clip;

    if (
      !Number.isFinite(clipW) ||
      Math.abs(clipW) <
        1e-12
    ) {
      return null;
    }

    const ndcX =
      clipX / clipW;

    const ndcY =
      clipY / clipW;

    if (
      !Number.isFinite(ndcX) ||
      !Number.isFinite(ndcY)
    ) {
      return null;
    }

    const viewport =
      native.getParameter.call(
        gl,
        gl.VIEWPORT,
      );

    if (
      !viewport ||
      viewport.length < 4
    ) {
      return null;
    }

    const framebufferX =
      Number(viewport[0]) +
      ((ndcX + 1) / 2) *
        Number(viewport[2]);

    const framebufferY =
      Number(viewport[1]) +
      ((ndcY + 1) / 2) *
        Number(viewport[3]);

    const canvas =
      gl.canvas;

    const drawingWidth =
      gl.drawingBufferWidth;

    const drawingHeight =
      gl.drawingBufferHeight;

    const cssWidth =
      canvas?.clientWidth ?? 0;

    const cssHeight =
      canvas?.clientHeight ?? 0;

    if (
      !canvas ||
      drawingWidth <= 0 ||
      drawingHeight <= 0 ||
      cssWidth <= 0 ||
      cssHeight <= 0
    ) {
      return null;
    }

    return [
      (
        framebufferX /
        drawingWidth
      ) *
        cssWidth,

      (
        1 -
        framebufferY /
          drawingHeight
      ) *
        cssHeight,
    ];
  }

  function templatePixelToLngLat(
    record,
    drawInfo,
    map,
    x,
    y,
  ) {
    const [
      localX,
      localY,
    ] =
      getTemplateLocalPosition(
        drawInfo,
        x,
        y,
      );

    const clip =
      transformLocalToClip(
        drawInfo,
        localX,
        localY,
      );

    const screen =
      clipToMapScreenPoint(
        record,
        clip,
      );

    if (!screen) {
      return null;
    }

    const lngLat =
      map.unproject(screen);

    if (
      !lngLat ||
      !Number.isFinite(
        lngLat.lng,
      ) ||
      !Number.isFinite(
        lngLat.lat,
      )
    ) {
      return null;
    }

    return {
      lng:
        lngLat.lng,

      lat:
        lngLat.lat,
    };
  }

  // ===========================================================================
  // Geographic coordinate -> artwork tile
  // ===========================================================================

  function longitudeToTileX(
    longitude,
  ) {
    return (
      ((longitude + 180) /
        360) *
      ARTWORK_TILE_COUNT
    );
  }

  function latitudeToTileY(
    latitude,
  ) {
    const clamped =
      Math.max(
        -85.05112878,
        Math.min(
          85.05112878,
          latitude,
        ),
      );

    const radians =
      (clamped * Math.PI) /
      180;

    return (
      (
        1 -
        Math.log(
          Math.tan(radians) +
            1 /
              Math.cos(
                radians,
              ),
        ) /
          Math.PI
      ) /
      2
    ) *
    ARTWORK_TILE_COUNT;
  }

  function lngLatToArtworkTile(
    longitude,
    latitude,
  ) {
    const tileXFloat =
      longitudeToTileX(
        longitude,
      );

    const tileYFloat =
      latitudeToTileY(
        latitude,
      );

    const rawTileX =
      Math.floor(
        tileXFloat,
      );

    const tileY =
      Math.floor(
        tileYFloat,
      );

    if (
      tileY < 0 ||
      tileY >=
        ARTWORK_TILE_COUNT
    ) {
      return null;
    }

    const tileX =
      positiveModulo(
        rawTileX,
        ARTWORK_TILE_COUNT,
      );

    return {
      key:
        `${tileX}/${tileY}`,

      tileX,
      tileY,

      fractionalX:
        tileXFloat -
        Math.floor(
          tileXFloat,
        ),

      fractionalY:
        tileYFloat -
        Math.floor(
          tileYFloat,
        ),
    };
  }

  function positiveModulo(
    value,
    divisor,
  ) {
    return (
      ((value % divisor) +
        divisor) %
      divisor
    );
  }

  // ===========================================================================
  // Geographic lookup cache
  // ===========================================================================

  function buildLookupDataWithMap(
    record,
    drawInfo,
    map,
    templatePixels,
  ) {
    const lookups =
      new Array(
        drawInfo.width *
          drawInfo.height,
      );

    const requiredTiles =
      new Map();

    for (
      let y = 0;
      y < drawInfo.height;
      y += 1
    ) {
      for (
        let x = 0;
        x < drawInfo.width;
        x += 1
      ) {
        const pixelIndex =
          y *
            drawInfo.width +
          x;

        const offset =
          pixelIndex * 4;

        if (
          templatePixels[
            offset + 3
          ] < 1
        ) {
          continue;
        }

        const geographic =
          templatePixelToLngLat(
            record,
            drawInfo,
            map,
            x,
            y,
          );

        if (!geographic) {
          continue;
        }

        const address =
          lngLatToArtworkTile(
            geographic.lng,
            geographic.lat,
          );

        if (!address) {
          continue;
        }

        lookups[pixelIndex] =
          address;

        requiredTiles.set(
          address.key,
          {
            x:
              address.tileX,

            y:
              address.tileY,
          },
        );
      }
    }

    return {
      templatePixels,
      lookups,

      requiredTiles: [
        ...requiredTiles.entries(),
      ],
    };
  }

  async function buildLookupData(
    record,
    drawInfo,
  ) {
    const map =
      await getMapInstance();

    if (!map) {
      throw new Error(
        "MapLibre map instance is not available",
      );
    }

    const templatePixels =
      readTemplatePixels(
        record,
        drawInfo,
      );

    return buildLookupDataWithMap(
      record,
      drawInfo,
      map,
      templatePixels,
    );
  }

  // ===========================================================================
  // Artwork PNG loading
  // ===========================================================================

  async function loadArtworkTile(
    tileX,
    tileY,
  ) {
    const cacheKey =
      `${artworkGeneration}:${tileX}/${tileY}`;

    const cached =
      artworkTileCache.get(
        cacheKey,
      );

    if (cached) {
      return cached;
    }

    const promise =
      fetch(
        `${ARTWORK_TILE_ROOT}/${tileX}/${tileY}.png?wptt=${artworkGeneration}`,
        {
          cache: "no-store",
        },
      )
        .then(
          async (
            response,
          ) => {
            if (
              response.status ===
              404
            ) {
              return null;
            }

            if (
              !response.ok
            ) {
              throw new Error(
                `Artwork tile ${tileX}/${tileY} returned HTTP ${response.status}`,
              );
            }

            return decodeArtworkTile(
              await response.blob(),
            );
          },
        )
        .catch(
          (error) => {
            console.warn(
              `[Wplace Template Tools] Could not load artwork tile ${tileX}/${tileY}.`,
              error,
            );

            return null;
          },
        );

    artworkTileCache.set(
      cacheKey,
      promise,
    );

    return promise;
  }

  async function decodeArtworkTile(
    blob,
  ) {
    let bitmap;

    try {
      bitmap =
        await createImageBitmap(
          blob,
          {
            colorSpaceConversion:
              "none",
          },
        );
    } catch {
      bitmap =
        await createImageBitmap(
          blob,
        );
    }

    try {
      let canvas;
      let context;

      if (
        typeof OffscreenCanvas !==
        "undefined"
      ) {
        canvas =
          new OffscreenCanvas(
            bitmap.width,
            bitmap.height,
          );

        context =
          canvas.getContext(
            "2d",
            {
              willReadFrequently:
                true,
            },
          );
      } else {
        canvas =
          document.createElement(
            "canvas",
          );

        canvas.width =
          bitmap.width;

        canvas.height =
          bitmap.height;

        context =
          canvas.getContext(
            "2d",
            {
              willReadFrequently:
                true,
            },
          );
      }

      if (!context) {
        throw new Error(
          "Could not create artwork tile canvas",
        );
      }

      context.clearRect(
        0,
        0,
        bitmap.width,
        bitmap.height,
      );

      context.drawImage(
        bitmap,
        0,
        0,
      );

      const imageData =
        context.getImageData(
          0,
          0,
          bitmap.width,
          bitmap.height,
        );

      return {
        width:
          bitmap.width,

        height:
          bitmap.height,

        data:
          imageData.data,
      };
    } finally {
      bitmap.close?.();
    }
  }

  // ===========================================================================
  // Mismatch comparison
  // ===========================================================================

  async function buildMismatchMask(
    record,
    drawInfo,
    entry,
  ) {
    if (!entry.lookupData) {
      entry.lookupData =
        await buildLookupData(
          record,
          drawInfo,
        );
    }

    const {
      templatePixels,
      lookups,
      requiredTiles,
    } = entry.lookupData;

    const loadedTiles =
      new Map();

    await mapWithConcurrency(
      requiredTiles,
      TILE_FETCH_CONCURRENCY,
      async ([
        key,
        tile,
      ]) => {
        const image =
          await loadArtworkTile(
            tile.x,
            tile.y,
          );

        loadedTiles.set(
          key,
          image,
        );
      },
    );

    const mask =
      new Uint8Array(
        drawInfo.width *
          drawInfo.height *
          4,
      );

    let comparedCount = 0;
    let mismatchCount = 0;

    for (
      let y = 0;
      y < drawInfo.height;
      y += 1
    ) {
      for (
        let x = 0;
        x < drawInfo.width;
        x += 1
      ) {
        const pixelIndex =
          y *
            drawInfo.width +
          x;

        const offset =
          pixelIndex * 4;

        mask[
          offset + 3
        ] = 255;

        if (
          templatePixels[
            offset + 3
          ] < 1
        ) {
          continue;
        }

        comparedCount += 1;

        const address =
          lookups[pixelIndex];

        if (!address) {
          mask[offset] = 255;
          mismatchCount += 1;
          continue;
        }

        const tile =
          loadedTiles.get(
            address.key,
          );

        let matches = false;

        if (tile) {
          const tilePixelX =
            clampInteger(
              Math.floor(
                address.fractionalX *
                  tile.width,
              ),
              0,
              tile.width - 1,
            );

          const tilePixelY =
            clampInteger(
              Math.floor(
                address.fractionalY *
                  tile.height,
              ),
              0,
              tile.height - 1,
            );

          const tileOffset =
            (
              tilePixelY *
                tile.width +
              tilePixelX
            ) *
            4;

          if (
            tile.data[
              tileOffset + 3
            ] > 0
          ) {
            matches =
              colorMatches(
                templatePixels[
                  offset
                ],
                templatePixels[
                  offset + 1
                ],
                templatePixels[
                  offset + 2
                ],

                tile.data[
                  tileOffset
                ],
                tile.data[
                  tileOffset + 1
                ],
                tile.data[
                  tileOffset + 2
                ],
              );
          }
        }

        if (!matches) {
          mask[offset] = 255;
          mismatchCount += 1;
        }
      }
    }

    return {
      mask,
      comparedCount,
      mismatchCount,
    };
  }

  function colorMatches(
    r1,
    g1,
    b1,
    r2,
    g2,
    b2,
  ) {
    return (
      Math.abs(r1 - r2) <=
        COLOR_TOLERANCE &&
      Math.abs(g1 - g2) <=
        COLOR_TOLERANCE &&
      Math.abs(b1 - b2) <=
        COLOR_TOLERANCE
    );
  }

  function clampInteger(
    value,
    min,
    max,
  ) {
    return Math.max(
      min,
      Math.min(
        max,
        value,
      ),
    );
  }

  async function mapWithConcurrency(
    values,
    concurrency,
    worker,
  ) {
    let nextIndex = 0;

    async function runWorker() {
      while (true) {
        const index =
          nextIndex++;

        if (
          index >=
          values.length
        ) {
          return;
        }

        await worker(
          values[index],
        );
      }
    }

    const count =
      Math.min(
        concurrency,
        values.length,
      );

    await Promise.all(
      Array.from(
        {
          length: count,
        },
        () => runWorker(),
      ),
    );
  }

  // ===========================================================================
  // Mask texture
  // ===========================================================================

  function uploadMaskTexture(
    record,
    entry,
    drawInfo,
    mask,
  ) {
    const {
      gl,
      native,
    } = record;

    const previousActiveTexture =
      native.getParameter.call(
        gl,
        gl.ACTIVE_TEXTURE,
      );

    native.activeTexture.call(
      gl,
      gl.TEXTURE0,
    );

    const previousTexture =
      native.getParameter.call(
        gl,
        gl.TEXTURE_BINDING_2D,
      );

    try {
      if (!entry.texture) {
        entry.texture =
          native.createTexture.call(
            gl,
          );

        if (!entry.texture) {
          throw new Error(
            "Could not create mismatch texture",
          );
        }
      }

      native.bindTexture.call(
        gl,
        gl.TEXTURE_2D,
        entry.texture,
      );

      native.texParameteri.call(
        gl,
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.NEAREST,
      );

      native.texParameteri.call(
        gl,
        gl.TEXTURE_2D,
        gl.TEXTURE_MAG_FILTER,
        gl.NEAREST,
      );

      native.texParameteri.call(
        gl,
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_S,
        gl.CLAMP_TO_EDGE,
      );

      native.texParameteri.call(
        gl,
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_T,
        gl.CLAMP_TO_EDGE,
      );

      native.texImage2D.call(
        gl,
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        drawInfo.width,
        drawInfo.height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        mask,
      );
    } finally {
      native.bindTexture.call(
        gl,
        gl.TEXTURE_2D,
        previousTexture,
      );

      native.activeTexture.call(
        gl,
        previousActiveTexture,
      );
    }
  }

  // ===========================================================================
  // Comparison cache
  // ===========================================================================

  function getMaskEntry(
    record,
    drawInfo,
  ) {
    let entry =
      record.maskCache.get(
        drawInfo.key,
      );

    if (!entry) {
      entry = {
        key:
          drawInfo.key,

        texture:
          null,

        lookupData:
          null,

        ready:
          false,

        building:
          false,

        builtGeneration:
          -1,

        comparedCount:
          0,

        mismatchCount:
          0,

        buildToken:
          0,
      };

      record.maskCache.set(
        drawInfo.key,
        entry,
      );

      pruneMaskCache(
        record,
        drawInfo.key,
      );
    }

    return entry;
  }

  function pruneMaskCache(
    record,
    preserveKey,
  ) {
    if (
      record.maskCache.size <=
      MAX_MASKS_PER_PROGRAM
    ) {
      return;
    }

    const candidates = [
      ...record.maskCache.values(),
    ].filter(
      (entry) =>
        entry.key !==
          preserveKey &&
        !entry.building,
    );

    while (
      record.maskCache.size >
        MAX_MASKS_PER_PROGRAM &&
      candidates.length
    ) {
      const entry =
        candidates.shift();

      record.maskCache.delete(
        entry.key,
      );

      if (entry.texture) {
        try {
          record.native.deleteTexture.call(
            record.gl,
            entry.texture,
          );
        } catch {
          // Ignore cleanup errors.
        }
      }
    }
  }

  function scheduleMaskBuild(
    record,
    drawInfo,
    entry,
  ) {
    if (
      entry.building ||
      (
        entry.ready &&
        entry.builtGeneration ===
          artworkGeneration
      )
    ) {
      return;
    }

    entry.building = true;

    const token =
      ++entry.buildToken;

    const buildDrawInfo = {
      ...drawInfo,

      matrix: [
        ...drawInfo.matrix,
      ],

      topLeft: [
        ...drawInfo.topLeft,
      ],

      topRight: [
        ...drawInfo.topRight,
      ],

      bottomRight: [
        ...drawInfo.bottomRight,
      ],

      bottomLeft: [
        ...drawInfo.bottomLeft,
      ],
    };

    queueMicrotask(
      async () => {
        try {
          const generation =
            artworkGeneration;

          const result =
            await buildMismatchMask(
              record,
              buildDrawInfo,
              entry,
            );

          if (
            token !==
            entry.buildToken
          ) {
            return;
          }

          uploadMaskTexture(
            record,
            entry,
            buildDrawInfo,
            result.mask,
          );

          entry.ready = true;

          entry.builtGeneration =
            generation;

          entry.comparedCount =
            result.comparedCount;

          entry.mismatchCount =
            result.mismatchCount;

          if (
            entry.persistProgressAfterBuild
          ) {
            entry.persistProgressAfterBuild =
              false;

            persistProgressEntry(
              entry,
            );
          }

          updateTemplateProgressUi();
          requestMapRepaint();
        } catch (error) {
          state.progressLastError =
            error instanceof Error
              ? `${error.name}: ${error.message}`
              : String(error);

          console.warn(
            "[Wplace Template Tools] Could not update unfinished-pixel comparison.",
            error,
          );
        } finally {
          if (
            token ===
            entry.buildToken
          ) {
            entry.building =
              false;
          }
        }
      },
    );
  }

  // ===========================================================================
  // Bind comparison mask
  // ===========================================================================

  function bindComparisonForDraw(
    record,
    drawInfo,
    entry,
  ) {
    const {
      gl,
      native,
      locations,
    } = record;

    if (
      !entry?.ready ||
      !entry.texture
    ) {
      native.uniform1i.call(
        gl,
        locations.maskReady,
        0,
      );

      return () => {};
    }

    let maskUnit =
      record.maxTextureUnits -
      1;

    if (
      maskUnit ===
      drawInfo.samplerUnit
    ) {
      maskUnit -= 1;
    }

    if (maskUnit < 0) {
      native.uniform1i.call(
        gl,
        locations.maskReady,
        0,
      );

      return () => {};
    }

    const previousActiveTexture =
      native.getParameter.call(
        gl,
        gl.ACTIVE_TEXTURE,
      );

    native.activeTexture.call(
      gl,
      gl.TEXTURE0 + maskUnit,
    );

    const previousTexture =
      native.getParameter.call(
        gl,
        gl.TEXTURE_BINDING_2D,
      );

    native.bindTexture.call(
      gl,
      gl.TEXTURE_2D,
      entry.texture,
    );

    native.uniform1i.call(
      gl,
      locations.mask,
      maskUnit,
    );

    native.uniform1i.call(
      gl,
      locations.maskReady,
      1,
    );

    return () => {
      native.bindTexture.call(
        gl,
        gl.TEXTURE_2D,
        previousTexture,
      );

      native.activeTexture.call(
        gl,
        previousActiveTexture,
      );
    };
  }

  // ===========================================================================
  // Draw interception
  // ===========================================================================

  function cloneDrawInfo(drawInfo) {
    return {
      ...drawInfo,

      matrix: [
        ...drawInfo.matrix,
      ],

      topLeft: [
        ...drawInfo.topLeft,
      ],

      topRight: [
        ...drawInfo.topRight,
      ],

      bottomRight: [
        ...drawInfo.bottomRight,
      ],

      bottomLeft: [
        ...drawInfo.bottomLeft,
      ],
    };
  }

  function getDrawScreenArea(
    record,
    drawInfo,
  ) {
    const corners = [
      drawInfo.topLeft,
      drawInfo.topRight,
      drawInfo.bottomRight,
      drawInfo.bottomLeft,
    ];

    const points = [];

    for (const corner of corners) {
      const clip =
        transformLocalToClip(
          drawInfo,
          corner[0],
          corner[1],
        );

      const point =
        clipToMapScreenPoint(
          record,
          clip,
        );

      if (!point) {
        return 0;
      }

      points.push(point);
    }

    let twiceArea = 0;

    for (
      let index = 0;
      index < points.length;
      index += 1
    ) {
      const current =
        points[index];

      const next =
        points[
          (index + 1) %
            points.length
        ];

      twiceArea +=
        current[0] * next[1] -
        next[0] * current[1];
    }

    const area =
      Math.abs(twiceArea) / 2;

    return Number.isFinite(area)
      ? area
      : 0;
  }

  function getProgressAnchor(
    record,
    drawInfo,
    map,
  ) {
    if (
      !map ||
      !looksLikeMapInstance(map)
    ) {
      return null;
    }

    const geographic =
      templatePixelToLngLat(
        record,
        drawInfo,
        map,
        (
          drawInfo.width -
          1
        ) /
          2,
        (
          drawInfo.height -
          1
        ) /
          2,
      );

    if (!geographic) {
      return null;
    }

    return [
      longitudeToTileX(
        geographic.lng,
      ),
      latitudeToTileY(
        geographic.lat,
      ),
    ];
  }

  function progressAnchorsMatch(
    first,
    second,
  ) {
    if (
      !first ||
      !second
    ) {
      return false;
    }

    return (
      Math.abs(
        first[0] -
          second[0],
      ) <
        0.000001 &&
      Math.abs(
        first[1] -
          second[1],
      ) <
        0.000001
    );
  }

  function snapshotProgressLookup(
    record,
    drawInfo,
  ) {
    const map =
      state.map;

    if (
      !map ||
      !looksLikeMapInstance(map)
    ) {
      return null;
    }

    const templatePixels =
      readTemplatePixels(
        record,
        drawInfo,
      );

    return {
      anchor:
        getProgressAnchor(
          record,
          drawInfo,
          map,
        ),

      lookupData:
        buildLookupDataWithMap(
          record,
          drawInfo,
          map,
          templatePixels,
        ),
    };
  }

  function applyProgressSnapshot(
    candidate,
    record,
    drawInfo,
  ) {
    try {
      const snapshot =
        snapshotProgressLookup(
          record,
          drawInfo,
        );

      if (!snapshot) {
        return false;
      }

      candidate.anchor =
        snapshot.anchor;

      candidate.lookupData =
        snapshot.lookupData;

      return true;
    } catch (error) {
      state.progressLastError =
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error);

      console.warn(
        "[Wplace Template Tools] Could not snapshot template placement for progress.",
        error,
      );

      return false;
    }
  }

  function recordProgressCandidate(
    record,
    drawInfo,
  ) {
    /*
     * Cache the template image and its artwork-tile lookup while the matching
     * map draw is live. Progress later uses those fixed tile locations instead
     * of combining old draw geometry with a newer map camera.
     */
    const area =
      getDrawScreenArea(
        record,
        drawInfo,
      );

    if (area <= 0) {
      return;
    }

    const textureId =
      drawInfo.textureId;

    const textureContentVersion =
      getTextureContentVersion(
        drawInfo.texture,
      );

    const candidateKey =
      `${textureId}:${textureContentVersion}`;

    const now =
      performance.now();

    const existing =
      state.progressCaptureCandidates.get(
        candidateKey,
      );

    if (!existing) {
      const candidate = {
        record,
        drawInfo:
          cloneDrawInfo(
            drawInfo,
          ),
        area,
        lastSeenAt: now,
        order:
          state.progressCaptureSequence++,
        anchor:
          null,
        lookupData:
          null,
        textureContentVersion,
      };

      applyProgressSnapshot(
        candidate,
        record,
        drawInfo,
      );

      state.progressCaptureCandidates.set(
        candidateKey,
        candidate,
      );

      return;
    }

    existing.lastSeenAt = now;

    if (!existing.lookupData) {
      applyProgressSnapshot(
        existing,
        record,
        drawInfo,
      );
    }

    /*
     * Wplace can render a small cursor preview from the same template source.
     * Keep the largest draw metadata. Only rebuild the fixed geographic lookup
     * if that larger draw points to a different map location.
     */
    if (area > existing.area) {
      const currentAnchor =
        getProgressAnchor(
          record,
          drawInfo,
          state.map,
        );

      const placementChanged =
        currentAnchor &&
        existing.anchor &&
        !progressAnchorsMatch(
          currentAnchor,
          existing.anchor,
        );

      existing.record =
        record;

      existing.drawInfo =
        cloneDrawInfo(
          drawInfo,
        );

      existing.area =
        area;

      if (
        !existing.lookupData ||
        placementChanged
      ) {
        applyProgressSnapshot(
          existing,
          record,
          drawInfo,
        );
      }
    }
  }

  function drawWithComparison(
    gl,
    native,
    draw,
  ) {
    const currentProgram =
      native.getParameter.call(
        gl,
        gl.CURRENT_PROGRAM,
      );

    const record =
      currentProgram
        ? state.programRecords.get(
            currentProgram,
          )
        : null;

    if (!record) {
      return draw();
    }

    const drawInfo =
      inspectOverlayDraw(
        record,
      );

    if (!drawInfo) {
      if (
        state.highlightMode !==
        HIGHLIGHT_OFF
      ) {
        native.uniform1i.call(
          gl,
          record.locations.maskReady,
          0,
        );
      }

      return draw();
    }

    recordProgressCandidate(
      record,
      drawInfo,
    );

    if (
      state.highlightMode ===
      HIGHLIGHT_OFF
    ) {
      return draw();
    }

    const entry =
      getMaskEntry(
        record,
        drawInfo,
      );

    const restore =
      bindComparisonForDraw(
        record,
        drawInfo,
        entry,
      );

    let result;

    try {
      result = draw();
    } finally {
      restore();
    }

    scheduleMaskBuild(
      record,
      drawInfo,
      entry,
    );

    return result;
  }

  // ===========================================================================
  // WebGL hooks
  // ===========================================================================

  function patchContextPrototype(
    prototype,
  ) {
    if (
      !prototype ||
      typeof prototype.shaderSource !==
        "function" ||
      prototype.shaderSource
        .__wpttPatched
    ) {
      return;
    }

    const native = {
      activeTexture:
        prototype.activeTexture,

      bindFramebuffer:
        prototype.bindFramebuffer,

      bindTexture:
        prototype.bindTexture,

      checkFramebufferStatus:
        prototype.checkFramebufferStatus,

      createFramebuffer:
        prototype.createFramebuffer,

      createTexture:
        prototype.createTexture,

      deleteFramebuffer:
        prototype.deleteFramebuffer,

      deleteProgram:
        prototype.deleteProgram,

      deleteTexture:
        prototype.deleteTexture,

      drawArrays:
        prototype.drawArrays,

      drawElements:
        prototype.drawElements,

      framebufferTexture2D:
        prototype.framebufferTexture2D,

      getAttachedShaders:
        prototype.getAttachedShaders,

      getParameter:
        prototype.getParameter,

      getUniform:
        prototype.getUniform,

      getUniformLocation:
        prototype.getUniformLocation,

      isContextLost:
        prototype.isContextLost,

      linkProgram:
        prototype.linkProgram,

      readPixels:
        prototype.readPixels,

      shaderSource:
        prototype.shaderSource,

      texImage2D:
        prototype.texImage2D,

      texSubImage2D:
        prototype.texSubImage2D,

      texParameteri:
        prototype.texParameteri,

      uniform1f:
        prototype.uniform1f,

      uniform1i:
        prototype.uniform1i,

      uniform3f:
        prototype.uniform3f,

      useProgram:
        prototype.useProgram,
    };

    function shaderSource(
      shader,
      source,
    ) {
      let nextSource =
        source;

      if (
        isOverlayFragmentShader(
          source,
        )
      ) {
        const patched =
          addPreviewOverride(
            source,
          );

        if (
          patched !== source
        ) {
          nextSource =
            patched;

          state.patchedShaders.add(
            shader,
          );
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

    prototype.shaderSource =
      shaderSource;

    prototype.linkProgram =
      function linkProgram(
        program,
      ) {
        const result =
          native.linkProgram.call(
            this,
            program,
          );

        try {
          trackOverlayProgram(
            this,
            program,
            native,
          );
        } catch (error) {
          console.warn(
            "[Wplace Template Tools] Could not track overlay program.",
            error,
          );
        }

        return result;
      };

    prototype.deleteProgram =
      function deleteProgram(
        program,
      ) {
        const record =
          state.programRecords.get(
            program,
          );

        if (record) {
          cleanupProgramRecord(
            record,
          );

          state.programRecords.delete(
            program,
          );
        }

        return native.deleteProgram.call(
          this,
          program,
        );
      };

    prototype.texImage2D =
      function texImage2D(
        ...args
      ) {
        const result =
          native.texImage2D.call(
            this,
            ...args,
          );

        try {
          markTextureContentChanged(
            native.getParameter.call(
              this,
              this.TEXTURE_BINDING_2D,
            ),
          );
        } catch {
          // Texture version tracking is best-effort only.
        }

        return result;
      };

    if (
      typeof native.texSubImage2D ===
      "function"
    ) {
      prototype.texSubImage2D =
        function texSubImage2D(
          ...args
        ) {
          const result =
            native.texSubImage2D.call(
              this,
              ...args,
            );

          try {
            markTextureContentChanged(
              native.getParameter.call(
                this,
                this.TEXTURE_BINDING_2D,
              ),
            );
          } catch {
            // Texture version tracking is best-effort only.
          }

          return result;
        };
    }

    prototype.drawArrays =
      function drawArrays(
        ...args
      ) {
        return drawWithComparison(
          this,
          native,
          () =>
            native.drawArrays.call(
              this,
              ...args,
            ),
        );
      };

    prototype.drawElements =
      function drawElements(
        ...args
      ) {
        return drawWithComparison(
          this,
          native,
          () =>
            native.drawElements.call(
              this,
              ...args,
            ),
        );
      };
  }

  patchContextPrototype(
    globalThis
      .WebGLRenderingContext
      ?.prototype,
  );

  patchContextPrototype(
    globalThis
      .WebGL2RenderingContext
      ?.prototype,
  );

  // ===========================================================================
  // Pulse animation
  // ===========================================================================

  function setPulseBrightness(
    brightness,
  ) {
    if (
      Math.abs(
        state.pulseBrightness -
          brightness,
      ) < 0.0001
    ) {
      return;
    }

    state.pulseBrightness =
      brightness;

    state.records.forEach(
      (record) => {
        setPulseBrightnessUniform(
          record,
          brightness,
        );
      },
    );
  }

  function stopPulseAnimation() {
    if (pulseAnimationFrame) {
      cancelAnimationFrame(
        pulseAnimationFrame,
      );

      pulseAnimationFrame = 0;
    }

    lastPulseFrameTime = 0;

    setPulseBrightness(1);
  }

  function startPulseAnimation() {
    if (pulseAnimationFrame) {
      return;
    }

    const animate = (time) => {
      if (
        state.highlightMode !==
          HIGHLIGHT_PULSE ||
        !state.pulseEnabled
      ) {
        pulseAnimationFrame = 0;
        lastPulseFrameTime = 0;

        setPulseBrightness(1);

        requestMapRepaint();

        return;
      }

      if (
        !lastPulseFrameTime ||
        time - lastPulseFrameTime >=
          PULSE_FRAME_INTERVAL_MS
      ) {
        lastPulseFrameTime =
          time;

        const phase =
          (
            time %
            PULSE_PERIOD_MS
          ) /
          PULSE_PERIOD_MS;

        const wave =
          (
            Math.cos(
              phase *
                Math.PI *
                2,
            ) +
            1
          ) /
          2;

        const brightness =
          PULSE_MIN_BRIGHTNESS +
          (
            PULSE_MAX_BRIGHTNESS -
            PULSE_MIN_BRIGHTNESS
          ) *
            wave;

        setPulseBrightness(
          brightness,
        );

        requestMapRepaint();
      }

      pulseAnimationFrame =
        requestAnimationFrame(
          animate,
        );
    };

    pulseAnimationFrame =
      requestAnimationFrame(
        animate,
      );
  }

  function syncPulseAnimation() {
    if (
      state.highlightMode ===
        HIGHLIGHT_PULSE &&
      state.pulseEnabled
    ) {
      startPulseAnimation();
    } else {
      stopPulseAnimation();
    }
  }

  // ===========================================================================
  // Refresh handling
  // ===========================================================================

  function refreshComparison() {
    artworkGeneration += 1;

    artworkTileCache.clear();

    requestMapRepaint();
  }

  function scheduleMutationRefresh() {
    clearTimeout(
      mutationRefreshTimer,
    );

    mutationRefreshTimer =
      setTimeout(
        () => {
          mutationRefreshTimer = 0;

          if (
            state.highlightMode !==
            HIGHLIGHT_OFF
          ) {
            refreshComparison();
          }
        },
        MUTATION_REFRESH_DELAY_MS,
      );
  }

  function installFetchMutationWatcher() {
    const nativeFetch =
      globalThis.fetch;

    if (
      typeof nativeFetch !==
        "function" ||
      nativeFetch.__wpttWatched
    ) {
      return;
    }

    async function watchedFetch(
      input,
      init,
    ) {
      const response =
        await nativeFetch.call(
          this,
          input,
          init,
        );

      try {
        const request =
          input instanceof Request
            ? input
            : null;

        const url =
          new URL(
            request?.url ??
              String(input),
            location.href,
          );

        const method =
          (
            init?.method ??
            request?.method ??
            "GET"
          ).toUpperCase();

        if (
          response.ok &&
          url.hostname ===
            "backend.wplace.live" &&
          (
            method === "POST" ||
            method === "PUT" ||
            method === "PATCH" ||
            method === "DELETE"
          )
        ) {
          scheduleMutationRefresh();
        }
      } catch {
        // Never interfere with Wplace.
      }

      return response;
    }

    Object.defineProperty(
      watchedFetch,
      "__wpttWatched",
      {
        value: true,
      },
    );

    globalThis.fetch =
      watchedFetch;
  }

  installFetchMutationWatcher();

  setInterval(
    () => {
      if (
        state.highlightMode !==
        HIGHLIGHT_OFF
      ) {
        refreshComparison();
      }
    },
    COMPARISON_REFRESH_MS,
  );

  // ===========================================================================
  // Highlight state
  // ===========================================================================

  function getNextHighlightMode() {
    if (
      state.highlightMode ===
      HIGHLIGHT_OFF
    ) {
      return HIGHLIGHT_SOLID;
    }

    if (
      state.highlightMode ===
      HIGHLIGHT_SOLID
    ) {
      return state.pulseEnabled
        ? HIGHLIGHT_PULSE
        : HIGHLIGHT_OFF;
    }

    return HIGHLIGHT_OFF;
  }

  function setHighlightMode(mode) {
    if (
      state.highlightMode ===
      mode
    ) {
      return;
    }

    const wasOff =
      state.highlightMode ===
      HIGHLIGHT_OFF;

    state.highlightMode =
      mode;

    state.records.forEach(
      setProgramUniforms,
    );

    if (
      wasOff &&
      mode !== HIGHLIGHT_OFF
    ) {
      void getMapInstance();

      refreshComparison();
    }

    syncPulseAnimation();

    updateButtons();

    requestMapRepaint();
  }

  function cycleHighlightMode() {
    setHighlightMode(
      getNextHighlightMode(),
    );
  }

  function setColor(colorId) {
    const color =
      COLOR_PRESETS.find(
        ({ id }) =>
          id === colorId,
      );

    if (!color) {
      return;
    }

    state.color =
      color;

    saveColor(color);

    state.records.forEach(
      setProgramUniforms,
    );

    updateButtons();
    updateSettingsUi();

    requestMapRepaint();
  }

  function setPulseEnabled(enabled) {
    enabled =
      Boolean(enabled);

    if (
      state.pulseEnabled ===
      enabled
    ) {
      return;
    }

    state.pulseEnabled =
      enabled;

    savePulseEnabled(
      enabled,
    );

    if (
      !enabled &&
      state.highlightMode ===
        HIGHLIGHT_PULSE
    ) {
      state.highlightMode =
        HIGHLIGHT_SOLID;

      state.records.forEach(
        setProgramUniforms,
      );
    }

    syncPulseAnimation();

    updateButtons();
    updateSettingsUi();

    requestMapRepaint();
  }

  function isCustomPreviewEnabled() {
    return (
      state.fullPreviewEnabled ||
      state.plusPreviewEnabled
    );
  }

  function setCustomPreviewMode(
    mode,
    {
      restoreNativeSelection = true,
    } = {},
  ) {
    const nextFull =
      mode === "full";

    const nextPlus =
      mode === "plus";

    const wasCustom =
      isCustomPreviewEnabled();

    const willBeCustom =
      nextFull || nextPlus;

    if (
      state.fullPreviewEnabled ===
        nextFull &&
      state.plusPreviewEnabled ===
        nextPlus
    ) {
      return;
    }

    const toolbar =
      findOverlayToolbar();

    if (
      !wasCustom &&
      willBeCustom &&
      toolbar
    ) {
      rememberNativeModeSelection(
        toolbar,
      );
    }

    state.fullPreviewEnabled =
      nextFull;

    state.plusPreviewEnabled =
      nextPlus;

    if (
      wasCustom &&
      !willBeCustom &&
      !restoreNativeSelection
    ) {
      state.nativeModeSelectionIndex =
        null;
    }

    state.records.forEach(
      setProgramUniforms,
    );

    updateButtons();

    if (
      toolbar &&
      wasCustom &&
      !willBeCustom &&
      restoreNativeSelection
    ) {
      restoreNativeModeSelection(
        toolbar,
      );
    }

    requestMapRepaint();
  }

  function setFullPreviewEnabled(
    enabled,
    options = {},
  ) {
    setCustomPreviewMode(
      enabled ? "full" : null,
      options,
    );
  }

  function setPlusPreviewEnabled(
    enabled,
    options = {},
  ) {
    setCustomPreviewMode(
      enabled ? "plus" : null,
      options,
    );
  }

  function requestMapRepaint() {
    if (
      state.map &&
      typeof state.map
        .triggerRepaint ===
        "function"
    ) {
      try {
        state.map.triggerRepaint();
        return;
      } catch {
        // Fall through.
      }
    }

    globalThis.dispatchEvent(
      new Event("resize"),
    );
  }

  // ===========================================================================
  // Toolbar buttons
  // ===========================================================================

  function getNativeModeButtons(
    toolbar,
  ) {
    if (!toolbar) {
      return [];
    }

    return [
      ...toolbar.querySelectorAll(
        ":scope > button.btn-xs.btn-square",
      ),
    ].filter(
      (button) =>
        !button.matches(
          BUTTON_SELECTOR,
        ) &&
        !button.matches(
          PLUS_PREVIEW_BUTTON_SELECTOR,
        ),
    );
  }

  function getButtonHint(button) {
    return [
      button.title,
      button.getAttribute(
        "aria-label",
      ),
      button.getAttribute(
        "data-tip",
      ),
      button.getAttribute(
        "data-tooltip",
      ),
      button.textContent,
    ]
      .filter(Boolean)
      .join(" ")
      .trim()
      .toLowerCase();
  }

  function findNativeFullPixelButton(
    toolbar,
  ) {
    const markedButton =
      toolbar?.querySelector(
        FULL_PIXEL_TOGGLE_SELECTOR,
      );

    if (markedButton) {
      return markedButton;
    }

    const nativeButtons =
      getNativeModeButtons(
        toolbar,
      );

    const namedButton =
      nativeButtons.find(
        (button) =>
          /full\s*pixel/.test(
            getButtonHint(
              button,
            ),
          ),
      );

    if (namedButton) {
      return namedButton;
    }

    /*
     * Wplace currently orders the native mode controls as
     * Center Dots, Full Pixel, Half Diagonal.
     */
    return nativeButtons.length >= 3
      ? nativeButtons[1]
      : null;
  }

  function replaceButtonSvg(
    button,
    markup,
  ) {
    const container =
      document.createElement(
        "div",
      );

    container.innerHTML =
      markup.trim();

    const replacement =
      container.firstElementChild;

    if (!replacement) {
      return;
    }

    const existingSvg =
      button.querySelector(
        "svg",
      );

    if (existingSvg) {
      existingSvg.replaceWith(
        replacement,
      );
    } else {
      button.prepend(
        replacement,
      );
    }
  }

  function prepareNativeModeIcons(
    toolbar,
  ) {
    const fullPixelButton =
      findNativeFullPixelButton(
        toolbar,
      );

    if (!fullPixelButton) {
      return;
    }

    fullPixelButton.dataset
      .wpttFullPixelToggle = "";

    const currentSvg =
      fullPixelButton.querySelector(
        "svg",
      );

    if (
      !state.fullPixelIconMarkup &&
      currentSvg &&
      !currentSvg.matches(
        "[data-wptt-checkerboard-svg]",
      )
    ) {
      state.fullPixelIconMarkup =
        currentSvg.outerHTML;
    }

    if (state.fullPreviewEnabled) {
      if (
        currentSvg?.matches(
          "[data-wptt-checkerboard-svg]",
        )
      ) {
        replaceButtonSvg(
          fullPixelButton,
          state.fullPixelIconMarkup ??
            FALLBACK_FULL_PIXEL_ICON_MARKUP,
        );
      }
    } else if (
      !currentSvg?.matches(
        "[data-wptt-checkerboard-svg]",
      )
    ) {
      replaceButtonSvg(
        fullPixelButton,
        CHECKERBOARD_ICON_MARKUP,
      );
    }
  }

  function isNativeModeSelected(
    button,
  ) {
    return (
      button.classList.contains(
        "btn-active",
      ) ||
      button.getAttribute(
        "aria-pressed",
      ) === "true" ||
      button.getAttribute(
        "aria-checked",
      ) === "true"
    );
  }

  function rememberNativeModeSelection(
    toolbar,
  ) {
    const nativeButtons =
      getNativeModeButtons(
        toolbar,
      );

    const selectedIndex =
      nativeButtons.findIndex(
        isNativeModeSelected,
      );

    if (selectedIndex >= 0) {
      state.nativeModeSelectionIndex =
        selectedIndex;
    }
  }

  function suppressNativeModeSelection(
    toolbar,
  ) {
    const nativeButtons =
      getNativeModeButtons(
        toolbar,
      );

    if (
      state.nativeModeSelectionIndex ===
      null
    ) {
      rememberNativeModeSelection(
        toolbar,
      );
    }

    for (
      const button of
      nativeButtons
    ) {
      button.classList.remove(
        "btn-active",
      );

      if (
        button.hasAttribute(
          "aria-pressed",
        )
      ) {
        button.setAttribute(
          "aria-pressed",
          "false",
        );
      }

      if (
        button.hasAttribute(
          "aria-checked",
        )
      ) {
        button.setAttribute(
          "aria-checked",
          "false",
        );
      }
    }
  }

  function restoreNativeModeSelection(
    toolbar,
  ) {
    const nativeButtons =
      getNativeModeButtons(
        toolbar,
      );

    const selectedIndex =
      state.nativeModeSelectionIndex;

    if (
      selectedIndex === null ||
      selectedIndex < 0 ||
      selectedIndex >=
        nativeButtons.length
    ) {
      state.nativeModeSelectionIndex =
        null;

      return;
    }

    nativeButtons.forEach(
      (button, index) => {
        const selected =
          index === selectedIndex;

        button.classList.toggle(
          "btn-active",
          selected,
        );

        if (
          button.hasAttribute(
            "aria-pressed",
          )
        ) {
          button.setAttribute(
            "aria-pressed",
            String(selected),
          );
        }

        if (
          button.hasAttribute(
            "aria-checked",
          )
        ) {
          button.setAttribute(
            "aria-checked",
            String(selected),
          );
        }
      },
    );

    state.nativeModeSelectionIndex =
      null;
  }

  function bindNativeModeButtons(
    toolbar,
  ) {
    const fullPixelButton =
      findNativeFullPixelButton(
        toolbar,
      );

    for (
      const button of
      getNativeModeButtons(
        toolbar,
      )
    ) {
      if (
        nativeModeButtonsBound.has(
          button,
        )
      ) {
        continue;
      }

      nativeModeButtonsBound.add(
        button,
      );

      if (button === fullPixelButton) {
        button.addEventListener(
          "click",
          (event) => {
            /*
             * Finished preview is the second state of Wplace's native
             * Full Pixel control. Clicking it again returns to the
             * semi-transparent Full Pixel state without invoking Wplace.
             */
            if (
              state.fullPreviewEnabled
            ) {
              event.preventDefault();
              event.stopImmediatePropagation();

              setFullPreviewEnabled(
                false,
                {
                  restoreNativeSelection:
                    false,
                },
              );

              return;
            }

            /*
             * From another display mode, the first click is left to
             * Wplace so its normal semi-transparent Full Pixel state
             * is selected. Plus preview is cleared before that click.
             */
            if (
              state.plusPreviewEnabled ||
              !isNativeModeSelected(
                button,
              )
            ) {
              if (
                state.plusPreviewEnabled
              ) {
                setCustomPreviewMode(
                  null,
                  {
                    restoreNativeSelection:
                      false,
                  },
                );
              }

              queueMicrotask(() => {
                prepareNativeModeIcons(
                  toolbar,
                );

                updateButtons();
              });

              return;
            }

            /*
             * Full Pixel is already selected, so the next click advances
             * the same control to the finished-preview state.
             */
            event.preventDefault();
            event.stopImmediatePropagation();

            setFullPreviewEnabled(
              true,
              {
                restoreNativeSelection:
                  false,
              },
            );
          },
          true,
        );

        continue;
      }

      button.addEventListener(
        "click",
        () => {
          if (
            isCustomPreviewEnabled()
          ) {
            /*
             * Selecting another native display mode exits an added
             * preview mode and allows Wplace to apply the clicked mode.
             */
            setCustomPreviewMode(
              null,
              {
                restoreNativeSelection:
                  false,
              },
            );
          }
        },
        true,
      );
    }
  }

  function getHighlightTitle() {
    if (
      state.highlightMode ===
      HIGHLIGHT_OFF
    ) {
      return `Highlight unfinished pixels in ${state.color.label.toLowerCase()}`;
    }

    if (
      state.highlightMode ===
      HIGHLIGHT_SOLID
    ) {
      return state.pulseEnabled
        ? "Unfinished pixels highlighted — click to pulse"
        : "Unfinished pixels highlighted — click to turn off";
    }

    return "Unfinished pixels pulsing — click to turn off";
  }

  function updateButtons() {
    document
      .querySelectorAll(
        BUTTON_SELECTOR,
      )
      .forEach((button) => {
        const solid =
          state.highlightMode ===
          HIGHLIGHT_SOLID;

        const pulsing =
          state.highlightMode ===
          HIGHLIGHT_PULSE;

        button.classList.toggle(
          "btn-active",
          solid,
        );

        button.classList.toggle(
          "wptt-pulse-state",
          pulsing,
        );

        button.dataset.wpttState =
          state.highlightMode ===
          HIGHLIGHT_OFF
            ? "off"
            : solid
              ? "solid"
              : "pulse";

        button.setAttribute(
          "aria-pressed",
          String(
            state.highlightMode !==
              HIGHLIGHT_OFF,
          ),
        );

        const title =
          getHighlightTitle();

        if (
          button.title !== title
        ) {
          button.title = title;
        }

        if (
          button.getAttribute(
            "aria-label",
          ) !== title
        ) {
          button.setAttribute(
            "aria-label",
            title,
          );
        }
      });

    document
      .querySelectorAll(
        FULL_PIXEL_TOGGLE_SELECTOR,
      )
      .forEach((button) => {
        button.dataset.wpttState =
          state.fullPreviewEnabled
            ? "finished"
            : "transparent";

        const title =
          state.fullPreviewEnabled
            ? "Finished template preview — click for semi-transparent preview"
            : "Semi-transparent template preview — click for finished preview";

        if (
          button.title !== title
        ) {
          button.title = title;
        }

        if (
          button.getAttribute(
            "aria-label",
          ) !== title
        ) {
          button.setAttribute(
            "aria-label",
            title,
          );
        }
      });

    document
      .querySelectorAll(
        PLUS_PREVIEW_BUTTON_SELECTOR,
      )
      .forEach((button) => {
        button.classList.toggle(
          "btn-active",
          state.plusPreviewEnabled,
        );

        button.setAttribute(
          "aria-pressed",
          String(
            state.plusPreviewEnabled,
          ),
        );

        const title =
          state.plusPreviewEnabled
            ? "Restore normal template preview"
            : "Show plus-shaped pixel preview";

        if (
          button.title !== title
        ) {
          button.title = title;
        }

        if (
          button.getAttribute(
            "aria-label",
          ) !== title
        ) {
          button.setAttribute(
            "aria-label",
            title,
          );
        }
      });

    const toolbar =
      findOverlayToolbar();

    if (toolbar) {
      /*
       * Plus preview is a separate custom display mode, so native mode
       * selection is hidden while it is active. Finished preview remains
       * visibly attached to the native Full Pixel button.
       */
      if (
        state.plusPreviewEnabled
      ) {
        suppressNativeModeSelection(
          toolbar,
        );
      }

      prepareNativeModeIcons(
        toolbar,
      );
    }
  }

  function makeToggleButton() {
    const button =
      document.createElement(
        "button",
      );

    button.type =
      "button";

    button.className =
      "btn btn-ghost btn-xs btn-square";

    button.dataset
      .wpttMagentaToggle = "";

    button.setAttribute(
      "aria-pressed",
      "false",
    );

    button.innerHTML = `
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  class="size-3.5"
  fill="none"
  stroke="currentColor"
  stroke-width="2.5"
  stroke-linecap="square"
  stroke-linejoin="miter"
  aria-hidden="true"
>
  <rect x="4" y="4" width="16" height="16"></rect>

  <rect
    x="9"
    y="9"
    width="6"
    height="6"
    fill="currentColor"
    stroke="none"
  ></rect>

  <path d="M12 2v3M12 19v3M2 12h3M19 12h3"></path>
</svg>
    `;

    button.addEventListener(
      "click",
      cycleHighlightMode,
    );

    return button;
  }

  function makePlusPreviewButton() {
    const button =
      document.createElement(
        "button",
      );

    button.type =
      "button";

    button.className =
      "btn btn-ghost btn-xs btn-square";

    button.dataset
      .wpttPlusPreviewToggle = "";

    button.setAttribute(
      "aria-pressed",
      "false",
    );

    button.innerHTML =
      PLUS_PREVIEW_ICON_MARKUP;

    button.addEventListener(
      "click",
      () => {
        setPlusPreviewEnabled(
          !state.plusPreviewEnabled,
        );
      },
    );

    return button;
  }

  function ensureToolbarStyles() {
    if (
      document.querySelector(
        "[data-wptt-toolbar-styles]",
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style",
      );

    style.dataset
      .wpttToolbarStyles = "";

    style.textContent = `
      /*
       * Pulse uses the inverse of the current theme's normal
       * content/background colors. This keeps the second active
       * state distinct in both light and dark themes.
       */
      .wptt-pulse-state {
        background-color:
          var(--color-base-content, #ffffff) !important;
        border-color:
          var(--color-base-content, #ffffff) !important;
        color:
          var(--color-base-100, #1f1f1f) !important;
      }

      .wptt-pulse-state:hover {
        filter: brightness(0.92);
      }

      .wptt-pulse-state:active {
        filter: brightness(0.84);
      }

      /*
       * Fallback for light themes if the DaisyUI color variables
       * are unavailable.
       */
      @media (prefers-color-scheme: light) {
        .wptt-pulse-state {
          background-color:
            var(--color-base-content, #1f1f1f) !important;
          border-color:
            var(--color-base-content, #1f1f1f) !important;
          color:
            var(--color-base-100, #ffffff) !important;
        }
      }

      button[title="Highlight selected color"],
      button[title="Show all colors"] {
        height: 1.75rem !important;
        width: 1.75rem !important;
        min-height: 1.75rem !important;
        min-width: 1.75rem !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
      }

      [data-wptt-back-button] {
        height: 1.75rem !important;
        min-height: 1.75rem !important;
        width: 1.75rem !important;
        min-width: 1.75rem !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        gap: 0 !important;
        justify-content: center !important;
      }

      [data-wptt-lock-button] {
        height: 1.75rem !important;
        width: 1.75rem !important;
        min-height: 1.75rem !important;
        min-width: 1.75rem !important;
        padding: 0 !important;
      }

      [data-wptt-back-divider] {
        width: 1px;
        height: 1.25rem;
        flex: 0 0 1px;
        margin: 0 0.125rem;
        background-color:
          var(--color-base-content, #000000);
        opacity: 0.2;
        pointer-events: none;
      }

      [data-wptt-settings-row] {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      [data-wptt-settings-copy] {
        min-width: 0;
      }

      [data-wptt-settings-controls] {
        flex: 0 0 auto;
      }

      [data-wptt-preview-color] {
        width: 1.25rem !important;
        height: 1.25rem !important;
        min-width: 1.25rem !important;
        min-height: 1.25rem !important;
      }

      [data-wptt-template-progress] {
        display: block;
        width: 100%;
        white-space: nowrap;
      }

      [data-wptt-template-drag-handle] {
        cursor: grab;
        touch-action: none;
        user-select: none;
      }

      [data-wptt-template-drag-handle][hidden] {
        display: none !important;
      }

      [data-wptt-template-drag-handle]:active {
        cursor: grabbing;
      }

      [data-overlay-gallery-item] {
        transition:
          background-color 150ms ease,
          opacity 120ms ease;
      }

      [data-overlay-gallery-item][data-wptt-template-dragging] {
        opacity: 0.55;
      }

    @media (max-width: 34rem) {
      [data-wptt-settings-row="color"] {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
      }

      [data-wptt-settings-controls] {
        width: 100%;
      }
    }
    `;

    (
      document.head ??
      document.documentElement
    ).append(style);
  }

  // ===========================================================================
  // Modal settings
  // ===========================================================================

  function updateSettingsUi() {
    document
      .querySelectorAll(
        COLOR_BUTTON_SELECTOR,
      )
      .forEach((button) => {
        const selected =
          button.dataset
            .wpttPreviewColor ===
          state.color.id;

        button.classList.toggle(
          "ring-2",
          selected,
        );

        button.classList.toggle(
          "ring-primary",
          selected,
        );

        button.setAttribute(
          "aria-checked",
          String(selected),
        );

        const checkmark =
          button.querySelector(
            CHECKMARK_SELECTOR,
          );

        if (checkmark) {
          checkmark.hidden =
            !selected;
        }
      });

    document
      .querySelectorAll(
        PULSE_TOGGLE_SELECTOR,
      )
      .forEach((checkbox) => {
        checkbox.checked =
          state.pulseEnabled;

        checkbox.setAttribute(
          "aria-checked",
          String(
            state.pulseEnabled,
          ),
        );
      });

  }

  function makeSettingsPanel() {
    const panel =
      document.createElement(
        "section",
      );

    panel.dataset.wpttSettings =
      "";

    panel.className =
      "px-4 pt-4 pb-3 sm:px-5";

    // -------------------------------------------------------------------------
    // Color row
    // -------------------------------------------------------------------------

    const colorRow =
      document.createElement(
        "div",
      );

    colorRow.dataset
      .wpttSettingsRow = "color";

    colorRow.className =
      "";

    const colorCopy =
      document.createElement(
        "div",
      );

    colorCopy.dataset
      .wpttSettingsCopy = "";

    const colorTitle =
      document.createElement(
        "p",
      );

    colorTitle.className =
      "text-sm font-medium";

    colorTitle.textContent =
      "Highlight color";

    const colorDescription =
      document.createElement(
        "p",
      );

    colorDescription.className =
      "text-base-content/50 text-xs";

    colorDescription.textContent =
      "Highlights incomplete or incorrect pixels";

    colorCopy.append(
      colorTitle,
      colorDescription,
    );

    const colorControls =
      document.createElement(
        "div",
      );

    colorControls.dataset
      .wpttSettingsControls = "";

    colorControls.className =
      "flex items-center";

    const swatches =
      document.createElement(
        "div",
      );

    swatches.className =
      "flex items-center gap-2";

    swatches.setAttribute(
      "role",
      "radiogroup",
    );

    swatches.setAttribute(
      "aria-label",
      "Highlight color",
    );

    for (
      const color of
      COLOR_PRESETS
    ) {
      const button =
        document.createElement(
          "button",
        );

      button.type =
        "button";

      button.className =
        "btn btn-circle btn-xs border-base-content/20 p-0 text-black shadow-sm transition-transform";

      button.dataset
        .wpttPreviewColor =
        color.id;

      button.style
        .backgroundColor =
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

      const checkmark =
        document.createElement(
          "span",
        );

      checkmark.dataset
        .wpttCheckmark = "";

      checkmark.textContent =
        "✓";

      checkmark.setAttribute(
        "aria-hidden",
        "true",
      );

      button.append(
        checkmark,
      );

      button.addEventListener(
        "click",
        () => {
          setColor(
            color.id,
          );
        },
      );

      swatches.append(
        button,
      );
    }

    colorControls.append(
      swatches,
    );

    colorRow.append(
      colorCopy,
      colorControls,
    );

    // -------------------------------------------------------------------------
    // Divider
    // -------------------------------------------------------------------------

    const divider =
      document.createElement(
        "div",
      );

    divider.className =
      "border-base-content/10 mt-4 mb-3 border-t";

    // -------------------------------------------------------------------------
    // Pulse preference
    // -------------------------------------------------------------------------

    const pulseRow =
      document.createElement(
        "label",
      );
    
    pulseRow.dataset
      .wpttSettingsRow = "pulse";

    pulseRow.className =
      "cursor-pointer";

    const pulseCopy =
      document.createElement(
        "div",
      );

    const pulseTitle =
      document.createElement(
        "p",
      );

    pulseTitle.className =
      "text-sm font-medium";

    pulseTitle.textContent =
      "Enable pulsing";

    const pulseDescription =
      document.createElement(
        "p",
      );

    pulseDescription.className =
      "text-base-content/50 text-xs";

    pulseDescription.textContent =
      "Clicking highlight button twice makes pixels pulse";

    pulseCopy.append(
      pulseTitle,
      pulseDescription,
    );

    const pulseToggle =
      document.createElement(
        "input",
      );

    pulseToggle.type =
      "checkbox";

    pulseToggle.className =
      "toggle toggle-sm";

    pulseToggle.dataset
      .wpttEnablePulse = "";

    pulseToggle.checked =
      state.pulseEnabled;

    pulseToggle.setAttribute(
      "aria-label",
      "Enable pulse mode",
    );

    pulseToggle.addEventListener(
      "change",
      () => {
        setPulseEnabled(
          pulseToggle.checked,
        );
      },
    );

    pulseRow.append(
      pulseCopy,
      pulseToggle,
    );

    panel.append(
      colorRow,
      divider,
      pulseRow,
    );

    for (
      const button of
      swatches.querySelectorAll(
        COLOR_BUTTON_SELECTOR,
      )
    ) {
      const selected =
        button.dataset
          .wpttPreviewColor ===
        state.color.id;

      button.classList.toggle(
        "ring-2",
        selected,
      );

      button.classList.toggle(
        "ring-primary",
        selected,
      );

      button.setAttribute(
        "aria-checked",
        String(selected),
      );

      const checkmark =
        button.querySelector(
          CHECKMARK_SELECTOR,
        );

      if (checkmark) {
        checkmark.hidden =
          !selected;
      }
    }

    return panel;
  }

  // ===========================================================================
  // Wplace UI discovery
  // ===========================================================================

  function findOverlayToolbar() {
    const markedToolbar =
      document.querySelector(
        TOOLBAR_SELECTOR,
      );

    if (markedToolbar) {
      return markedToolbar;
    }

    const optionButtons =
      document.querySelectorAll(
        "button.btn-xs.btn-square",
      );

    const possibleToolbars =
      new Set(
        [...optionButtons]
          .map(
            (button) =>
              button.parentElement,
          )
          .filter(Boolean),
      );

    for (
      const toolbar of
      possibleToolbars
    ) {
      const displayOptions =
        toolbar.querySelectorAll(
          ":scope > button.btn-xs.btn-square",
        );

      const backButton =
        toolbar.querySelector(
          ":scope > button.btn-sm.shrink-0:not(.btn-square)",
        );

      if (
        displayOptions.length >=
          3 &&
        backButton
      ) {
        toolbar.dataset
          .wplaceCleanModeOverlayToolbar =
          "true";

        return toolbar;
      }
    }

    return null;
  }

  function ensureBackButtonPresentation(
    toolbar,
  ) {
    if (!toolbar) {
      return;
    }

    const backButton =
      toolbar.querySelector(
        ":scope > button.btn-sm.shrink-0:not(.btn-square)",
      );

    if (!backButton) {
      return;
    }

    if (
      !backButton.hasAttribute(
        "data-wptt-back-button",
      )
    ) {
      backButton.dataset
        .wpttBackButton = "";

      backButton.title = "Back";

      backButton.setAttribute(
        "aria-label",
        "Back",
      );
    }

    /*
     * Preserve the existing icon while removing visible label text.
     * The button's native classes stay intact so toolbar discovery
     * continues to recognize it as Wplace's Back control.
     */
    const textNodes = [];

    const walker =
      document.createTreeWalker(
        backButton,
        NodeFilter.SHOW_TEXT,
      );

    while (walker.nextNode()) {
      const textNode =
        walker.currentNode;

      if (
        textNode.textContent.trim() &&
        !textNode.parentElement?.closest(
          "svg",
        )
      ) {
        textNodes.push(
          textNode,
        );
      }
    }

    for (
      const textNode of
      textNodes
    ) {
      textNode.remove();
    }

    let divider =
      toolbar.querySelector(
        BACK_DIVIDER_SELECTOR,
      );

    if (!divider) {
      divider =
        document.createElement(
          "div",
        );

      divider.dataset
        .wpttBackDivider = "";

      divider.setAttribute(
        "aria-hidden",
        "true",
      );
    }

    /*
     * Keep the divider directly after Back without moving it again
     * when it is already in the correct position.
     */
    if (
      backButton.nextElementSibling !==
      divider
    ) {
      backButton.after(
        divider,
      );
    }
  }

function ensureLockButtonPresentation(
  toolbar,
) {
  if (!toolbar) {
    return;
  }

  const lockButton =
    toolbar.querySelector(
      ':scope > button[title="Lock screen"], :scope > button[title="Unlock screen"]',
    );

  if (!lockButton) {
    return;
  }

  if (
    !lockButton.hasAttribute(
      "data-wptt-lock-button",
    )
  ) {
    lockButton.dataset
      .wpttLockButton = "";
  }
}

  function ensureToolbarButtons() {
    const toolbar =
      findOverlayToolbar();

    if (!toolbar) {
      return;
    }

    ensureLockButtonPresentation(
      toolbar,
    );

    ensureBackButtonPresentation(
      toolbar,
    );

    /*
     * Capture Wplace's original Full Pixel icon and use the same
     * native button for transparent and finished preview states.
     */
    prepareNativeModeIcons(
      toolbar,
    );

    bindNativeModeButtons(
      toolbar,
    );

    let nativeButtons =
      getNativeModeButtons(
        toolbar,
      );

    const firstNativeButton =
      nativeButtons[0] ??
      null;

    let highlightButton =
      toolbar.querySelector(
        BUTTON_SELECTOR,
      );

    let plusPreviewButton =
      toolbar.querySelector(
        PLUS_PREVIEW_BUTTON_SELECTOR,
      );

    if (!highlightButton) {
      highlightButton =
        makeToggleButton();

      toolbar.insertBefore(
        highlightButton,
        firstNativeButton ??
          toolbar.children[1] ??
          null,
      );
    }

    if (!plusPreviewButton) {
      plusPreviewButton =
        makePlusPreviewButton();
    }

    /*
     * Plus preview follows Wplace's native display modes. Finished
     * preview now shares Wplace's native Full Pixel control.
     */
    nativeButtons =
      getNativeModeButtons(
        toolbar,
      );

    const lastNativeButton =
      nativeButtons[
        nativeButtons.length - 1
      ] ?? null;

    if (lastNativeButton) {
      if (
        plusPreviewButton
          .previousElementSibling !==
        lastNativeButton
      ) {
        lastNativeButton.after(
          plusPreviewButton,
        );
      }
    } else {
      const backButton =
        toolbar.querySelector(
          ":scope > button.btn-sm.shrink-0:not(.btn-square)",
        );

      if (
        !plusPreviewButton.isConnected
      ) {
        toolbar.insertBefore(
          plusPreviewButton,
          backButton ?? null,
        );
      }
    }

    /*
     * Reapply icon state if Wplace rebuilt the toolbar.
     */
    prepareNativeModeIcons(
      toolbar,
    );

    bindNativeModeButtons(
      toolbar,
    );

    updateButtons();
  }

  function getTemplateNativeIndex(
    row,
  ) {
    const value =
      Number(
        row?.dataset
          ?.overlayGalleryIndex,
      );

    return Number.isInteger(value)
      ? value
      : null;
  }

  function makeTemplateDimensionTarget(
    source,
    width,
    height,
  ) {
    const node =
      source.textNode ??
      source.element ??
      null;

    const row =
      node instanceof Node
        ? (
            node.parentElement?.closest(
              TEMPLATE_GALLERY_ITEM_SELECTOR,
            ) ??
            (
              node instanceof Element
                ? node.closest(
                    TEMPLATE_GALLERY_ITEM_SELECTOR,
                  )
                : null
            )
          )
        : null;

    return {
      ...source,
      row,
      nativeIndex:
        getTemplateNativeIndex(
          row,
        ),
      width,
      height,
    };
  }

  function getTemplateDimensionTargets(
    gallery,
  ) {
    const targets = [];

    const pattern =
      /^\s*(\d+)\s*[×x]\s*(\d+)(?:\s*(?:px|pixels?))?\s*$/i;

    const walker =
      document.createTreeWalker(
        gallery,
        NodeFilter.SHOW_TEXT,
      );

    while (walker.nextNode()) {
      const textNode =
        walker.currentNode;

      const parent =
        textNode.parentElement;

      if (
        !parent ||
        parent.closest(
          SETTINGS_SELECTOR,
        ) ||
        parent.closest(
          TEMPLATE_PROGRESS_SELECTOR,
        ) ||
        parent.matches(
          "script, style",
        )
      ) {
        continue;
      }

      const match =
        (textNode.nodeValue ?? "")
          .match(pattern);

      if (!match) {
        continue;
      }

      targets.push(
        makeTemplateDimensionTarget(
          {
            textNode,
          },
          Number(match[1]),
          Number(match[2]),
        ),
      );
    }

    if (targets.length) {
      return targets;
    }

    for (
      const element of
      gallery.querySelectorAll("*")
    ) {
      if (
        element.closest(
          SETTINGS_SELECTOR,
        ) ||
        element.closest(
          TEMPLATE_PROGRESS_SELECTOR,
        ) ||
        element.matches(
          "script, style",
        )
      ) {
        continue;
      }

      const match =
        (element.textContent ?? "")
          .match(pattern);

      if (!match) {
        continue;
      }

      const childMatches =
        [...element.children].some(
          (child) =>
            pattern.test(
              child.textContent ?? "",
            ),
        );

      if (childMatches) {
        continue;
      }

      targets.push(
        makeTemplateDimensionTarget(
          {
            element,
          },
          Number(match[1]),
          Number(match[2]),
        ),
      );
    }

    return targets;
  }

  function compareTemplateTargetsByNativeOrder(
    first,
    second,
  ) {
    if (
      first.nativeIndex !== null &&
      second.nativeIndex !== null
    ) {
      return (
        first.nativeIndex -
        second.nativeIndex
      );
    }

    if (first.nativeIndex !== null) {
      return -1;
    }

    if (second.nativeIndex !== null) {
      return 1;
    }

    return 0;
  }

  function getTemplateProgressSlot(
    target,
    targets,
  ) {
    const sameSize =
      targets
        .filter(
          (candidate) =>
            candidate.width ===
              target.width &&
            candidate.height ===
              target.height,
        )
        .sort(
          compareTemplateTargetsByNativeOrder,
        );

    const slotIndex =
      sameSize.indexOf(
        target,
      );

    if (slotIndex < 0) {
      return null;
    }

    const rowId =
      getTemplateRowOrderId(
        target.row,
      );

    const duplicateRows =
      targets
        .filter(
          (candidate) =>
            getTemplateRowOrderId(
              candidate.row,
            ) === rowId,
        )
        .sort(
          compareTemplateTargetsByNativeOrder,
        );

    const duplicateIndex =
      duplicateRows.length > 1
        ? duplicateRows.indexOf(
            target,
          )
        : null;

    const storageKey =
      getTemplateRowProgressKey(
        target.row,
        duplicateIndex,
      );

    if (!storageKey) {
      return null;
    }

    const legacyStorageKey =
      getProgressStorageKey(
        target.width,
        target.height,
        slotIndex,
      );

    const uniqueSize =
      sameSize.length === 1;

    if (
      uniqueSize &&
      storageKey !==
        legacyStorageKey &&
      state.progressManualCompleteKeys
        .has(
          legacyStorageKey,
        ) &&
      !state.progressManualCompleteKeys
        .has(storageKey)
    ) {
      state.progressManualCompleteKeys
        .add(storageKey);

      state.progressManualCompleteKeys
        .delete(
          legacyStorageKey,
        );

      saveManualCompleteKeys();
    }

    return {
      width:
        target.width,

      height:
        target.height,

      slotIndex,

      nativeIndex:
        target.nativeIndex,

      storageKey,

      legacyStorageKey,

      uniqueSize,
    };
  }

  function getProgressDesiredCounts(
    gallery,
  ) {
    const counts = new Map();

    for (
      const target of
      getTemplateDimensionTargets(
        gallery,
      )
    ) {
      const key =
        `${target.width}x${target.height}`;

      counts.set(
        key,
        (counts.get(key) ?? 0) + 1,
      );
    }

    return counts;
  }

  function getOrCreateProgressSpan(
    target,
  ) {
    if (target.textNode) {
      const parent =
        target.textNode.parentNode;

      if (!parent) {
        return null;
      }

      let progress =
        target.textNode.nextSibling;

      if (
        !(progress instanceof HTMLElement) ||
        !progress.matches(
          TEMPLATE_PROGRESS_SELECTOR,
        )
      ) {
        progress =
          document.createElement(
            "span",
          );

        progress.dataset
          .wpttTemplateProgress = "";

        progress.setAttribute(
          "aria-live",
          "polite",
        );

        parent.insertBefore(
          progress,
          target.textNode.nextSibling,
        );
      }

      return progress;
    }

    const element =
      target.element;

    if (!element) {
      return null;
    }

    let progress =
      element.querySelector(
        `:scope > ${TEMPLATE_PROGRESS_SELECTOR}`,
      );

    if (!progress) {
      progress =
        document.createElement(
          "span",
        );

      progress.dataset
        .wpttTemplateProgress = "";

      progress.setAttribute(
        "aria-live",
        "polite",
      );

      element.append(progress);
    }

    return progress;
  }

  function setProgressText(
    progress,
    text,
  ) {
    if (
      progress.childNodes.length === 1 &&
      progress.firstChild?.nodeType ===
        Node.TEXT_NODE
    ) {
      if (
        progress.firstChild.nodeValue !==
        text
      ) {
        progress.firstChild.nodeValue =
          text;
      }

      return;
    }

    progress.replaceChildren(
      document.createTextNode(
        text,
      ),
    );
  }

  function getTemplateProgressEntries() {
    return state.progressEntries.filter(
      (entry) =>
        entry &&
        Number.isFinite(
          entry.width,
        ) &&
        Number.isFinite(
          entry.height,
        ),
    );
  }

  function updateTemplateProgressUi(
    gallery = null,
  ) {
    if (!gallery) {
      const templateInput =
        document.querySelector(
          "#template-file-input",
        );

      const dialog =
        templateInput?.closest(
          "dialog",
        );

      gallery =
        dialog?.querySelector(
          "[data-template-gallery-scroll]",
        ) ?? null;
    }

    if (!gallery) {
      return;
    }

    const entriesByStorageKey =
      new Map();

    for (
      const entry of
      getTemplateProgressEntries()
    ) {
      if (
        typeof entry
          .progressStorageKey ===
          "string"
      ) {
        entriesByStorageKey.set(
          entry.progressStorageKey,
          entry,
        );
      }
    }

    const targets =
      getTemplateDimensionTargets(
        gallery,
      );

    for (
      const target of targets
    ) {
      const progress =
        getOrCreateProgressSpan(
          target,
        );

      if (!progress) {
        continue;
      }

      const slot =
        getTemplateProgressSlot(
          target,
          targets,
        );

      if (!slot) {
        continue;
      }

      if (
        isProgressManuallyComplete(
          slot.storageKey,
        )
      ) {
        setProgressText(
          progress,
          "Complete",
        );

        progress.title =
          "Marked complete manually";

        continue;
      }

      const entry =
        entriesByStorageKey.get(
          slot.storageKey,
        );

      if (!entry) {
        setProgressText(
          progress,
          "No progress tracked",
        );

        progress.removeAttribute(
          "title",
        );

        continue;
      }

      if (
        !entry.ready ||
        entry.comparedCount <= 0
      ) {
        setProgressText(
          progress,
          "calculating…",
        );

        progress.removeAttribute(
          "title",
        );

        continue;
      }

      const total =
        entry.comparedCount;

      const placed =
        Math.max(
          0,
          total -
            entry.mismatchCount,
        );

      const percent =
        Math.round(
          (
            placed /
            total
          ) *
            100,
        );

      setProgressText(
        progress,
        `${percent}% complete (${placed}/${total} pixels)`,
      );

      progress.title =
        `${placed} of ${total} pixels complete`;
    }
  }

  function selectProgressCandidates() {
    const grouped =
      new Map();

    for (
      const candidate of
      state.progressCaptureCandidates.values()
    ) {
      const { drawInfo } =
        candidate;

      const key =
        `${drawInfo.width}x${drawInfo.height}`;

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }

      grouped.get(key).push(
        candidate,
      );
    }

    const selected = [];

    for (
      const [key, candidates] of
      grouped
    ) {
      const desired =
        state.progressDesiredCounts.get(
          key,
        ) ?? 0;

      if (desired <= 0) {
        continue;
      }

      /*
       * The normal overlay and cursor preview can produce separate WebGL
       * candidates for the same template. Collapse those duplicates by their
       * actual captured image before taking the number of gallery templates.
       */
      const byFingerprint =
        new Map();

      for (
        const candidate of
        candidates
      ) {
        const pixels =
          candidate.lookupData
            ?.templatePixels;

        if (!pixels) {
          continue;
        }

        const fingerprint =
          fingerprintTemplatePixels(
            candidate.drawInfo.width,
            candidate.drawInfo.height,
            pixels,
          );

        const existing =
          byFingerprint.get(
            fingerprint,
          );

        if (
          !existing ||
          candidate.area >
            existing.area ||
          (
            candidate.area ===
              existing.area &&
            (
              candidate.lastSeenAt ??
              0
            ) >
              (
                existing.lastSeenAt ??
                0
              )
          )
        ) {
          byFingerprint.set(
            fingerprint,
            candidate,
          );
        }
      }

      let uniqueCandidates =
        [
          ...byFingerprint.values(),
        ];

      if (
        uniqueCandidates.length <
        desired
      ) {
        const included =
          new Set(
            uniqueCandidates,
          );

        uniqueCandidates.push(
          ...candidates.filter(
            (candidate) =>
              !included.has(
                candidate,
              ),
          ),
        );
      }

      uniqueCandidates.sort(
        (a, b) =>
          b.area - a.area ||
          (b.lastSeenAt ?? 0) -
            (a.lastSeenAt ?? 0),
      );

      selected.push(
        ...uniqueCandidates.slice(
          0,
          desired,
        ),
      );
    }

    selected.sort(
      (a, b) =>
        a.order - b.order,
    );

    return selected;
  }

  async function finishProgressCapture(
    token,
  ) {
    if (
      token !==
      state.progressCaptureToken
    ) {
      return;
    }

    state.progressCaptureActive =
      false;

    state.progressCaptureTimer = 0;

    const selected =
      selectProgressCandidates();

    await ensureProgressStorageLoaded();

    if (
      token !==
      state.progressCaptureToken
    ) {
      return;
    }

    let gallery =
      state.progressGallery;

    if (
      !gallery ||
      !gallery.isConnected
    ) {
      const templateInput =
        document.querySelector(
          "#template-file-input",
        );

      const dialog =
        templateInput?.closest(
          "dialog",
        );

      gallery =
        dialog?.querySelector(
          "[data-template-gallery-scroll]",
        ) ?? null;
    }

    if (!gallery) {
      return;
    }

    const targets =
      getTemplateDimensionTargets(
        gallery,
      );

    const targetsBySize =
      new Map();

    for (
      const target of targets
    ) {
      const key =
        `${target.width}x${target.height}`;

      if (
        !targetsBySize.has(key)
      ) {
        targetsBySize.set(
          key,
          [],
        );
      }

      targetsBySize
        .get(key)
        .push(target);
    }

    for (
      const group of
      targetsBySize.values()
    ) {
      group.sort(
        compareTemplateTargetsByNativeOrder,
      );
    }

    const selectedBySize =
      new Map();

    for (
      const candidate of
      selected
    ) {
      const key =
        `${candidate.drawInfo.width}x${candidate.drawInfo.height}`;

      if (
        !selectedBySize.has(key)
      ) {
        selectedBySize.set(
          key,
          [],
        );
      }

      selectedBySize
        .get(key)
        .push(candidate);
    }

    state.progressEntries = [];

    for (
      const [key, groupTargets] of
      targetsBySize
    ) {
      const candidates =
        selectedBySize.get(key) ??
        [];

      const assignments =
        await matchProgressCandidatesToTargets(
          candidates,
          groupTargets,
        );

      if (
        token !==
        state.progressCaptureToken
      ) {
        return;
      }

      for (
        const target of
        groupTargets
      ) {
        const slot =
          getTemplateProgressSlot(
            target,
            targets,
          );

        if (!slot) {
          continue;
        }

        const candidate =
          assignments.get(
            target,
          );

        if (
          candidate?.lookupData
        ) {
          /*
           * Do not reuse the highlight mask cache for modal progress.
           * Wplace can reuse the same WebGL texture/draw identity for a
           * different template with identical dimensions, which made both
           * gallery rows point at one mutable cache entry.
           */
          const entry =
            makeLiveProgressEntry(
              candidate,
              slot,
            );

          state.progressEntries.push(
            entry,
          );

          void refreshStoredProgressEntry(
            entry,
            token,
          );

          continue;
        }

        let stored =
          state.progressStoredSlots.get(
            slot.storageKey,
          );

        /*
         * Old slot records are only safe to migrate if no other template
         * shares these dimensions. Ambiguous same-size records are ignored.
         */
        if (
          !stored?.lookupData &&
          slot.uniqueSize
        ) {
          const legacy =
            state.progressStoredSlots.get(
              slot.legacyStorageKey,
            );

          if (legacy?.lookupData) {
            stored = {
              ...legacy,

              storageKey:
                slot.storageKey,

              slotIndex:
                slot.slotIndex,

              savedAt:
                Date.now(),
            };

            state.progressStoredSlots.set(
              slot.storageKey,
              stored,
            );

            void saveProgressStoredSlot(
              stored,
            );
          }
        }

        if (!stored?.lookupData) {
          continue;
        }

        const entry =
          makeProgressEntryFromStored(
            stored,
          );

        entry.progressStorageKey =
          slot.storageKey;

        entry.progressSlotIndex =
          slot.slotIndex;

        state.progressEntries.push(
          entry,
        );

        void refreshStoredProgressEntry(
          entry,
          token,
        );
      }
    }

    updateTemplateProgressUi(
      gallery,
    );
  }

  function startProgressCapture(
    gallery,
  ) {
    clearTimeout(
      state.progressCaptureTimer,
    );

    const token =
      ++state.progressCaptureToken;

    state.progressCaptureActive =
      true;

    state.progressGallery =
      gallery;

    state.progressDesiredCounts =
      getProgressDesiredCounts(
        gallery,
      );

    state.progressEntries = [];
    state.progressLastError = null;

    updateTemplateProgressUi(
      gallery,
    );

    void getMapInstance();

    refreshComparison();

    /*
     * Opening the template modal can pause MapLibre rendering, so preserve
     * the draw metadata collected immediately before the modal opened.
     * Request one final frame in case Wplace still allows it.
     */
    requestMapRepaint();

    state.progressCaptureTimer =
      setTimeout(
        () => {
          void finishProgressCapture(
            token,
          );
        },
        100,
      );
  }

  function getTemplateActionMenus(
    gallery,
  ) {
    const dialog =
      gallery?.closest("dialog");

    const root =
      dialog ?? gallery;

    if (!root) {
      return [];
    }

    return [
      ...root.querySelectorAll(
        "ul.dropdown-content.menu",
      ),
    ].filter((menu) => {
      const labels =
        [
          ...menu.querySelectorAll(
            ":scope > li > button",
          ),
        ].map(
          (button) =>
            (
              button.textContent ??
              ""
            )
              .replace(
                /\s+/g,
                " ",
              )
              .trim()
              .toLowerCase(),
        );

      return (
        labels.some(
          (label) =>
            label === "edit",
        ) &&
        labels.some(
          (label) =>
            label === "export",
        ) &&
        labels.some(
          (label) =>
            label === "delete",
        )
      );
    });
  }

  function getTemplateTargetNode(
    target,
  ) {
    return (
      target.textNode ??
      target.element ??
      null
    );
  }

  function getTemplateMenuProgressSlot(
    menu,
    gallery,
  ) {
    const targets =
      getTemplateDimensionTargets(
        gallery,
      );

    if (!targets.length) {
      return null;
    }

    const row =
      menu.closest(
        TEMPLATE_GALLERY_ITEM_SELECTOR,
      );

    if (!row) {
      return null;
    }

    const target =
      targets.find(
        (candidate) =>
          candidate.row === row,
      );

    if (!target) {
      return null;
    }

    return getTemplateProgressSlot(
      target,
      targets,
    );
  }

  function closeTemplateActionMenu(
    menu,
    button,
  ) {
    const details =
      menu?.closest("details");

    if (details) {
      details.open = false;
    }

    button.blur();
  }

  function makeTemplateCompleteAction() {
    const item =
      document.createElement(
        "li",
      );

    item.dataset
      .wpttTemplateCompleteItem = "";

    const button =
      document.createElement(
        "button",
      );

    button.type =
      "button";

    button.dataset
      .wpttTemplateCompleteAction = "";

    button.innerHTML = `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 -960 960 960"
        fill="currentColor"
        class="size-4"
        aria-hidden="true"
      >
        <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"></path>
      </svg>
      <span data-wptt-template-complete-label></span>
    `;

    button.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        const storageKey =
          button.dataset
            .wpttProgressStorageKey;

        if (!storageKey) {
          return;
        }

        setProgressManuallyComplete(
          storageKey,
          !isProgressManuallyComplete(
            storageKey,
          ),
        );

        closeTemplateActionMenu(
          button.closest(
            "ul.dropdown-content.menu",
          ),
          button,
        );
      },
    );

    item.append(button);

    return item;
  }

  function updateTemplateCompleteAction(
    button,
    slot,
  ) {
    if (
      !button ||
      !slot
    ) {
      return;
    }

    button.dataset
      .wpttProgressStorageKey =
      slot.storageKey;

    const complete =
      isProgressManuallyComplete(
        slot.storageKey,
      );

    const label =
      button.querySelector(
        "[data-wptt-template-complete-label]",
      );

    const text =
      complete
        ? "Mark as incomplete"
        : "Mark as complete";

    if (
      label &&
      label.textContent !== text
    ) {
      label.textContent =
        text;
    }

    button.setAttribute(
      "aria-pressed",
      String(complete),
    );
  }

  function ensureTemplateCompletionMenus(
    gallery,
  ) {
    for (
      const menu of
      getTemplateActionMenus(
        gallery,
      )
    ) {
      const slot =
        getTemplateMenuProgressSlot(
          menu,
          gallery,
        );

      if (!slot) {
        continue;
      }

      let button =
        menu.querySelector(
          TEMPLATE_COMPLETE_ACTION_SELECTOR,
        );

      if (!button) {
        const item =
          makeTemplateCompleteAction();

        button =
          item.querySelector(
            TEMPLATE_COMPLETE_ACTION_SELECTOR,
          );

        const deleteButton =
          [
            ...menu.querySelectorAll(
              ":scope > li > button",
            ),
          ].find(
            (candidate) =>
              (
                candidate.textContent ??
                ""
              )
                .replace(
                  /\s+/g,
                  " ",
                )
                .trim()
                .toLowerCase() ===
              "delete",
          );

        const deleteItem =
          deleteButton?.parentElement;

        if (deleteItem) {
          menu.insertBefore(
            item,
            deleteItem,
          );
        } else {
          menu.append(item);
        }
      }

      updateTemplateCompleteAction(
        button,
        slot,
      );
    }
  }

  function hashTemplateOrderText(
    value,
  ) {
    let hash = 2166136261;

    for (
      let index = 0;
      index < value.length;
      index += 1
    ) {
      hash ^=
        value.charCodeAt(
          index,
        );

      hash =
        Math.imul(
          hash,
          16777619,
        );
    }

    return (
      hash >>> 0
    )
      .toString(16)
      .padStart(8, "0");
  }

  function getTemplateGalleryList(
    gallery,
  ) {
    return (
      gallery?.querySelector(
        ":scope > [role='list']",
      ) ??
      gallery?.querySelector(
        "[role='list']",
      ) ??
      null
    );
  }

  function getTemplateGalleryRows(
    gallery,
  ) {
    const list =
      getTemplateGalleryList(
        gallery,
      );

    if (!list) {
      return [];
    }

    return [
      ...list.querySelectorAll(
        `:scope > ${TEMPLATE_GALLERY_ITEM_SELECTOR}`,
      ),
    ];
  }

  function getTemplateRowOrderId(
    row,
  ) {
    const cached =
      row.dataset
        .wpttTemplateOrderId;

    if (cached) {
      return cached;
    }

    const title =
      row.querySelector(
        "p[title]",
      )?.getAttribute(
        "title",
      ) ??
      row.querySelector(
        "p",
      )?.textContent?.trim() ??
      "";

    const imageSource =
      row.querySelector(
        "img",
      )?.getAttribute(
        "src",
      ) ??
      "";

    /*
     * The image data makes this stable across page loads even when
     * Wplace's numeric gallery index changes after adding or deleting
     * another template.
     */
    const identitySource =
      `${title}\n${imageSource}`;

    const orderId =
      `template:${hashTemplateOrderText(
        identitySource,
      )}:${identitySource.length}`;

    row.dataset
      .wpttTemplateOrderId =
      orderId;

    return orderId;
  }

  function compareTemplateRowsByNativeOrder(
    first,
    second,
  ) {
    const firstIndex =
      getTemplateNativeIndex(
        first,
      );

    const secondIndex =
      getTemplateNativeIndex(
        second,
      );

    if (
      firstIndex !== null &&
      secondIndex !== null
    ) {
      return (
        firstIndex -
        secondIndex
      );
    }

    if (firstIndex !== null) {
      return -1;
    }

    if (secondIndex !== null) {
      return 1;
    }

    return 0;
  }

  function getTemplateRowsInDisplayOrder(
    gallery,
  ) {
    return getTemplateGalleryRows(
      gallery,
    ).sort(
      (first, second) => {
        const firstOrder =
          Number(
            first.style.order,
          );

        const secondOrder =
          Number(
            second.style.order,
          );

        const safeFirst =
          Number.isFinite(
            firstOrder,
          )
            ? firstOrder
            : 0;

        const safeSecond =
          Number.isFinite(
            secondOrder,
          )
            ? secondOrder
            : 0;

        return (
          safeFirst -
            safeSecond ||
          compareTemplateRowsByNativeOrder(
            first,
            second,
          )
        );
      },
    );
  }

  function getCompleteTemplateOrder(
    gallery,
  ) {
    const rows =
      getTemplateGalleryRows(
        gallery,
      );

    const currentIds =
      rows.map(
        getTemplateRowOrderId,
      );

    const currentSet =
      new Set(
        currentIds,
      );

    const saved =
      state.templateOrder.filter(
        (id) =>
          currentSet.has(id),
      );

    const savedSet =
      new Set(saved);

    const missing =
      [...rows]
        .sort(
          compareTemplateRowsByNativeOrder,
        )
        .map(
          getTemplateRowOrderId,
        )
        .filter(
          (id) =>
            !savedSet.has(id),
        );

    return [
      ...saved,
      ...missing,
    ];
  }

  function applySavedTemplateOrder(
    gallery,
  ) {
    const rows =
      getTemplateGalleryRows(
        gallery,
      );

    if (!rows.length) {
      return;
    }

    const order =
      getCompleteTemplateOrder(
        gallery,
      );

    const positions =
      new Map(
        order.map(
          (id, index) => [
            id,
            index,
          ],
        ),
      );

    for (
      const row of rows
    ) {
      const nextOrder =
        positions.get(
          getTemplateRowOrderId(
            row,
          ),
        );

      if (
        !Number.isInteger(
          nextOrder,
        )
      ) {
        continue;
      }

      const value =
        String(nextOrder);

      if (
        row.style.order !==
        value
      ) {
        row.style.order =
          value;
      }
    }
  }

  function saveCurrentTemplateOrder(
    gallery,
  ) {
    const ids =
      getTemplateRowsInDisplayOrder(
        gallery,
      ).map(
        getTemplateRowOrderId,
      );

    saveTemplateOrder(
      ids,
    );
  }

  function setTemplateDisplayOrder(
    gallery,
    rows,
  ) {
    const ids =
      rows.map(
        getTemplateRowOrderId,
      );

    saveTemplateOrder(
      ids,
    );

    applySavedTemplateOrder(
      gallery,
    );

    updateTemplateProgressUi(
      gallery,
    );

    ensureTemplateCompletionMenus(
      gallery,
    );
  }

  function moveTemplateRowAtPointer(
    gallery,
    sourceRow,
    clientY,
  ) {
    const rows =
      getTemplateRowsInDisplayOrder(
        gallery,
      );

    const sourceIndex =
      rows.indexOf(
        sourceRow,
      );

    if (sourceIndex < 0) {
      return;
    }

    const galleryRect =
      gallery.getBoundingClientRect();

    const edgeSize = 36;

    if (
      clientY <
      galleryRect.top + edgeSize
    ) {
      gallery.scrollTop -= 18;
    } else if (
      clientY >
      galleryRect.bottom - edgeSize
    ) {
      gallery.scrollTop += 18;
    }

    const others =
      rows.filter(
        (row) =>
          row !== sourceRow,
      );

    let insertIndex =
      others.length;

    for (
      let index = 0;
      index < others.length;
      index += 1
    ) {
      const rect =
        others[index]
          .getBoundingClientRect();

      if (
        clientY <
        rect.top +
          rect.height / 2
      ) {
        insertIndex =
          index;
        break;
      }
    }

    const nextRows =
      [...others];

    nextRows.splice(
      insertIndex,
      0,
      sourceRow,
    );

    const changed =
      nextRows.some(
        (row, index) =>
          row !== rows[index],
      );

    if (!changed) {
      return;
    }

    setTemplateDisplayOrder(
      gallery,
      nextRows,
    );
  }

  function finishTemplatePointerDrag(
    gallery,
    handle,
    pointerId,
  ) {
    const sourceRow =
      state.templateDragRow;

    if (sourceRow) {
      sourceRow.removeAttribute(
        "data-wptt-template-dragging",
      );
    }

    if (
      pointerId !== null &&
      handle.hasPointerCapture?.(
        pointerId,
      )
    ) {
      handle.releasePointerCapture(
        pointerId,
      );
    }

    state.templateDragRow =
      null;

    state.templateDragPointerId =
      null;

    saveCurrentTemplateOrder(
      gallery,
    );
  }

  function moveTemplateRowByKeyboard(
    gallery,
    row,
    direction,
  ) {
    const rows =
      getTemplateRowsInDisplayOrder(
        gallery,
      );

    const index =
      rows.indexOf(row);

    if (index < 0) {
      return;
    }

    const nextIndex =
      index + direction;

    if (
      nextIndex < 0 ||
      nextIndex >= rows.length
    ) {
      return;
    }

    [
      rows[index],
      rows[nextIndex],
    ] = [
      rows[nextIndex],
      rows[index],
    ];

    setTemplateDisplayOrder(
      gallery,
      rows,
    );
  }

  function makeTemplateDragHandle(
    gallery,
    row,
  ) {
    const handle =
      document.createElement(
        "button",
      );

    handle.type =
      "button";

    handle.className =
      "btn btn-circle btn-ghost btn-sm shrink-0";

    handle.dataset
      .wpttTemplateDragHandle = "";

    handle.hidden =
      !state.showReorderHandles;

    handle.title =
      "Drag to reorder";

    handle.setAttribute(
      "aria-label",
      "Drag to reorder template",
    );

    handle.setAttribute(
      "draggable",
      "false",
    );

    handle.innerHTML = `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="size-4"
        aria-hidden="true"
      >
        <circle cx="9" cy="6" r="1.5"></circle>
        <circle cx="15" cy="6" r="1.5"></circle>
        <circle cx="9" cy="12" r="1.5"></circle>
        <circle cx="15" cy="12" r="1.5"></circle>
        <circle cx="9" cy="18" r="1.5"></circle>
        <circle cx="15" cy="18" r="1.5"></circle>
      </svg>
    `;

    handle.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
      },
    );

    handle.addEventListener(
      "pointerdown",
      (event) => {
        if (
          event.button !== 0 ||
          state.templateDragRow
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        state.templateDragRow =
          row;

        state.templateDragPointerId =
          event.pointerId;

        row.dataset
          .wpttTemplateDragging = "";

        handle.setPointerCapture?.(
          event.pointerId,
        );
      },
    );

    handle.addEventListener(
      "pointermove",
      (event) => {
        if (
          state.templateDragRow !==
            row ||
          state.templateDragPointerId !==
            event.pointerId
        ) {
          return;
        }

        event.preventDefault();

        moveTemplateRowAtPointer(
          gallery,
          row,
          event.clientY,
        );
      },
    );

    const endPointerDrag =
      (event) => {
        if (
          state.templateDragRow !==
            row ||
          state.templateDragPointerId !==
            event.pointerId
        ) {
          return;
        }

        event.preventDefault();

        finishTemplatePointerDrag(
          gallery,
          handle,
          event.pointerId,
        );
      };

    handle.addEventListener(
      "pointerup",
      endPointerDrag,
    );

    handle.addEventListener(
      "pointercancel",
      endPointerDrag,
    );

    handle.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key !== "ArrowUp" &&
          event.key !== "ArrowDown"
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        moveTemplateRowByKeyboard(
          gallery,
          row,
          event.key === "ArrowUp"
            ? -1
            : 1,
        );

        handle.focus();
      },
    );

    return handle;
  }

  function ensureTemplateReorderUi(
    gallery,
  ) {
    applySavedTemplateOrder(
      gallery,
    );

    for (
      const row of
      getTemplateGalleryRows(
        gallery,
      )
    ) {
      const existingHandle =
        row.querySelector(
          TEMPLATE_DRAG_HANDLE_SELECTOR,
        );

      if (existingHandle) {
        existingHandle.hidden =
          !state.showReorderHandles;

        if (
          row.firstElementChild !==
          existingHandle
        ) {
          row.insertBefore(
            existingHandle,
            row.firstElementChild,
          );
        }

        continue;
      }

      const actions =
        row.querySelector(
          ":scope > [data-overlay-actions]",
        );

      if (!actions) {
        continue;
      }

      const handle =
        makeTemplateDragHandle(
          gallery,
          row,
        );

      row.insertBefore(
        handle,
        row.firstElementChild,
      );
    }
  }

  function makeReorderModeButton() {
    const button =
      document.createElement(
        "button",
      );

    button.type =
      "button";

    button.dataset
      .wpttReorderModeButton = "";

    button.setAttribute(
      "aria-pressed",
      "false",
    );

    button.innerHTML = `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        class="size-4"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"
        />
      </svg>
    `;

    button.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        setShowReorderHandles(
          !state.showReorderHandles,
        );
      },
    );

    return button;
  }

  function bindReorderDialogLifecycle(
    dialog,
  ) {
    if (
      !dialog ||
      reorderDialogBound.has(
        dialog,
      )
    ) {
      return;
    }

    reorderDialogBound.add(
      dialog,
    );

    const exitReorderMode =
      () => {
        if (
          state.showReorderHandles
        ) {
          setShowReorderHandles(
            false,
          );
        }
      };

    dialog.addEventListener(
      "close",
      exitReorderMode,
    );

    dialog.addEventListener(
      "cancel",
      exitReorderMode,
    );
  }

  function ensureReorderModeButton(
    dialog,
  ) {
    bindReorderDialogLifecycle(
      dialog,
    );

    const header =
      dialog?.querySelector(
        "header",
      );

    if (!header) {
      return;
    }

    const refreshButton =
      header.querySelector(
        'button[aria-label="Refresh"]',
      );

    if (!refreshButton) {
      return;
    }

    let button =
      header.querySelector(
        REORDER_MODE_BUTTON_SELECTOR,
      );

    if (!button) {
      button =
        makeReorderModeButton();
    }

    /*
     * Keep the mode control beside Wplace's Refresh action in the title row.
     */
    if (
      refreshButton
        .nextElementSibling !==
      button
    ) {
      refreshButton.after(
        button,
      );
    }

    updateReorderModeButton();
  }

  function ensureSettingsPanel() {
    const templateInput =
      document.querySelector(
        "#template-file-input",
      );

    const dialog =
      templateInput?.closest(
        "dialog",
      );

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
      state.progressModalVisible =
        false;

      if (
        state.showReorderHandles
      ) {
        setShowReorderHandles(
          false,
        );
      }

      return;
    }

    ensureTemplateReorderUi(
      gallery,
    );

    ensureReorderModeButton(
      dialog,
    );

    const dialogVisible =
      dialog.open ||
      dialog.matches?.(
        ":modal",
      ) ||
      (
        dialog.getBoundingClientRect()
          .width > 0 &&
        dialog.getBoundingClientRect()
          .height > 0
      );

    if (
      dialogVisible &&
      !state.progressModalVisible
    ) {
      state.progressModalVisible =
        true;

      startProgressCapture(
        gallery,
      );
    } else if (!dialogVisible) {
      state.progressModalVisible =
        false;

      if (
        state.showReorderHandles
      ) {
        setShowReorderHandles(
          false,
        );
      }
    }

    if (
      !dialog.querySelector(
        SETTINGS_SELECTOR,
      )
    ) {
      container.insertBefore(
        makeSettingsPanel(),
        gallery,
      );
    }

    updateSettingsUi();

    ensureTemplateCompletionMenus(
      gallery,
    );

    updateTemplateProgressUi(
      gallery,
    );
  }

  function ensureUi() {
    ensureToolbarStyles();
    ensureToolbarButtons();
    ensureSettingsPanel();
  }

  state.ensureUi =
    ensureUi;

  // ===========================================================================
  // DOM observer
  // ===========================================================================

  let ensureScheduled = false;

  const uiObserver =
    new MutationObserver(() => {
      if (ensureScheduled) {
        return;
      }

      ensureScheduled = true;

      queueMicrotask(() => {
        ensureScheduled = false;

        ensureUi();
      });
    });

  uiObserver.observe(
    document,
    {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "open",
      ],
    },
  );

  ensureUi();

  // ===========================================================================
  // Public API
  // ===========================================================================

  globalThis.wplaceTemplateTools = {
    refresh:
      refreshComparison,

    getStatus() {
      let compared = 0;
      let mismatches = 0;

      for (
        const record of
        state.records
      ) {
        for (
          const entry of
          record.maskCache.values()
        ) {
          if (!entry.ready) {
            continue;
          }

          compared +=
            entry.comparedCount;

          mismatches +=
            entry.mismatchCount;
        }
      }

      return {
        version: "1.3.0",

        highlight:
          state.highlightMode ===
          HIGHLIGHT_OFF
            ? "off"
            : state.highlightMode ===
                HIGHLIGHT_SOLID
              ? "solid"
              : "pulse",

        pulseEnabled:
          state.pulseEnabled,

        fullPreview:
          state.fullPreviewEnabled,

        plusPreview:
          state.plusPreviewEnabled,

        color:
          state.color.id,

        mapCaptured:
          Boolean(state.map),

        progressCandidates:
          state.progressCaptureCandidates.size,

        progressCandidateDetails:
          [
            ...state
              .progressCaptureCandidates
              .values(),
          ].map(
            (candidate) => ({
              size:
                `${candidate.drawInfo.width}x${candidate.drawInfo.height}`,

              textureId:
                candidate.drawInfo.textureId,

              textureContentVersion:
                candidate.textureContentVersion ??
                0,

              fingerprint:
                candidate.lookupData
                  ?.templatePixels
                  ? fingerprintTemplatePixels(
                      candidate.drawInfo.width,
                      candidate.drawInfo.height,
                      candidate.lookupData
                        .templatePixels,
                    )
                  : null,

              area:
                candidate.area,
            }),
          ),

        progressEntries:
          state.progressEntries.length,

        progressEntryDetails:
          state.progressEntries.map(
            (entry) => ({
              storageKey:
                entry.progressStorageKey ??
                null,

              size:
                `${entry.width}x${entry.height}`,

              fingerprint:
                entry.progressFingerprint ??
                null,

              compared:
                entry.comparedCount ?? 0,

              mismatches:
                entry.mismatchCount ?? 0,

              ready:
                Boolean(entry.ready),
            }),
          ),

        progressStoredSlots:
          state.progressStoredSlots.size,

        progressManualComplete:
          state.progressManualCompleteKeys.size,

        templateOrderEntries:
          state.templateOrder.length,

        stableProgressKeys:
          state.progressEntries.filter(
            (entry) =>
              typeof entry
                ?.progressStorageKey ===
                "string" &&
              entry.progressStorageKey
                .startsWith(
                  "row:",
                ),
          ).length,

        reorderMode:
          state.showReorderHandles,

        progressStorageError:
          state.progressStorageError,

        progressLastError:
          state.progressLastError,

        compared,
        mismatches,
      };
    },
  };
})();