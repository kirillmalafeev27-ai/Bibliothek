/**
 * Слова-звуки (план, 9.3). Немецкие, как во всей серии; пишутся фрактурой и в обычном
 * регистре: капслок фрактурой почти нечитаем, а заглавные буквы существительных
 * («Ruhe», «Ausweis») — часть того, что ученик учит.
 */
export const sfxDe = {
  psst: 'Psst!',
  knarr: 'Knarr!',
  raschel: 'Raschel',
  schnapp: 'Schnapp!',
  rums: 'Rums!',
  plumps: 'Plumps!',
  hm: 'Hm?',
  schnupper: 'Schnupper…',
  werDa: 'Wer da?',
  ruhe: 'Ruhe!',
  ruheAngry: 'Ruhe!!',
  woBistDu: 'Wo bist du?',
  hmpf: 'Hmpf.',
  ausweis: 'Ausweis, bitte!',
  ungueltig: 'Ungültig!',
  raus: 'Raus!',
  geschafft: 'Geschafft!',
  knapp: 'Knapp!',
  schnarch: 'Schnarch…',
  klimper: 'Klimper',
} as const;

export type SfxKey = keyof typeof sfxDe;

/** Русские слова-звуки — если язык слов переключён в настройках (9.3). */
export const sfxRu: Record<SfxKey, string> = {
  psst: 'Тсс!',
  knarr: 'Скрип!',
  raschel: 'Шурх',
  schnapp: 'Хвать!',
  rums: 'Бум!',
  plumps: 'Бух!',
  hm: 'Хм?',
  schnupper: 'Нюх-нюх…',
  werDa: 'Кто там?',
  ruhe: 'Тишина!',
  ruheAngry: 'Тишина!!',
  woBistDu: 'Где ты?',
  hmpf: 'Хмф.',
  ausweis: 'Билет, пожалуйста!',
  ungueltig: 'Недействителен!',
  raus: 'Вон!',
  geschafft: 'Получилось!',
  knapp: 'Еле успел!',
  schnarch: 'Хррр…',
  klimper: 'Звяк',
};

export type SfxLang = 'de' | 'ru';

export function sfxWord(key: SfxKey, lang: SfxLang): string {
  return lang === 'ru' ? sfxRu[key] : sfxDe[key];
}
