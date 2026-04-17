import { createWidget, widget, prop, align } from '@zos/ui';
import { vibrate, onGesture, GESTURE_LEFT } from '@zos/interaction';
import { push } from '@zos/router';

const SCREEN_W = 466;
const SCREEN_H = 466;
const { messageBuilder } = getApp()._options.globalData;

let engineStateText = null;
let alarmStateText  = null;

let isLoading       = false;
let loadingTrackArc = null;
let loadingArc      = null;
let loadingText     = null;
let loadingIv       = null;

const WIDGET_DEFS = {
  etemp:   { label: 'Темп. двиг.',  color: 0xff8833, fmt: v => v != null ? v + '°C'              : '--' },
  ctemp:   { label: 'Темп. салона', color: 0x80cbc4, fmt: v => v != null ? v + '°C'              : '--' },
  battery: { label: 'АКБ',          color: 0x4fc3f7, fmt: v => v != null ? (+v).toFixed(1) + 'В' : '--' },
  balance: { label: 'Баланс SIM',   color: 0x7ec87e, fmt: v => v != null ? v + ' ₽'             : '--' },
  fuel:    { label: 'Топливо',      color: 0xffcc44, fmt: v => v != null ? v + '%'              : '--' },
};

const SLOT_LAYOUTS = [
  { x: 20,  y: 163, w: 207, h: 126 },  // Slot A — left-half
  { x: 239, y: 163, w: 207, h: 126 },  // Slot B — right-half
  { x: 20,  y: 301, w: 426, h: 128 },  // Slot C — full-bottom
];

const slots = [
  { bg: null, valueText: null, labelText: null },
  { bg: null, valueText: null, labelText: null },
  { bg: null, valueText: null, labelText: null },
];

function updateStatusDisplay(status) {
  getApp()._options.globalData.currentStatus = status;

  // ── Optional metric slots ────────────────────────────────────────────────────
  const activeWidgets = Array.isArray(status.active_widgets) && status.active_widgets.length
    ? status.active_widgets
    : ['etemp', 'battery', 'balance'];

  for (let i = 0; i < 3; i++) {
    const slot = slots[i];
    if (!slot.valueText) continue;
    if (i < activeWidgets.length) {
      const def = WIDGET_DEFS[activeWidgets[i]];
      if (!def) {
        slot.bg.setProperty(prop.VISIBLE,        false);
        slot.valueText.setProperty(prop.VISIBLE, false);
        slot.labelText.setProperty(prop.VISIBLE, false);
        continue;
      }
      slot.valueText.setProperty(prop.TEXT,    def.fmt(status[activeWidgets[i]]));
      slot.valueText.setProperty(prop.COLOR,   def.color);
      slot.labelText.setProperty(prop.TEXT,    def.label);
      slot.bg.setProperty(prop.VISIBLE,        true);
      slot.valueText.setProperty(prop.VISIBLE, true);
      slot.labelText.setProperty(prop.VISIBLE, true);
    } else {
      slot.bg.setProperty(prop.VISIBLE,        false);
      slot.valueText.setProperty(prop.VISIBLE, false);
      slot.labelText.setProperty(prop.VISIBLE, false);
    }
  }

  // ── Engine / alarm status (always shown) ────────────────────────────────────
  if (engineStateText) engineStateText.setProperty(prop.TEXT, status.engine ? 'РАБОТАЕТ' : 'Выкл');
  if (alarmStateText)  alarmStateText.setProperty(prop.TEXT,  status.alarm  ? 'ОХРАНА'   : 'Снята');
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
  if (loading) {
    if (loadingTrackArc) loadingTrackArc.setProperty(prop.VISIBLE, true);
    if (loadingArc)      loadingArc.setProperty(prop.VISIBLE, true);
    if (loadingText)     loadingText.setProperty(prop.VISIBLE, true);
    let angle = -90;
    loadingIv = setInterval(() => {
      angle = (angle + 12) % 360;
      if (loadingArc) loadingArc.setProperty(prop.MORE, {
        start_angle: angle,
        end_angle:   angle + 120,
      });
    }, 50);
  } else {
    if (loadingIv) { clearInterval(loadingIv); loadingIv = null; }
    if (loadingArc)      loadingArc.setProperty(prop.VISIBLE, false);
    if (loadingTrackArc) loadingTrackArc.setProperty(prop.VISIBLE, false);
    if (loadingText)     loadingText.setProperty(prop.VISIBLE, false);
  }
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

    // ── Metric slots ─────────────────────────────────────────────────────────────
    for (let i = 0; i < 3; i++) {
      const L = SLOT_LAYOUTS[i];
      slots[i].bg = createWidget(widget.FILL_RECT, {
        x: L.x, y: L.y, w: L.w, h: L.h, color: 0x1e1e1e, radius: 16,
      });
      slots[i].valueText = createWidget(widget.TEXT, {
        x: L.x, y: L.y + 14, w: L.w, h: 52,
        text: '--', text_size: 34, color: 0xffffff, align_h: align.CENTER_H,
      });
      slots[i].labelText = createWidget(widget.TEXT, {
        x: L.x, y: L.y + 74, w: L.w, h: 26,
        text: '', text_size: 16, color: 0x555555, align_h: align.CENTER_H,
      });
      slots[i].valueText.setProperty(prop.VISIBLE, false);
      slots[i].labelText.setProperty(prop.VISIBLE, false);
    }

    // ── Loading spinner (center of metrics area) ──────────────────────────
    loadingTrackArc = createWidget(widget.ARC, {
      x: 153, y: 213, w: 160, h: 160,
      start_angle: -90, end_angle: 270,
      color: 0x222222, line_width: 8,
    });
    loadingArc = createWidget(widget.ARC, {
      x: 153, y: 213, w: 160, h: 160,
      start_angle: -90, end_angle: 30,
      color: 0x4fc3f7, line_width: 8,
    });
    loadingText = createWidget(widget.TEXT, {
      x: 153, y: 276, w: 160, h: 34,
      text: 'Загрузка...', text_size: 18,
      color: 0x666666, align_h: align.CENTER_H,
    });
    loadingTrackArc.setProperty(prop.VISIBLE, false);
    loadingArc.setProperty(prop.VISIBLE, false);
    loadingText.setProperty(prop.VISIBLE, false);

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
