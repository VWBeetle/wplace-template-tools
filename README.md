# Wplace Template Tools

A Tampermonkey userscript that adds extra controls to the template overlay toolbar on [wplace.live](https://wplace.live/).

## Features
* Highlight toggle to spot missing pixels more easily
* Configurable pulse mode for highlight, making it even more noticeable
* Swappable highlight color in template modal
* New +-shaped preview pixels for your overlays
* Finished image preview so you can see what it will look like when complete
* Gives 'full pixel' transparency mode a new icon to better represent what it does and gives the old icon to the new "finished image preview" option

## Highlight Toggle

When an overlay is open, a lightning-bolt button appears on the template toolbar. Turn it on to render every currently visible preview pixel in a high-visibility color. Press it again to make the color pulse.

Note that you can still freely change the shape of your preview pixels or sort them by color. Only the pixels that aren't yet correct will be highlighted.

Choose the visibility color from the **Preview visibility color** setting at the top of Wplace's Overlays modal. The selected preset is saved across reloads. Available colors are:

- Neon magenta (`#ff00ff`)
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
