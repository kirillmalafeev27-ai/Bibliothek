/**
 * Шрифты серии подключаются локально через @fontsource (план, 11.7.2):
 * никаких запросов во внешнюю сеть.
 */
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/600.css';
import '@fontsource/rubik/700.css';
import '@fontsource/unifrakturmaguntia/400.css';
import '@fontsource/ruslan-display/400.css';

export const FONT = {
  /** Интерфейс и задания. */
  ui: 'Rubik',
  /** Немецкие слова-звуки и подзаголовок. Только латиница. */
  fraktur: 'UnifrakturMaguntia',
  /** Русское название и заголовки экранов. */
  display: 'Ruslan Display',
} as const;

/**
 * Дожидается загрузки шрифтов до рисования на канве (7.3.5), иначе текст
 * нарисуется запасным шрифтом. Образцы включают умлауты и кириллицу, чтобы
 * браузер подтянул нужные поднаборы.
 */
export async function loadFonts(timeoutMs = 4000): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const jobs = [
    document.fonts.load(`400 16px "${FONT.ui}"`, 'Aä ß Жж'),
    document.fonts.load(`600 16px "${FONT.ui}"`, 'Aä ß Жж'),
    document.fonts.load(`700 16px "${FONT.ui}"`, 'Aä ß Жж'),
    document.fonts.load(`400 32px "${FONT.fraktur}"`, 'Ungültig Wörterbuch Psst!'),
    document.fonts.load(`400 32px "${FONT.display}"`, 'Слепой библиотекарь Night'),
  ];
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  await Promise.race([Promise.allSettled(jobs).then(() => undefined), timeout]);
}
