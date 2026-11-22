/**
 * Плашка снаряжения (план, 11.3): карта из трёх частей, словари, читательские билеты
 * с портретом героя, кнопки «Бросить», «Стоять» и пауза. Лежит на поле страницы
 * в верхнем углу панели мира и на библиотеку не заходит.
 */
import { balance } from '../config/balance';
import type { GameState } from '../core';
import { ru } from '../i18n/ru';
import type { Layout } from '../shared/layout';
import { rectStyle } from '../shared/layout';

export interface GearHandlers {
  onThrow: () => void;
  onStay: () => void;
  onPause: () => void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function iconButton(act: string, label: string, hint: string, icon: string): HTMLButtonElement {
  const b = el('button', 'lib-icon-btn');
  b.type = 'button';
  b.dataset.act = act;
  b.title = hint;
  b.setAttribute('aria-label', hint);
  const i = el('span', 'lib-icon-btn__icon');
  i.style.backgroundImage = `var(${icon})`;
  const t = el('span', 'lib-icon-btn__label');
  t.textContent = label;
  b.append(i, t);
  return b;
}

export class GearWidget {
  readonly el: HTMLElement;
  private readonly pagesBox: HTMLElement;
  private readonly booksBox: HTMLElement;
  private readonly cardsBox: HTMLElement;
  private readonly pages: HTMLElement[] = [];
  private readonly books: HTMLElement[] = [];
  private cards: HTMLElement[] = [];
  private readonly throwBtn: HTMLButtonElement;
  private readonly stayBtn: HTMLButtonElement;
  private readonly pauseBtn: HTMLButtonElement;
  private shown = { pages: -1, books: -1, cards: -1, total: -1 };

  constructor(handlers: GearHandlers) {
    this.el = el('div', 'lib-gear');
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-label', ru.gearLabel);
    const group = el('div', 'lib-gear__group');
    this.pagesBox = el('div', 'lib-gear__items lib-gear__map');
    this.pagesBox.setAttribute('role', 'img');
    for (let i = 0; i < balance.pages; i++) {
      const s = el('span', 'lib-slot lib-slot--page is-empty');
      s.style.backgroundImage = `var(--icon-page-${i})`;
      s.style.margin = '0 -3px';
      this.pages.push(s);
      this.pagesBox.append(s);
    }
    this.booksBox = el('div', 'lib-gear__items');
    this.booksBox.setAttribute('role', 'img');
    for (let i = 0; i < balance.maxBooks; i++) {
      const s = el('span', 'lib-slot lib-slot--book is-empty');
      s.style.backgroundImage = 'var(--icon-book)';
      this.books.push(s);
      this.booksBox.append(s);
    }
    this.cardsBox = el('div', 'lib-gear__items');
    this.cardsBox.setAttribute('role', 'img');
    group.append(this.pagesBox, el('span', 'lib-gear__sep'), this.booksBox, el('span', 'lib-gear__sep'), this.cardsBox);

    const buttons = el('div', 'lib-gear__buttons');
    this.throwBtn = iconButton('throw', ru.btnThrow, ru.btnThrowHint, '--icon-throw');
    this.stayBtn = iconButton('stay', ru.btnStay, ru.btnStayHint, '--icon-stay');
    this.pauseBtn = iconButton('pause', '', ru.btnPauseHint, '--icon-pause');
    this.pauseBtn.querySelector('.lib-icon-btn__label')?.remove();
    this.throwBtn.addEventListener('click', handlers.onThrow);
    this.stayBtn.addEventListener('click', handlers.onStay);
    this.pauseBtn.addEventListener('click', handlers.onPause);
    buttons.append(this.throwBtn, this.stayBtn, this.pauseBtn);
    this.el.append(group, buttons);
  }

