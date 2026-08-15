# Wplace Template Tools

A Tampermonkey userscript that adds extra controls to the template overlay toolbar on [wplace.live](https://wplace.live/).

## Preview visibility toggle

When an overlay is open, a lightning-bolt button appears between **Back** and Wplace's existing pixel display options. Turn it on to render every currently visible preview pixel in a high-visibility color. Turn it off to restore the overlay's original colors.

Choose the visibility color from the **Preview visibility color** setting at the top of Wplace's Overlays modal. The selected preset is saved across reloads. Available colors are:

- Magenta (`#ff00ff`)
- Neon green (`#39ff14`)
- Neon yellow (`#fff01f`)
- Neon orange (`#ff5f1f`)
- Neon cyan (`#00ffff`)

The toggle changes only the local preview. It does not edit the overlay image or place pixels.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your browser.
2. Open [`wplace-template-tools.user.js`](./wplace-template-tools.user.js) and copy it into a new Tampermonkey script.
3. Save the script and reload `https://wplace.live/`.

Once this file is available on the repository's `main` branch, Tampermonkey can also install it from the [raw userscript URL](https://raw.githubusercontent.com/VWBeetle/wplace-template-tools/main/wplace-template-tools.user.js).

## Development

Run the dependency-free test suite with:

```sh
node --test
```

The userscript runs at `document-start` because it adds a small, reversible uniform to Wplace's overlay shader as that shader is compiled. It does not automate painting, change cooldowns, or make network requests.
