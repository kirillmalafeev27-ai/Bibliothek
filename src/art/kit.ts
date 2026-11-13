/**
 * Краски рукописного кита — из палитры игры. Кит общий для серии и своих цветов не имеет.
 */
import { palette } from '../config/palette';
import { configureKit } from '../shared/manuscriptKit';

let done = false;

export function setupKit(): void {
  if (done) return;
  done = true;
  configureKit({
    parchment: palette.parchment,
    parchmentShade: palette.parchmentShade,
    parchmentEdge: palette.parchmentEdge,
    paperWhite: palette.derived.paperWhite,
    ink: palette.ink,
    inkFaded: palette.inkFaded,
    rubric: palette.rubric,
    gold: palette.gold,
    accentBlue: palette.librarian.robe,
    accentRed: palette.rubric,
  });
}
