import { createWidget, widget, prop, align, event } from '@zos/ui';
import { vibrate } from '@zos/interaction';

const HOLD_MS = 3000;
const { messageBuilder } = getApp()._options.globalData;

let engineBtn    = null;
let alarmBtn     = null;
let engineArc    = null;
let alarmArc     = null;
let engineHoldIv = null;
let alarmHoldIv  = null;
let isLoading    = false;

function startHold(arcWidget, onComplete) {
  let elapsed = 0;
  return setInterval(() => {
    elapsed += 50;
    const endAngle = -90 + Math.round((elapsed / HOLD_MS) * 360);
    arcWidget.setProperty(prop.MORE, { start_angle: -90, end_angle: Math.min(endAngle, 270) });
    if (elapsed >= HOLD_MS) onComplete();
  }, 50);
}

function cancelHold(iv, arcWidget) {
  if (iv) clearInterval(iv);
  if (arcWidget) arcWidget.setProperty(prop.MORE, { start_angle: -90, end_angle: -90 });
}

function setLoading(loading) {
  isLoading = loading;
  if (loading) {
    if (engineHoldIv) { cancelHold(engineHoldIv, engineArc); engineHoldIv = null; }
    if (alarmHoldIv)  { cancelHold(alarmHoldIv,  alarmArc);  alarmHoldIv  = null; }
  }
}

function updateButtonIcons(status) {
  if (engineBtn) {
    engineBtn.setProperty(prop.MORE, {
      normal_src: status.engine ? 'btn_engine_on.png' : 'btn_engine_off.png',
      press_src:  status.engine ? 'btn_engine_on.png' : 'btn_engine_off.png',
    });
  }
  if (alarmBtn) {
    alarmBtn.setProperty(prop.MORE, {
      normal_src: status.alarm ? 'btn_alarm_on.png' : 'btn_alarm_off.png',
      press_src:  status.alarm ? 'btn_alarm_on.png' : 'btn_alarm_off.png',
    });
  }
}

function sendCommand(cmd, value) {
  setLoading(true);
  messageBuilder.request({ cmd, value })
    .then((res) => {
      setLoading(false);
      if (res && res.code === 0) {
        vibrate({ mode: 0 });
        getApp()._options.globalData.currentStatus = res.data;
        updateButtonIcons(res.data);
      } else {
        vibrate({ mode: 1 });
      }
    })
    .catch(() => {
      setLoading(false);
      vibrate({ mode: 1 });
    });
}

function fetchStatusOnActions() {
  setLoading(true);
  messageBuilder.request({ cmd: 'get_status' })
    .then((res) => {
      setLoading(false);
      if (res && res.code === 0) {
        vibrate({ mode: 0 });
        getApp()._options.globalData.currentStatus = res.data;
        updateButtonIcons(res.data);
      } else {
        vibrate({ mode: 1 });
      }
    })
    .catch(() => {
      setLoading(false);
      vibrate({ mode: 1 });
    });
}

Page({
  build() {
    // ── Background ─────────────────────────────────────────────────────────────
    createWidget(widget.FILL_RECT, { x: 0, y: 0, w: 466, h: 466, color: 0x121212 });

    // ── ARCи (до кнопок) ───────────────────────────────────────────────────────
    engineArc = createWidget(widget.ARC, {
      x: 166, y: 1, w: 134, h: 134,
      start_angle: -90, end_angle: -90,
      color: 0xffffff, line_width: 4,
    });
    alarmArc = createWidget(widget.ARC, {
      x: 166, y: 155, w: 134, h: 134,
      start_angle: -90, end_angle: -90,
      color: 0xffffff, line_width: 4,
    });

    // ── Кнопка: Двигатель ─────────────────────────────────────────────────────
    engineBtn = createWidget(widget.BUTTON, {
      x: 173, y: 8, w: 120, h: 120, radius: 60,
      normal_src: 'btn_engine_off.png',
      press_src:  'btn_engine_off.png',
    });
    engineBtn.addEventListener(event.CLICK_DOWN, () => {
      if (isLoading) return;
      engineHoldIv = startHold(engineArc, () => {
        engineHoldIv = null;
        cancelHold(null, engineArc);
        const s = getApp()._options.globalData.currentStatus;
        sendCommand('r_start', (s && s.engine) ? 0 : 1);
      });
    });
    engineBtn.addEventListener(event.CLICK_UP, () => {
      if (engineHoldIv) { cancelHold(engineHoldIv, engineArc); engineHoldIv = null; }
    });

    // ── Кнопка: Охрана ────────────────────────────────────────────────────────
    alarmBtn = createWidget(widget.BUTTON, {
      x: 173, y: 162, w: 120, h: 120, radius: 60,
      normal_src: 'btn_alarm_off.png',
      press_src:  'btn_alarm_off.png',
    });
    alarmBtn.addEventListener(event.CLICK_DOWN, () => {
      if (isLoading) return;
      alarmHoldIv = startHold(alarmArc, () => {
        alarmHoldIv = null;
        cancelHold(null, alarmArc);
        const s = getApp()._options.globalData.currentStatus;
        sendCommand('alarm', (s && s.alarm) ? 0 : 1);
      });
    });
    alarmBtn.addEventListener(event.CLICK_UP, () => {
      if (alarmHoldIv) { cancelHold(alarmHoldIv, alarmArc); alarmHoldIv = null; }
    });

    // ── Кнопка: Обновить ──────────────────────────────────────────────────────
    createWidget(widget.BUTTON, {
      x: 173, y: 316, w: 120, h: 120, radius: 60,
      normal_src: 'btn_refresh.png',
      press_src:  'btn_refresh.png',
      click_func: () => { if (!isLoading) fetchStatusOnActions(); },
    });

    // ── Подписи ───────────────────────────────────────────────────────────────
    ['Двигатель', 'Охрана', 'Обновить'].forEach((label, i) => {
      createWidget(widget.TEXT, {
        x: 173, y: [134, 288, 442][i], w: 120, h: 24,
        text: label, text_size: 16,
        color: 0x888888, align_h: align.CENTER_H,
      });
    });

    // ── Инициализировать иконки из globalData ─────────────────────────────────
    const s = getApp()._options.globalData.currentStatus;
    if (s) updateButtonIcons(s);
  },
});
