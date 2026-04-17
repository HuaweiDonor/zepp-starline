import { createWidget, widget, prop, align, event } from '@zos/ui';
import { vibrate, onGesture, GESTURE_LEFT, GESTURE_RIGHT } from '@zos/interaction';
import { push, pop } from '@zos/router';

const HOLD_MS = 3000;
const COOLDOWN_MS = 5000;
const { messageBuilder } = getApp()._options.globalData;

let btn       = null;
let arcTrack  = null;
let arcFill   = null;
let holdIv    = null;
let isLoading       = false;
let lastCommandTime = 0;

function startHold(onComplete) {
  let elapsed = 0;
  holdIv = setInterval(() => {
    elapsed += 50;
    const endAngle = -90 + Math.round((elapsed / HOLD_MS) * 360);
    arcFill.setProperty(prop.MORE, { start_angle: -90, end_angle: Math.min(endAngle, 270) });
    if (elapsed >= HOLD_MS) {
      clearInterval(holdIv);
      holdIv = null;
      arcFill.setProperty(prop.MORE, { start_angle: -90, end_angle: -90 });
      onComplete();
    }
  }, 50);
}

function cancelHold() {
  if (holdIv) { clearInterval(holdIv); holdIv = null; }
  if (arcFill) arcFill.setProperty(prop.MORE, { start_angle: -90, end_angle: -90 });
}

function sendCommand(cmd, value) {
  lastCommandTime = Date.now();
  isLoading = true;
  messageBuilder.request({ cmd, value })
    .then((res) => {
      isLoading = false;
      if (res && res.code === 0) {
        vibrate({ mode: 0 });
        getApp()._options.globalData.currentStatus = res.data;
        updateIcon(res.data);
      } else {
        vibrate({ mode: 1 });
      }
    })
    .catch(() => {
      isLoading = false;
      vibrate({ mode: 1 });
    });
}

function updateIcon(status) {
  if (btn) {
    btn.setProperty(prop.MORE, {
      normal_src: status.alarm ? 'btn_alarm_on.png' : 'btn_alarm_off.png',
      press_src:  status.alarm ? 'btn_alarm_on.png' : 'btn_alarm_off.png',
    });
  }
}

Page({
  build() {
    createWidget(widget.FILL_RECT, { x: 0, y: 0, w: 466, h: 466, color: 0x121212 });

    createWidget(widget.TEXT, {
      x: 0, y: 20, w: 466, h: 40,
      text: 'Охрана',
      text_size: 24, color: 0x888888, align_h: align.CENTER_H,
    });

    // Arc track (dark background ring)
    arcTrack = createWidget(widget.ARC, {
      x: 123, y: 123, w: 220, h: 220,
      start_angle: -90, end_angle: 270,
      color: 0x2a2a2a, line_width: 10,
    });

    // Arc fill (animated orange progress)
    arcFill = createWidget(widget.ARC, {
      x: 123, y: 123, w: 220, h: 220,
      start_angle: -90, end_angle: -90,
      color: 0xff8800, line_width: 10,
    });

    btn = createWidget(widget.BUTTON, {
      x: 133, y: 133, w: 200, h: 200, radius: 100,
      normal_src: 'btn_alarm_off.png',
      press_src:  'btn_alarm_off.png',
    });

    btn.addEventListener(event.CLICK_DOWN, () => {
      if (isLoading || Date.now() - lastCommandTime < COOLDOWN_MS) { vibrate({ mode: 1 }); return; }
      startHold(() => {
        const s = getApp()._options.globalData.currentStatus;
        sendCommand('alarm', (s && s.alarm) ? 0 : 1);
      });
    });
    btn.addEventListener(event.CLICK_UP, () => cancelHold());

    createWidget(widget.TEXT, {
      x: 0, y: 350, w: 466, h: 30,
      text: 'Удержите для включения',
      text_size: 18, color: 0x888888, align_h: align.CENTER_H,
    });

    createWidget(widget.TEXT, {
      x: 0, y: 440, w: 466, h: 22,
      text: '○ ● ○',
      text_size: 18, color: 0x444444, align_h: align.CENTER_H,
    });

    onGesture({
      callback: (g) => {
        if (g === GESTURE_LEFT)  { cancelHold(); push({ url: 'device-app/pages/actions_refresh' }); }
        if (g === GESTURE_RIGHT) { cancelHold(); pop(); }
      },
    });

    const s = getApp()._options.globalData.currentStatus;
    if (s) updateIcon(s);
  },

  onResume() {
    const s = getApp()._options.globalData.currentStatus;
    if (s) updateIcon(s);
  },
});
