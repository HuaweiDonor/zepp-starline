import { createWidget, widget, prop, align } from '@zos/ui';
import { vibrate, onGesture, GESTURE_LEFT } from '@zos/interaction';
import { push } from '@zos/router';

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

let isLoading = false;

// Hides/shows a metric tile: value text + label text
function setTileVisible(tileRect, valueText, labelText, visible) {
  valueText.setProperty(prop.VISIBLE, visible);
  labelText.setProperty(prop.VISIBLE, visible);
}

function updateStatusDisplay(status) {
  getApp()._options.globalData.currentStatus = status;

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
          const dbg = res
            ? (res.message ? res.message.slice(0, 20) : 'code=' + res.code)
            : 'null';
          engineStateText && engineStateText.setProperty(prop.TEXT, dbg);
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
    });
}

function setLoading(loading) {
  isLoading = loading;
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
      x: 0, y: 16, w: SCREEN_W, h: 50,
      text: 'StarLine Remote',
      text_size: 30,
      color: 0xffffff,
      align_h: align.CENTER_H,
    });

    // ── Status bar: Engine | Alarm ─────────────────────────────────────────────
    createWidget(widget.TEXT, {
      x: 0, y: 74, w: 233, h: 22,
      text: 'Двигатель',
      text_size: 16,
      color: 0x555555,
      align_h: align.CENTER_H,
    });
    createWidget(widget.TEXT, {
      x: 233, y: 74, w: 233, h: 22,
      text: 'Охрана',
      text_size: 16,
      color: 0x555555,
      align_h: align.CENTER_H,
    });
    // Vertical divider between states
    createWidget(widget.FILL_RECT, {
      x: 232, y: 74, w: 2, h: 52,
      color: 0x2a2a2a,
    });
    engineStateText = createWidget(widget.TEXT, {
      x: 0, y: 98, w: 233, h: 44,
      text: '...',
      text_size: 30,
      color: 0x666666,
      align_h: align.CENTER_H,
    });
    alarmStateText = createWidget(widget.TEXT, {
      x: 233, y: 98, w: 233, h: 44,
      text: '...',
      text_size: 30,
      color: 0x666666,
      align_h: align.CENTER_H,
    });

    // ── Divider ────────────────────────────────────────────────────────────────
    createWidget(widget.FILL_RECT, {
      x: 40, y: 154, w: SCREEN_W - 80, h: 1,
      color: 0x2a2a2a,
    });

    // ── Metric tile 1: Engine temperature (left) ───────────────────────────────
    etempTile = createWidget(widget.FILL_RECT, {
      x: 20, y: 163, w: 207, h: 126,
      color: 0x1e1e1e, radius: 16,
    });
    etempValue = createWidget(widget.TEXT, {
      x: 20, y: 177, w: 207, h: 52,
      text: '--',
      text_size: 34,
      color: 0xff8833,
      align_h: align.CENTER_H,
    });
    etempLabel = createWidget(widget.TEXT, {
      x: 20, y: 237, w: 207, h: 26,
      text: 'Темп. двиг.',
      text_size: 16,
      color: 0x555555,
      align_h: align.CENTER_H,
    });

    // ── Metric tile 2: Battery voltage (right) ────────────────────────────────
    batteryTile = createWidget(widget.FILL_RECT, {
      x: 239, y: 163, w: 207, h: 126,
      color: 0x1e1e1e, radius: 16,
    });
    batteryValue = createWidget(widget.TEXT, {
      x: 239, y: 177, w: 207, h: 52,
      text: '--',
      text_size: 34,
      color: 0x4fc3f7,
      align_h: align.CENTER_H,
    });
    batteryLabel = createWidget(widget.TEXT, {
      x: 239, y: 237, w: 207, h: 26,
      text: 'АКБ',
      text_size: 16,
      color: 0x555555,
      align_h: align.CENTER_H,
    });

    // ── Metric tile 3: SIM balance (full width) ───────────────────────────────
    balanceTile = createWidget(widget.FILL_RECT, {
      x: 20, y: 301, w: 426, h: 128,
      color: 0x1e1e1e, radius: 16,
    });
    balanceValue = createWidget(widget.TEXT, {
      x: 20, y: 322, w: 426, h: 52,
      text: '--',
      text_size: 34,
      color: 0x7ec87e,
      align_h: align.CENTER_H,
    });
    balanceLabel = createWidget(widget.TEXT, {
      x: 20, y: 380, w: 426, h: 26,
      text: 'Баланс SIM',
      text_size: 16,
      color: 0x555555,
      align_h: align.CENTER_H,
    });

    // ── Hint arrow (swipe left for controls) ──────────────────────────────────
    createWidget(widget.TEXT, {
      x: 0, y: 441, w: SCREEN_W, h: 22,
      text: '›',
      text_size: 22,
      color: 0x333333,
      align_h: align.CENTER_H,
    });

    // ── Gesture: swipe left → actions screen ──────────────────────────────────
    onGesture({
      callback: (g) => {
        if (g === GESTURE_LEFT) {
          push({ url: 'device-app/pages/actions_engine' });
        }
      },
    });

    fetchStatus();
  },

  onResume() {
    const s = getApp()._options.globalData.currentStatus;
    if (s) updateStatusDisplay(s);
  },
});
