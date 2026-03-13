import { createWidget, widget, prop, align, text_style } from '@zos/ui';
import { push } from '@zos/router';
import { vibrate } from '@zos/interaction';

const SCREEN_W = 466;
const SCREEN_H = 466;
const { messageBuilder } = getApp()._options.globalData;

let engineStateText = null;
let alarmStateText  = null;
let etempValue      = null;
let etempLabel      = null;
let batteryValue    = null;
let batteryLabel    = null;
let balanceValue    = null;
let balanceLabel    = null;
let etempTile       = null;
let batteryTile     = null;
let balanceTile     = null;
let engineBtn       = null;
let alarmBtn        = null;

let currentStatus = null;
let isLoading     = false;

function setLoading(loading) {
  isLoading = loading;
  if (engineBtn) {
    if (loading) {
      engineBtn.setProperty(widget.BUTTON, {
        text: 'Загрузка...',
        enable: false,
        normal_color: 0x2a2a2a,
        press_color:  0x2a2a2a,
      });
    } else if (currentStatus) {
      updateStatusDisplay(currentStatus);
    } else {
      engineBtn.setProperty(widget.BUTTON, { enable: true });
    }
  }
  alarmBtn && alarmBtn.setProperty(widget.BUTTON, { enable: !loading });
}

// Hides/shows a metric tile: value text + label text
function setTileVisible(tileRect, valueText, labelText, visible) {
  valueText.setProperty(prop.VISIBLE, visible);
  labelText.setProperty(prop.VISIBLE, visible);
}

function updateStatusDisplay(status) {
  currentStatus = status;

  // ── Widget visibility (from settings toggles) ───────────────────────────────
  if (etempTile) {
    const show = status.show_etemp !== false;
    setTileVisible(etempTile, etempValue, etempLabel, show);
  }
  if (batteryTile) {
    const show = status.show_battery !== false;
    setTileVisible(batteryTile, batteryValue, batteryLabel, show);
  }
  if (balanceTile) {
    const show = status.show_balance !== false;
    setTileVisible(balanceTile, balanceValue, balanceLabel, show);
  }

  // ── Engine/alarm state ──────────────────────────────────────────────────────
  if (engineStateText) {
    engineStateText.setProperty(prop.TEXT, status.engine ? 'РАБОТАЕТ' : 'Выкл');
  }
  if (alarmStateText) {
    alarmStateText.setProperty(prop.TEXT, status.alarm ? 'ОХРАНА' : 'Снята');
  }

  // ── Metrics ─────────────────────────────────────────────────────────────────
  if (etempValue) {
    const t = status.etemp;
    etempValue.setProperty(prop.TEXT, (t !== null && t !== undefined) ? t + '°C' : '--');
  }
  if (batteryValue) {
    const v = status.battery;
    batteryValue.setProperty(prop.TEXT, (v !== null && v !== undefined) ? (+v).toFixed(1) + 'В' : '--');
  }
  if (balanceValue) {
    const b = status.balance;
    balanceValue.setProperty(prop.TEXT, (b !== null && b !== undefined) ? b + ' ₽' : '--');
  }

  // ── Engine button ────────────────────────────────────────────────────────────
  if (engineBtn) {
    engineBtn.setProperty(widget.BUTTON, {
      text:         status.engine ? 'Остановить' : 'Запустить',
      enable:       true,
      normal_color: status.engine ? 0x8b1a1a : 0x1e8a1e,
      press_color:  status.engine ? 0x5c1111 : 0x156815,
    });
  }

  // ── Alarm button ─────────────────────────────────────────────────────────────
  if (alarmBtn) {
    alarmBtn.setProperty(widget.BUTTON, {
      text:         status.alarm ? 'Снять охрану' : 'Охрана',
      normal_color: status.alarm ? 0x8b4500 : 0x1a5c8a,
      press_color:  status.alarm ? 0x5c2e00 : 0x114060,
    });
  }
}

function fetchStatus() {
  setLoading(true);
  messageBuilder.request({ cmd: 'get_status' })
    .then((res) => {
      setLoading(false);
      try {
        if (res && res.code === 0) {
          updateStatusDisplay(res.data);
        } else {
          const dbg = res ? ('code=' + res.code) : 'null';
          engineStateText && engineStateText.setProperty(prop.TEXT, dbg);
          engineBtn && engineBtn.setProperty(widget.BUTTON, {
            text: 'Повтор', enable: true, normal_color: 0x333333, press_color: 0x222222,
          });
        }
      } catch (e) {
        engineStateText && engineStateText.setProperty(prop.TEXT,
          'ERR:' + (e && e.message ? e.message.slice(0, 20) : '?'));
      }
    })
    .catch((e) => {
      setLoading(false);
      const msg = (e && e.message) ? e.message.slice(0, 15) : 'timeout';
      engineStateText && engineStateText.setProperty(prop.TEXT, msg);
      engineBtn && engineBtn.setProperty(widget.BUTTON, {
        text: 'Повтор', enable: true, normal_color: 0x333333, press_color: 0x222222,
      });
    });
}

function sendCommand(cmd, value) {
  setLoading(true);
  messageBuilder.request({ cmd, value })
    .then((res) => {
      setLoading(false);
      if (res && res.code === 0) {
        vibrate({ mode: 0 });
        updateStatusDisplay(res.data);
      } else {
        vibrate({ mode: 1 });
        engineStateText && engineStateText.setProperty(prop.TEXT, 'Ошибка');
        if (engineBtn) {
          engineBtn.setProperty(widget.BUTTON, {
            text: 'Повтор', enable: true, normal_color: 0x333333, press_color: 0x222222,
          });
        }
      }
    })
    .catch(() => {
      setLoading(false);
      vibrate({ mode: 1 });
    });
}

