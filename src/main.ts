/**
 * Автономная страница игры. Dev-листы открываются параметром `?scene=…`.
 */
const root = document.getElementById('app');
if (!root) throw new Error('main: нет элемента #app');

const scene = new URLSearchParams(window.location.search).get('scene');

if (import.meta.env.DEV && scene === 'kit') {
  void import('./dev/kitSheet').then((m) => m.showKitSheet(root));
} else {
  root.textContent = '…';
}
