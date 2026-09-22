# Roleta do Perguntados

A spinner wheel for Perguntados / Trivia Crack board game sessions. Tap the board and the pointer spins until it stops on a category.

**Live:** https://www.victornogueira.app/roleta-perguntados/

| Light | Dark |
| --- | --- |
| <img src="screenshots/light.png" alt="Spinner in light theme, pointer stopped on Ciências" width="100%"> | <img src="screenshots/dark.png" alt="Spinner in dark theme, pointer stopped on Entretenimento" width="100%"> |

## What it does

- Seven sectors: Geografia, História, Ciências, Arte, Esportes, Entretenimento and Coroa. The **Coroa** toggle drops the wheel to six real sectors rather than skipping a drawn one.
- The pointer spins over a fixed disc, the same way the cardboard spinner works.
- One tick per sector the pointer crosses, decelerating along with it. **Som** turns it off.
- Last eight rounds stay on screen.
- Space bar spins. Honours `prefers-reduced-motion` (jumps straight to the result) and follows the system light/dark theme.
- The Coroa and Som choices persist in `localStorage`.

## Fair draw

The target sector is drawn uniformly first, and the final angle is derived from it — never the other way round. The landing point is always at least 9.8° from a sector border, so the pointer never stops somewhere ambiguous.

Verified two ways: 600,000 simulated spins stay within the expected range for a uniform draw (χ² = 6.4 on 6 d.f. for seven sectors, 8.5 on 5 d.f. for six), and 48 headless-browser spins hit-test the pixel under the pointer tip against the announced category, matching every time in both modes.

## Running it

One file, no build step, no dependencies:

```sh
python3 -m http.server
```

Then open `http://localhost:8000`. Opening `index.html` straight from the filesystem works too.

The only external request is the Google Fonts stylesheet (Baloo 2 and Archivo). Offline, it falls back to system faces.

## Verification

The color and landing checks live in `verify/check.mjs`. Dev-only tooling: the page itself stays a single dependency-free file.

```sh
npm install
npm run verify   # palette + forced-landing checks
npm run shots    # the above, then rewrite screenshots/{light,dark}.png
```

It serves the repo over a throwaway local port and drives headless Chromium:

- Every wedge fill, legend dot and icon stroke, with Coroa on (seven sectors) and off (six).
- A forced stop on each of the seven categories, checking the result card carries that category's color and its text clears 3:1 against it. The palette has a bright yellow, so the text color is derived per category instead of fixed white.
- When regenerating the screenshots: the announced category, the history chips and the sector count.

The fair-draw simulation above was run ad hoc and is not part of this script.

## Notes

Perguntados and Trivia Crack are trademarks of Etermax. This is an unofficial spinner with its own icons, not affiliated with or endorsed by Etermax.

## License

MIT