Page({
  state: {},

  build() {
    // ── Background ─────────────────────────────────────────────────────────────
    createWidget(widget.FILL_RECT, {
      x: 0, y: 0, w: SCREEN_W, h: SCREEN_H,
      color: 0x121212,
    });

    // ── Title ──────────────────────────────────────────────────────────────────
    createWidget(widget.TEXT, {
      x: 0, y: 16, w: SCREEN_W, h: 36,
      text: 'StarLine Remote',
      text_size: 26,
      color: 0xffffff,
      align_h: align.CENTER_H,
    });

    // ── Status bar: Engine | Alarm ─────────────────────────────────────────────
    createWidget(widget.TEXT, {
      x: 0, y: 56, w: 233, h: 20,
      text: 'Двигатель',
      text_size: 16,
      color: 0x555555,
      align_h: align.CENTER_H,
    });
    createWidget(widget.TEXT, {
      x: 233, y: 56, w: 233, h: 20,
      text: 'Охрана',
      text_size: 16,
      color: 0x555555,
      align_h: align.CENTER_H,
    });
    // Vertical divider between states
    createWidget(widget.FILL_RECT, {
      x: 232, y: 56, w: 2, h: 44,
      color: 0x2a2a2a,
    });
    engineStateText = createWidget(widget.TEXT, {
      x: 0, y: 78, w: 233, h: 28,
      text: '...',
      text_size: 22,
      color: 0x666666,
      align_h: align.CENTER_H,
    });
    alarmStateText = createWidget(widget.TEXT, {
      x: 233, y: 78, w: 233, h: 28,
      text: '...',
      text_size: 22,
      color: 0x666666,
      align_h: align.CENTER_H,
    });

    // ── Divider ────────────────────────────────────────────────────────────────
    createWidget(widget.FILL_RECT, {
      x: 40, y: 112, w: SCREEN_W - 80, h: 1,
      color: 0x2a2a2a,
    });

    // ── Metric tile 1: Engine temperature (left) ───────────────────────────────
    etempTile = createWidget(widget.FILL_RECT, {
      x: 38, y: 118, w: 188, h: 72,
      color: 0x1e1e1e, radius: 12,
    });
    etempValue = createWidget(widget.TEXT, {
      x: 38, y: 122, w: 188, h: 38,
      text: '--',
      text_size: 28,
      color: 0xff8833,
      align_h: align.CENTER_H,
    });
    etempLabel = createWidget(widget.TEXT, {
      x: 38, y: 160, w: 188, h: 24,
      text: 'Темп. двиг.',
      text_size: 17,
      color: 0x555555,
      align_h: align.CENTER_H,
    });

    // ── Metric tile 2: Battery voltage (right) ────────────────────────────────
    batteryTile = createWidget(widget.FILL_RECT, {
      x: 240, y: 118, w: 188, h: 72,
      color: 0x1e1e1e, radius: 12,
    });
    batteryValue = createWidget(widget.TEXT, {
      x: 240, y: 122, w: 188, h: 38,
      text: '--',
      text_size: 28,
      color: 0x4fc3f7,
      align_h: align.CENTER_H,
    });
    batteryLabel = createWidget(widget.TEXT, {
      x: 240, y: 160, w: 188, h: 24,
      text: 'АКБ',
      text_size: 17,
      color: 0x555555,
      align_h: align.CENTER_H,
    });

    // ── Metric tile 3: SIM balance (full width) ───────────────────────────────
    balanceTile = createWidget(widget.FILL_RECT, {
      x: 38, y: 197, w: 390, h: 54,
      color: 0x1e1e1e, radius: 12,
    });
    balanceValue = createWidget(widget.TEXT, {
      x: 38, y: 200, w: 240, h: 44,
      text: '--',
      text_size: 26,
      color: 0x7ec87e,
      align_h: align.CENTER_H,
    });
    balanceLabel = createWidget(widget.TEXT, {
      x: 278, y: 211, w: 150, h: 24,
      text: 'Баланс SIM',
      text_size: 17,
      color: 0x555555,
      align_h: align.LEFT,
    });

    // ── Engine start/stop button ───────────────────────────────────────────────
    engineBtn = createWidget(widget.BUTTON, {
      x: 40, y: 264, w: SCREEN_W - 80, h: 56,
      text: 'Запустить',
      text_size: 24,
      normal_color: 0x1e8a1e,
      press_color:  0x156815,
      radius: 28,
      click_func: () => {
        if (isLoading) return;
        if (!currentStatus || !currentStatus.engine) {
          const gd = getApp()._options.globalData;
          gd.pendingAction = 'r_start';
          gd.mainPage = { sendCommand };
          push({ url: 'device-app/pages/confirm' });
        } else {
          sendCommand('r_start', 0);
        }
      },
    });

    // ── Alarm toggle button ────────────────────────────────────────────────────
    alarmBtn = createWidget(widget.BUTTON, {
      x: 40, y: 330, w: SCREEN_W - 80, h: 46,
      text: 'Охрана',
      text_size: 20,
      normal_color: 0x1a5c8a,
      press_color:  0x114060,
      radius: 23,
      click_func: () => {
        if (isLoading) return;
        sendCommand('alarm', (currentStatus && currentStatus.alarm) ? 0 : 1);
      },
    });

    // ── Refresh button ────────────────────────────────────────────────────────
    createWidget(widget.BUTTON, {
      x: 163, y: 404, w: 140, h: 42,
      text: 'Обновить',
      text_size: 20,
      normal_color: 0x333333,
      press_color:  0x222222,
      radius: 21,
      click_func: () => { if (!isLoading) fetchStatus(); },
    });

    fetchStatus();
  },
});
