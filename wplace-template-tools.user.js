// ==UserScript==
// @name         Wplace Template Tools
// @namespace    https://github.com/VWBeetle/wplace-template-tools
// @version      0.4.0
// @description  Highlights template pixels that still need to be placed.
// @author       VWBeetle
// @match        https://wplace.live/*
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

  const DEBUG_MODE_UNIFORM_NAME =
    "u_wptt_debug_mode";

  const BUTTON_SELECTOR =
    "[data-wptt-magenta-toggle]";

  const COLOR_BUTTON_SELECTOR =
    "[data-wptt-preview-color]";

  const COLOR_NAME_SELECTOR =
    "[data-wptt-color-name]";

  const COLOR_PICKER_SELECTOR =
    "[data-wptt-color-picker]";

  const CHECKMARK_SELECTOR =
    "[data-wptt-checkmark]";

  const TOOLBAR_SELECTOR =
    '[data-wplace-clean-mode-overlay-toolbar="true"]';

  const STORAGE_KEY =
    "wplace-template-tools.preview-color";

  /*
   * Wplace's artwork PNGs.
   */
  const ARTWORK_TILE_ZOOM = 11;
  const ARTWORK_TILE_COUNT =
    2 ** ARTWORK_TILE_ZOOM;

  const ARTWORK_TILE_ROOT =
    "https://backend.wplace.live/files/s0/tiles";

  const COLOR_TOLERANCE = 2;

  const COMPARISON_REFRESH_MS =
    15_000;

  const TILE_FETCH_CONCURRENCY = 6;

  const MAX_MASKS_PER_PROGRAM = 6;

  const MAP_CAPTURE_TIMEOUT_MS =
    3_000;

  const DEBUG_MODE_NORMAL = 0;
  const DEBUG_MODE_MATCHES = 1;

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
    enabled: false,
    debugMode: DEBUG_MODE_NORMAL,

    map: null,
    mapPromise: null,

    patchedShaders: new WeakSet(),
    programRecords: new WeakMap(),
    records: new Set(),

    ensureUi: () => {},
  };

  globalThis[INSTALL_KEY] = state;

  const textureIds = new WeakMap();
  const templatePixelCache = new WeakMap();
  const artworkTileCache = new Map();

  let nextTextureId = 1;

  // ===========================================================================
  // Settings
  // ===========================================================================

  function loadSavedColor() {
    try {
      const savedId =
        globalThis.localStorage?.getItem(
          STORAGE_KEY,
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
        STORAGE_KEY,
        color.id,
      );
    } catch {
      // Persistence is optional.
    }
  }

  // ===========================================================================
  // Capture the MapLibre map
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

      timeout = setTimeout(
        () => finish(null),
        timeoutMs,
      );

      /*
       * Make MapLibre do some work so its instance is likely to
       * pass through call/apply while our temporary hooks are active.
       */
      globalThis.dispatchEvent(
        new Event("resize"),
      );
    });
  }

  async function getMapInstance() {
    if (
      state.map &&
      looksLikeMapInstance(state.map)
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

        /*
         * Try a few times. The first resize may occur while Wplace
         * is still finishing map setup.
         */
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

            console.info(
              "[Wplace Template Tools] MapLibre map captured.",
            );

            return instance;
          }

          await delay(250);
        }

        return null;
      })();

    const result =
      await state.mapPromise;

    /*
     * Allow a later retry if capture failed.
     */
    if (!result) {
      state.mapPromise = null;
    }

    return result;
  }

  function delay(ms) {
    return new Promise(
      (resolve) =>
        setTimeout(resolve, ms),
    );
  }

  /*
   * Start trying immediately, but don't block script startup.
   */
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

    const colorNeedle =
      "color.rgb *= color.a;";

    if (
      !source.includes(
        samplerNeedle,
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
          `uniform int ${DEBUG_MODE_UNIFORM_NAME};`,
        ].join("\n"),
      );

    return withUniforms.replace(
      colorNeedle,
      [
        `if (${ENABLED_UNIFORM_NAME} && ${MASK_READY_UNIFORM_NAME}) {`,
        `  float wptt_mismatch = texture(`,
        `    ${MASK_UNIFORM_NAME},`,
        `    (source_pixel + 0.5) / u_source_size`,
        `  ).r;`,
        ``,
        `  if (${DEBUG_MODE_UNIFORM_NAME} == ${DEBUG_MODE_MATCHES}) {`,
        `    if (wptt_mismatch > 0.5) {`,
        `      discard;`,
        `    }`,
        `    color.rgb = vec3(0.0, 1.0, 0.25);`,
        `  } else {`,
        `    if (wptt_mismatch > 0.5) {`,
        `      color.rgb = ${COLOR_UNIFORM_NAME};`,
        `    }`,
        `  }`,
        `}`,
        colorNeedle,
      ].join("\n"),
    );
  }

  // ===========================================================================
  // Overlay program setup
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

      debugMode:
        native.getUniformLocation.call(
          gl,
          program,
          DEBUG_MODE_UNIFORM_NAME,
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
      locations.previewColor ===
        null ||
      locations.mask === null ||
      locations.maskReady ===
        null ||
      locations.debugMode ===
        null ||
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

    setProgramUniform(record);
  }

  function setProgramUniform(record) {
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
        state.enabled ? 1 : 0,
      );

      native.uniform3f.call(
        gl,
        locations.previewColor,
        state.color.rgb[0],
        state.color.rgb[1],
        state.color.rgb[2],
      );

      native.uniform1i.call(
        gl,
        locations.debugMode,
        state.debugMode,
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
  // Read current overlay state
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

      /*
       * Matrix is intentionally NOT part of this key.
       *
       * The map camera changes the matrix while the template remains
       * geographically fixed. We refresh periodically anyway.
       */
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
    } catch (error) {
      console.debug(
        "[Wplace Template Tools] Could not inspect template draw.",
        error,
      );

      return null;
    }
  }

  // ===========================================================================
  // Read template texture
  // ===========================================================================

  function readTemplatePixels(
    record,
    drawInfo,
  ) {
    const cached =
      templatePixelCache.get(
        drawInfo.texture,
      );

    if (
      cached &&
      cached.width ===
        drawInfo.width &&
      cached.height ===
        drawInfo.height
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

      /*
       * Keep the raw row order.
       *
       * source_pixel.y = 0 in Wplace's fragment shader samples texture
       * row 0, and this readback gives us that same texture-row order.
       */
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
  // Template pixel -> screen -> longitude/latitude
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

  /*
   * GLSL:
   *
   * gl_Position =
   *   u_matrix *
   *   vec4(position * u_world_size, 0.0, 1.0);
   *
   * WebGL matrices are column-major.
   */
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

    const clipX =
      m[0] * x +
      m[4] * y +
      m[12];

    const clipY =
      m[1] * x +
      m[5] * y +
      m[13];

    const clipZ =
      m[2] * x +
      m[6] * y +
      m[14];

    const clipW =
      m[3] * x +
      m[7] * y +
      m[15];

    return [
      clipX,
      clipY,
      clipZ,
      clipW,
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

    const viewportX =
      Number(viewport[0]);

    const viewportY =
      Number(viewport[1]);

    const viewportWidth =
      Number(viewport[2]);

    const viewportHeight =
      Number(viewport[3]);

    const framebufferX =
      viewportX +
      ((ndcX + 1) / 2) *
        viewportWidth;

    /*
     * WebGL framebuffer Y grows upward.
     */
    const framebufferY =
      viewportY +
      ((ndcY + 1) / 2) *
        viewportHeight;

    const canvas =
      gl.canvas;

    const drawingWidth =
      gl.drawingBufferWidth;

    const drawingHeight =
      gl.drawingBufferHeight;

    if (
      !canvas ||
      drawingWidth <= 0 ||
      drawingHeight <= 0
    ) {
      return null;
    }

    const cssWidth =
      canvas.clientWidth;

    const cssHeight =
      canvas.clientHeight;

    if (
      cssWidth <= 0 ||
      cssHeight <= 0
    ) {
      return null;
    }

    /*
     * MapLibre's unproject() expects CSS pixels relative to the
     * map canvas/container, with Y=0 at the top.
     */
    const screenX =
      (
        framebufferX /
        drawingWidth
      ) *
      cssWidth;

    const screenY =
      (
        1 -
        framebufferY /
          drawingHeight
      ) *
      cssHeight;

    return [
      screenX,
      screenY,
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

      screen,
    };
  }

  // ===========================================================================
  // Longitude/latitude -> Wplace tile
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
  // Artwork PNG loading
  // ===========================================================================

  async function loadArtworkTile(
    tileX,
    tileY,
    forceRefresh,
  ) {
    const key =
      `${tileX}/${tileY}`;

    const now =
      Date.now();

    const cached =
      artworkTileCache.get(
        key,
      );

    if (
      !forceRefresh &&
      cached &&
      now - cached.time <
        COMPARISON_REFRESH_MS
    ) {
      return cached.promise;
    }

    const refreshBucket =
      Math.floor(
        now /
          COMPARISON_REFRESH_MS,
      );

    const promise =
      fetch(
        `${ARTWORK_TILE_ROOT}/${tileX}/${tileY}.png?wptt=${refreshBucket}`,
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
              `[Wplace Template Tools] Could not load artwork tile ${key}.`,
              error,
            );

            return null;
          },
        );

    artworkTileCache.set(
      key,
      {
        time: now,
        promise,
      },
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
  // Comparison
  // ===========================================================================

  async function buildMismatchMask(
    record,
    drawInfo,
    forceTileRefresh,
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

    /*
     * Save the geographic lookup for each opaque template pixel so we
     * only perform matrix transformation + unproject once per build.
     */
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

        lookups[pixelIndex] = {
          geographic,
          address,
        };

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

    const loadedTiles =
      new Map();

    await mapWithConcurrency(
      [
        ...requiredTiles.entries(),
      ],
      TILE_FETCH_CONCURRENCY,
      async ([
        key,
        tile,
      ]) => {
        const image =
          await loadArtworkTile(
            tile.x,
            tile.y,
            forceTileRefresh,
          );

        loadedTiles.set(
          key,
          image,
        );
      },
    );

    /*
     * Mask red:
     *
     * 255 = unfinished / wrong
     *   0 = already correct
     */
    const mask =
      new Uint8Array(
        drawInfo.width *
          drawInfo.height *
          4,
      );

    const matches = [];

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

        const templateAlpha =
          templatePixels[
            offset + 3
          ];

        if (
          templateAlpha < 1
        ) {
          continue;
        }

        comparedCount += 1;

        const lookup =
          lookups[pixelIndex];

        if (!lookup) {
          mask[offset] = 255;
          mismatchCount += 1;
          continue;
        }

        const {
          address,
          geographic,
        } = lookup;

        const tile =
          loadedTiles.get(
            address.key,
          );

        let matchesArtwork = false;
        let actualColor = null;

        let tilePixelX = null;
        let tilePixelY = null;

        if (tile) {
          tilePixelX =
            clampInteger(
              Math.floor(
                address.fractionalX *
                  tile.width,
              ),
              0,
              tile.width - 1,
            );

          tilePixelY =
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

          const actualAlpha =
            tile.data[
              tileOffset + 3
            ];

          if (
            actualAlpha > 0
          ) {
            actualColor = [
              tile.data[
                tileOffset
              ],
              tile.data[
                tileOffset + 1
              ],
              tile.data[
                tileOffset + 2
              ],
            ];

            matchesArtwork =
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

                actualColor[0],
                actualColor[1],
                actualColor[2],
              );
          }
        }

        if (matchesArtwork) {
          matches.push({
            x,
            y,

            template: [
              templatePixels[
                offset
              ],
              templatePixels[
                offset + 1
              ],
              templatePixels[
                offset + 2
              ],
            ],

            artwork:
              actualColor,

            longitude:
              geographic.lng,

            latitude:
              geographic.lat,

            screen:
              geographic.screen,

            tile: {
              x:
                address.tileX,

              y:
                address.tileY,

              pixelX:
                tilePixelX,

              pixelY:
                tilePixelY,
            },
          });
        } else {
          mask[offset] = 255;
          mismatchCount += 1;
        }
      }
    }

    return {
      mask,
      matches,
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

    const workers = [];

    const count =
      Math.min(
        concurrency,
        values.length,
      );

    for (
      let i = 0;
      i < count;
      i += 1
    ) {
      workers.push(
        runWorker(),
      );
    }

    await Promise.all(
      workers,
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

      /*
       * No vertical flip here.
       *
       * The mask's row order matches source_pixel.y in the template
       * fragment shader.
       */
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
  // Mask cache
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

        ready:
          false,

        building:
          false,

        builtAt:
          0,

        matches:
          [],

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
    ]
      .filter(
        (entry) =>
          entry.key !==
            preserveKey &&
          !entry.building,
      )
      .sort(
        (a, b) =>
          a.builtAt -
          b.builtAt,
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
    if (entry.building) {
      return;
    }

    const now =
      Date.now();

    if (
      entry.ready &&
      now - entry.builtAt <
        COMPARISON_REFRESH_MS
    ) {
      return;
    }

    entry.building = true;

    const token =
      ++entry.buildToken;

    const refreshing =
      entry.ready;

    /*
     * Capture the current matrix immediately.
     *
     * A later map movement can change the program's uniforms while
     * asynchronous tile requests are running.
     */
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
          const result =
            await buildMismatchMask(
              record,
              buildDrawInfo,
              refreshing,
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
          entry.builtAt =
            Date.now();

          entry.matches =
            result.matches;

          entry.comparedCount =
            result.comparedCount;

          entry.mismatchCount =
            result.mismatchCount;

          console.info(
            `[Wplace Template Tools] Comparison ready: ${result.mismatchCount} of ${result.comparedCount} template pixels still need work; ${result.matches.length} match.`,
          );

          requestMapRepaint();
        } catch (error) {
          console.warn(
            "[Wplace Template Tools] Could not build comparison.",
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
  // Bind comparison texture
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

    if (
      !record ||
      !state.enabled
    ) {
      return draw();
    }

    const drawInfo =
      inspectOverlayDraw(
        record,
      );

    if (!drawInfo) {
      native.uniform1i.call(
        gl,
        record.locations.maskReady,
        0,
      );

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

      texParameteri:
        prototype.texParameteri,

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
  // State changes
  // ===========================================================================

  function setEnabled(enabled) {
    if (
      state.enabled ===
      enabled
    ) {
      return;
    }

    state.enabled =
      enabled;

    state.records.forEach(
      setProgramUniform,
    );

    if (enabled) {
      markComparisonsStale();
      void getMapInstance();
    }

    updateButtons();
    requestMapRepaint();
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

    state.color = color;

    saveColor(color);

    state.records.forEach(
      setProgramUniform,
    );

    updateButtons();
    updateColorPickers();
    requestMapRepaint();
  }

  function setDebugMode(mode) {
    if (
      mode === "normal" ||
      mode === 0
    ) {
      state.debugMode =
        DEBUG_MODE_NORMAL;
    } else if (
      mode === "matches" ||
      mode === 1
    ) {
      state.debugMode =
        DEBUG_MODE_MATCHES;
    } else {
      throw new Error(
        'Debug mode must be "normal" or "matches".',
      );
    }

    state.records.forEach(
      setProgramUniform,
    );

    requestMapRepaint();

    console.info(
      `[Wplace Template Tools] Debug mode: ${
        state.debugMode ===
        DEBUG_MODE_MATCHES
          ? "matches"
          : "normal"
      }`,
    );
  }

  function markComparisonsStale() {
    for (
      const record of
      state.records
    ) {
      for (
        const entry of
        record.maskCache.values()
      ) {
        entry.builtAt = 0;
      }
    }
  }

  function refreshComparison() {
    artworkTileCache.clear();

    markComparisonsStale();

    requestMapRepaint();
  }

  function requestMapRepaint() {
    requestAnimationFrame(() => {
      globalThis.dispatchEvent(
        new Event("resize"),
      );
    });
  }

  // ===========================================================================
  // UI
  // ===========================================================================

  function updateButtons() {
    document
      .querySelectorAll(
        BUTTON_SELECTOR,
      )
      .forEach((button) => {
        button.classList.toggle(
          "btn-active",
          state.enabled,
        );

        button.setAttribute(
          "aria-pressed",
          String(state.enabled),
        );

        const title =
          state.enabled
            ? "Stop highlighting unfinished template pixels"
            : `Highlight unfinished template pixels in ${state.color.label.toLowerCase()}`;

        if (
          button.title !==
          title
        ) {
          button.title =
            title;
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
        fill="currentColor"
        class="size-3.5"
        aria-hidden="true"
      >
        <path d="M13 2 4.5 13H11l-1 9L19.5 10H13V2Z"></path>
      </svg>
    `;

    button.addEventListener(
      "click",
      () =>
        setEnabled(
          !state.enabled,
        ),
    );

    return button;
  }

  function updateColorPickers() {
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

        button.classList.toggle(
          "scale-110",
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
        COLOR_NAME_SELECTOR,
      )
      .forEach((label) => {
        const text =
          `${state.color.label} · ${state.color.hex.toUpperCase()}`;

        const textNode =
          label.firstChild;

        if (
          textNode?.nodeType ===
          Node.TEXT_NODE
        ) {
          if (
            textNode.nodeValue !==
            text
          ) {
            textNode.nodeValue =
              text;
          }

          return;
        }

        if (
          label.textContent !==
          text
        ) {
          label.textContent =
            text;
        }
      });
  }

  function makeColorPicker() {
    const picker =
      document.createElement(
        "section",
      );

    picker.dataset
      .wpttColorPicker = "";

    picker.className =
      "mx-4 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-base-200/60 px-3 py-2.5";

    picker.setAttribute(
      "aria-label",
      "Unfinished pixel highlight color",
    );

    const copy =
      document.createElement(
        "div",
      );

    const title =
      document.createElement(
        "p",
      );

    title.className =
      "text-sm font-medium";

    title.textContent =
      "Unfinished pixel color";

    const description =
      document.createElement(
        "p",
      );

    description.className =
      "text-base-content/50 text-xs";

    description.textContent =
      "Highlights template pixels that differ from the current artwork";

    copy.append(
      title,
      description,
    );

    const controls =
      document.createElement(
        "div",
      );

    controls.className =
      "flex flex-col items-end gap-1.5";

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
        () =>
          setColor(
            color.id,
          ),
      );

      swatches.append(
        button,
      );
    }

    const selectedName =
      document.createElement(
        "span",
      );

    selectedName.dataset
      .wpttColorName = "";

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
     * Initialize state before insertion so the document observer
     * doesn't get into a feedback loop.
     */
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

      button.classList.toggle(
        "scale-110",
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

    return picker;
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
        return toolbar;
      }
    }

    return null;
  }

  function ensureButton() {
    const toolbar =
      findOverlayToolbar();

    if (!toolbar) {
      return;
    }

    if (
      toolbar.querySelector(
        BUTTON_SELECTOR,
      )
    ) {
      updateButtons();
      return;
    }

    const firstDisplayOption =
      toolbar.querySelector(
        "button.btn-xs.btn-square",
      );

    const button =
      makeToggleButton();

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
      return;
    }

    if (
      !dialog.querySelector(
        COLOR_PICKER_SELECTOR,
      )
    ) {
      container.insertBefore(
        makeColorPicker(),
        gallery,
      );
    }

    updateColorPickers();
  }

  function ensureUi() {
    ensureButton();
    ensureColorPicker();
  }

  state.ensureUi =
    ensureUi;

  // ===========================================================================
  // DOM observer
  // ===========================================================================

  let ensureScheduled =
    false;

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
    },
  );

  ensureUi();

  // ===========================================================================
  // Periodic comparison refresh
  // ===========================================================================

  setInterval(() => {
    if (!state.enabled) {
      return;
    }

    markComparisonsStale();

    requestMapRepaint();
  }, COMPARISON_REFRESH_MS);

  // ===========================================================================
  // Diagnostics
  // ===========================================================================

  function getLatestEntry() {
    let latest = null;

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

        if (
          !latest ||
          entry.builtAt >
            latest.builtAt
        ) {
          latest = entry;
        }
      }
    }

    return latest;
  }

  function getMatches() {
    const latest =
      getLatestEntry();

    return latest
      ? latest.matches
      : [];
  }

  function logMatches() {
    const matches =
      getMatches();

    console.table(
      matches.map(
        (match) => ({
          x:
            match.x,

          y:
            match.y,

          template:
            match.template.join(
              ", ",
            ),

          artwork:
            match.artwork?.join(
              ", ",
            ) ?? "",

          lng:
            match.longitude,

          lat:
            match.latitude,

          tile:
            match.tile
              ? `${match.tile.x}/${match.tile.y}`
              : "",

          tilePixel:
            match.tile
              ? `${match.tile.pixelX},${match.tile.pixelY}`
              : "",
        }),
      ),
    );

    return matches;
  }

  globalThis.wplaceTemplateTools = {
    refreshComparison,
    setDebugMode,
    getMatches,
    logMatches,

    async getMapStatus() {
      const map =
        await getMapInstance();

      return map
        ? {
            captured: true,
            zoom:
              map.getZoom(),

            center:
              map.getCenter(),
          }
        : {
            captured: false,
          };
    },

    getStatus() {
      const latest =
        getLatestEntry();

      return {
        version: "0.4.0",

        enabled:
          state.enabled,

        mapCaptured:
          Boolean(state.map),

        debugMode:
          state.debugMode ===
          DEBUG_MODE_MATCHES
            ? "matches"
            : "normal",

        color:
          state.color.id,

        compared:
          latest?.comparedCount ??
          0,

        mismatches:
          latest?.mismatchCount ??
          0,

        matches:
          latest?.matches.length ??
          0,

        artworkTileZoom:
          ARTWORK_TILE_ZOOM,
      };
    },
  };

  console.info(
    "[Wplace Template Tools] 0.4.0 loaded.",
  );
})();