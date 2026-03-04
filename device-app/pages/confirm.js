import { createWidget, widget, align, text_style, prop } from '@zos/ui';
import { px } from '@zos/utils';
import messageBuilder from '../shared/message';

const SCREEN_W = 466;
const SCREEN_H = 466;

let onConfirm = null;

export function showConfirmScreen(callback) {
  onConfirm = callback;
  hmApp.gotoPage({ url: 'device-app/pages/confirm' });
}

Page({
  build() {
    // Background
    createWidget(widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: SCREEN_W,
      h: SCREEN_H,
      color: 0x1a1a1a,
    });

    // Warning icon / title
    createWidget(widget.TEXT, {
      x: px(40),
      y: px(80),
      w: SCREEN_W - px(80),
      h: px(60),
      text: '⚠ Запуск двигателя',
      text_size: px(36),
      color: 0xffa500,
      align_h: align.CENTER_H,
    });

    createWidget(widget.TEXT, {
      x: px(40),
      y: px(160),
      w: SCREEN_W - px(80),
      h: px(80),
      text: 'Подтвердите удалённый запуск двигателя',
      text_size: px(28),
      color: 0xcccccc,
      align_h: align.CENTER_H,
      text_style: text_style.WRAP,
    });

    // Confirm button
    const confirmBtn = createWidget(widget.BUTTON, {
      x: px(60),
      y: px(280),
      w: SCREEN_W - px(120),
      h: px(70),
      text: 'Запустить',
      text_size: px(32),
      normal_color: 0x1e8a1e,
      press_color: 0x156815,
      radius: px(35),
      click_func: () => {
        if (onConfirm) onConfirm(true);
        hmApp.goBack();
      },
    });

    // Cancel button
    createWidget(widget.BUTTON, {
      x: px(60),
      y: px(370),
      w: SCREEN_W - px(120),
      h: px(60),
      text: 'Отмена',
      text_size: px(28),
      normal_color: 0x333333,
      press_color: 0x222222,
      radius: px(30),
      click_func: () => {
        if (onConfirm) onConfirm(false);
        hmApp.goBack();
      },
    });
  },

  onDestroy() {
    onConfirm = null;
  },
});
