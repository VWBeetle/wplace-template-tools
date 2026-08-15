# Wplace Template Tools

A Tampermonkey userscript that adds extra controls to the template overlay toolbar on [wplace.live](https://wplace.live/).

Right now it only adds one new tool, but I plan to add others.

## Highlight Toggle

When an overlay is open, a lightning-bolt button appears on the template toolbar. Turn it on to render every currently visible preview pixel in a high-visibility color. Press it again to make the color pulse.

Note that you can still freely change the shape of your preview pixels or sort them by color. Only the pixels that aren't yet correct will be highlighted.

Choose the visibility color from the **Preview visibility color** setting at the top of Wplace's Overlays modal. The selected preset is saved across reloads. Available colors are:

- Magenta (`#ff00ff`)
- Neon green (`#39ff14`)
- Neon yellow (`#fff01f`)
- Neon orange (`#ff5f1f`)
- Neon cyan (`#00ffff`)

The toggle changes only the preview. It does not edit the overlay image or place pixels. It's just to help find those sneaky ones you keep missing.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your browser.
2. Open [this link](https://raw.githubusercontent.com/VWBeetle/wplace-template-tools/main/wplace-template-tools.user.js) and Tampermonkey should prompt you to install the script
3. Reload wplace.live

## License
MIT License