  layout(layout: Layout): void {
    rectStyle(this.el, layout.gear);
    this.el.dataset.placement = layout.gearPlacement;
    this.el.dataset.tier = layout.tier;
    const narrow = layout.gearPlacement === 'top' && layout.gear.w < 470;
    this.el.classList.toggle('is-narrow', narrow);
    const btn = layout.tier === 'ultra' ? 32 : layout.tier === 'compact' ? 36 : 40;
    let slot = layout.tier === 'ultra' ? 21 : layout.tier === 'compact' ? 24 : 27;
    if (layout.gearPlacement === 'top') {
      // Восемь ячеек (3 листа, 3 словаря, 2 билета) и три кнопки должны влезть в ширину.
      const free = layout.gear.w - 3 * btn - 2 * 6 - 6 - 44;
      slot = Math.max(16, Math.min(slot, Math.floor(free / 8.4)));
    }
    this.el.style.setProperty('--slot', `${slot}px`);
    this.el.style.setProperty('--gear-btn', `${btn}px`);
    this.el.style.setProperty('--gear-size', `${layout.gearPlacement === 'top' ? layout.gear.h : layout.gear.w}px`);
  }

  /** Центр слота листа в CSS-пикселях панели мира — туда летит подобранный лист. */
  pageSlotPoint(pageId: number): { x: number; y: number } | null {
    const slot = this.pages[pageId];
    const parent = this.el.parentElement;
    if (!slot || !parent) return null;
    const r = slot.getBoundingClientRect();
    const p = parent.getBoundingClientRect();
    return { x: r.left + r.width / 2 - p.left, y: r.top + r.height / 2 - p.top };
  }

  update(state: GameState, aiming: boolean): void {
    const h = state.hero;
    const pages = h.pages.length;
    if (pages !== this.shown.pages) {
      for (let i = 0; i < this.pages.length; i++) {
        const has = h.pages.includes(i);
        const slot = this.pages[i] as HTMLElement;
        const was = !slot.classList.contains('is-empty');
        slot.classList.toggle('is-empty', !has);
        if (has && !was && this.shown.pages >= 0) this.pop(slot, 480);
      }
      this.pagesBox.setAttribute('aria-label', ru.gearMapCount(pages));
      this.shown.pages = pages;
    }
    if (h.books !== this.shown.books) {
      for (let i = 0; i < this.books.length; i++) {
        const slot = this.books[i] as HTMLElement;
        const has = i < h.books;
        const was = !slot.classList.contains('is-empty');
        slot.classList.toggle('is-empty', !has);
        if (has && !was && this.shown.books >= 0) this.pop(slot, 200);
      }
      this.booksBox.setAttribute('aria-label', ru.gearBooksCount(h.books));
      this.shown.books = h.books;
    }
    const total = state.level.cards;
    if (total !== this.shown.total) {
      this.cards = [];
      this.cardsBox.replaceChildren();
      for (let i = 0; i < total; i++) {
        const s = el('span', 'lib-slot lib-slot--card');
        s.style.backgroundImage = 'var(--icon-card)';
        this.cards.push(s);
        this.cardsBox.append(s);
      }
      this.shown.total = total;
      this.shown.cards = -1;
    }
    if (h.cards !== this.shown.cards) {
      // Отобранный билет перечёркнут штампом «Ungültig» — отбираются с конца.
      for (let i = 0; i < this.cards.length; i++) {
        this.cards[i]?.classList.toggle('is-void', i >= h.cards);
      }
      this.cardsBox.setAttribute('aria-label', ru.gearCardsCount(h.cards));
      this.shown.cards = h.cards;
    }
    const playing = state.status === 'playing' && !state.paused;
    this.throwBtn.disabled = !playing || (h.books <= 0 && !aiming);
    this.throwBtn.classList.toggle('is-on', aiming);
    const label = this.throwBtn.querySelector('.lib-icon-btn__label');
    if (label) label.textContent = aiming ? ru.btnThrowCancel : ru.btnThrow;
    this.stayBtn.disabled = !playing;
    this.stayBtn.classList.toggle('is-on', playing && h.intent.kind === 'stay' && !aiming);
    this.pauseBtn.disabled = state.status === 'won' || state.status === 'lost';
  }

  private pop(slot: HTMLElement, delayMs: number): void {
    window.setTimeout(() => {
      slot.classList.remove('is-pop');
      void slot.offsetWidth;
      slot.classList.add('is-pop');
    }, delayMs);
  }

  destroy(): void {
    this.el.remove();
  }
}
