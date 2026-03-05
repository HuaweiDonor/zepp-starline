import { createWidget, widget, align, text_style } from '@zos/ui';
import { push } from '@zos/router';
import { vibrate } from '@zos/interaction';

const SCREEN_W = 466;
const SCREEN_H = 466;
const { messageBuilder } = getApp()._options.globalData;

let statusText = null;
let engineBtn = null;
let alarmBtn = null;
let loadingText = null;
let currentStatus = null;
let isLoading = false;

function setLoading(loading) {
  isLoading = loading;
  if (loadingText) {
    loadingText.setProperty(widget.TEXT, { visible: loading });
  }
  if (engineBtn) {
    engineBtn.setProperty(widget.BUTTON, { enable: !loading });
  }
  if (alarmBtn) {
    alarmBtn.setProperty(widget.BUTTON, { enable: !loading });
  }
}

function updateStatusDisplay(status) {
  currentStatus = status;
  if (!statusText) return;

  let lines = [];
  if (status.engine) {
    lines.push('Двигатель: ЗАПУЩЕН');
  } else {
    lines.push('Двигатель: выключен');
  }
  if (status.temp !== null && status.temp !== undefined) {
    lines.push('Темп: ' + status.temp + ' C');
  }
  if (status.alarm) {
    lines.push('ОХРАНА АКТИВНА');
  } else {
    lines.push('Охрана: выкл');
  }

  statusText.setProperty(widget.TEXT, { text: lines.join('\n') });

  if (engineBtn) {
    if (status.engine) {
      engineBtn.setProperty(widget.BUTTON, {
        text: 'Остановить',
        normal_color: 0x8b1a1a,
        press_color: 0x5c1111,
      });
    } else {
      engineBtn.setProperty(widget.BUTTON, {
        text: 'Запустить',
        normal_color: 0x1e8a1e,
        press_color: 0x156815,
      });
    }
  }

  if (alarmBtn) {
    if (status.alarm) {
      alarmBtn.setProperty(widget.BUTTON, {
        text: 'Снять охрану',
        normal_color: 0x8b4500,
        press_color: 0x5c2e00,
      });
    } else {
      alarmBtn.setProperty(widget.BUTTON, {
        text: 'Охрана',
        normal_color: 0x1a5c8a,
        press_color: 0x114060,
      });
    }
  }
}

function fetchStatus() {
  setLoading(true);
  messageBuilder
    .request({ cmd: 'get_status' })
    .then((res) => {
      setLoading(false);
      if (res && res.code === 0) {
        updateStatusDisplay(res.data);
      } else {
        statusText && statusText.setProperty(widget.TEXT, {
          text: 'Ошибка: ' + ((res && res.message) || 'нет связи'),
        });
      }
    })
    .catch((err) => {
      setLoading(false);
      statusText && statusText.setProperty(widget.TEXT, {
        text: 'Ошибка связи',
      });
    });
}

function sendCommand(cmd, value) {
  setLoading(true);
  messageBuilder
    .request({ cmd, value })
    .then((res) => {
      setLoading(false);
      if (res && res.code === 0) {
        vibrate({ mode: 0 });
        updateStatusDisplay(res.data);
      } else {
        vibrate({ mode: 1 });
        statusText && statusText.setProperty(widget.TEXT, {
          text: 'Ошибка: ' + ((res && res.message) || 'команда не выполнена'),
        });
      }
    })
    .catch(() => {
      setLoading(false);
      vibrate({ mode: 1 });
      statusText && statusText.setProperty(widget.TEXT, {
        text: 'Ошибка связи',
      });
    });
}

Page({
  state: {},

  build() {
    // Background
    createWidget(widget.FILL_RECT, {
      x: 0, y: 0,
      w: SCREEN_W, h: SCREEN_H,
      color: 0x121212,
    });

    // App title
    createWidget(widget.TEXT, {
      x: 0, y: 18,
      w: SCREEN_W, h: 42,
      text: 'StarLine Remote',
      text_size: 28,
      color: 0xffffff,
      align_h: align.CENTER_H,
    });

    // Status area
    statusText = createWidget(widget.TEXT, {
      x: 30, y: 68,
      w: SCREEN_W - 60, h: 120,
      text: 'Загрузка...',
      text_size: 26,
      color: 0xcccccc,
      align_h: align.CENTER_H,
      text_style: text_style.WRAP,
    });

    // Loading indicator
    loadingText = createWidget(widget.TEXT, {
      x: 0, y: 190,
      w: SCREEN_W, h: 30,
      text: 'Подождите...',
      text_size: 22,
      color: 0x888888,
      align_h: align.CENTER_H,
      visible: false,
    });

    // Engine start/stop button
    engineBtn = createWidget(widget.BUTTON, {
      x: 40, y: 230,
      w: SCREEN_W - 80, h: 70,
      text: 'Запустить',
      text_size: 30,
      normal_color: 0x1e8a1e,
      press_color: 0x156815,
      radius: 35,
      click_func: () => {
        if (isLoading) return;
        if (!currentStatus || !currentStatus.engine) {
          // Starting engine — show confirm screen
          const gd = getApp()._options.globalData;
          gd.pendingAction = 'r_start';
          gd.mainPage = { sendCommand };
          push({ url: 'device-app/pages/confirm' });
        } else {
          // Stopping engine — no confirmation needed
          sendCommand('r_start', 0);
        }
      },
    });

    // Alarm toggle button
    alarmBtn = createWidget(widget.BUTTON, {
      x: 40, y: 318,
      w: SCREEN_W - 80, h: 60,
      text: 'Охрана',
      text_size: 26,
      normal_color: 0x1a5c8a,
      press_color: 0x114060,
      radius: 30,
      click_func: () => {
        if (isLoading) return;
        const alarmValue = (currentStatus && currentStatus.alarm) ? 0 : 1;
        sendCommand('alarm', alarmValue);
      },
    });

    // Refresh button (small, bottom)
    createWidget(widget.BUTTON, {
      x: 163, y: 396,
      w: 140, h: 44,
      text: 'Обновить',
      text_size: 22,
      normal_color: 0x333333,
      press_color: 0x222222,
      radius: 22,
      click_func: () => {
        if (!isLoading) fetchStatus();
      },
    });

    // Load status on page open
    fetchStatus();
  },
});
