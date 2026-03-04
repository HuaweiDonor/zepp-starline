import { createWidget, widget, align, text_style } from '@zos/ui';
import { pop } from '@zos/router';

const SCREEN_W = 466;
const SCREEN_H = 466;

Page({
  build() {
    // Background
    createWidget(widget.FILL_RECT, {
      x: 0, y: 0,
      w: SCREEN_W, h: SCREEN_H,
      color: 0x1a1a1a,
    });

    // Title
    createWidget(widget.TEXT, {
      x: 40, y: 80,
      w: SCREEN_W - 80, h: 60,
      text: 'Запуск двигателя',
      text_size: 34,
      color: 0xffa500,
      align_h: align.CENTER_H,
    });

    // Description
    createWidget(widget.TEXT, {
      x: 40, y: 158,
      w: SCREEN_W - 80, h: 100,
      text: 'Подтвердите удаленный запуск двигателя',
      text_size: 26,
      color: 0xcccccc,
      align_h: align.CENTER_H,
      text_style: text_style.WRAP,
    });

    // Confirm button
    createWidget(widget.BUTTON, {
      x: 60, y: 278,
      w: SCREEN_W - 120, h: 70,
      text: 'Запустить',
      text_size: 30,
      normal_color: 0x1e8a1e,
      press_color: 0x156815,
      radius: 35,
      click_func: () => {
        const gd = getApp()._options.globalData;
        if (gd.mainPage && gd.pendingAction) {
          gd.mainPage.sendCommand(gd.pendingAction, 1);
        }
        gd.pendingAction = null;
        gd.mainPage = null;
        pop();
      },
    });

    // Cancel button
    createWidget(widget.BUTTON, {
      x: 60, y: 368,
      w: SCREEN_W - 120, h: 60,
      text: 'Отмена',
      text_size: 26,
      normal_color: 0x333333,
      press_color: 0x222222,
      radius: 30,
      click_func: () => {
        const gd = getApp()._options.globalData;
        gd.pendingAction = null;
        gd.mainPage = null;
        pop();
      },
    });
  },
});
