import { createWidget, widget, prop, align } from '@zos/ui';
import { vibrate, onGesture, GESTURE_RIGHT } from '@zos/interaction';
import { pop } from '@zos/router';

const { messageBuilder } = getApp()._options.globalData;

let isLoading = false;

function fetchStatus() {
  isLoading = true;
  messageBuilder.request({ cmd: 'get_status' })
    .then((res) => {
      isLoading = false;
      if (res && res.code === 0) {
        vibrate({ mode: 0 });
        getApp()._options.globalData.currentStatus = res.data;
      } else {
        vibrate({ mode: 1 });
      }
    })
    .catch(() => {
      isLoading = false;
      vibrate({ mode: 1 });
    });
}

Page({
  build() {
    createWidget(widget.FILL_RECT, { x: 0, y: 0, w: 466, h: 466, color: 0x121212 });

    createWidget(widget.TEXT, {
      x: 0, y: 20, w: 466, h: 40,
      text: 'Обновить',
      text_size: 24, color: 0x888888, align_h: align.CENTER_H,
    });

    createWidget(widget.BUTTON, {
      x: 133, y: 133, w: 200, h: 200, radius: 100,
      normal_src: 'btn_refresh.png',
      press_src:  'btn_refresh.png',
      click_func: () => { if (!isLoading) fetchStatus(); },
    });

    createWidget(widget.TEXT, {
      x: 0, y: 350, w: 466, h: 30,
      text: 'Нажмите для обновления',
      text_size: 18, color: 0x888888, align_h: align.CENTER_H,
    });

    createWidget(widget.TEXT, {
      x: 0, y: 440, w: 466, h: 22,
      text: '○ ○ ●',
      text_size: 18, color: 0x444444, align_h: align.CENTER_H,
    });

    onGesture({
      callback: (g) => {
        if (g === GESTURE_RIGHT) pop();
      },
    });
  },
});
