import { createWidget, widget, align, text_style, prop, deleteWidget } from '@zos/ui';
import { px } from '@zos/utils';
import { gettext } from '@zos/i18n';
import { Vibrator } from '@zos/sensor';
import messageBuilder from '../shared/message';

const vibrator = new Vibrator();
// mode 1 = double short pulse (success)
// mode 2 = triple short pulse (error/alert)
const vibrateSuccess = () => vibrator.start({ mode: 1 });
const vibrateError   = () => vibrator.start({ mode: 2 });

const SCREEN_W = 466;
const SCREEN_H = 466;

// Refresh interval in ms (90 sec minimum per API limits)
const STATUS_REFRESH_MS = 90 * 1000;

let statusText = null;
let engineText = null;
let tempText = null;
let alarmText = null;
let loadingText = null;
let engineBtn = null;
let alarmBtn = null;
let refreshTimer = null;

let state = {
  engineRunning: false,
  alarmOn: false,
  temperature: '--',
  loading: false,
  connected: false,
};

Page({
  build() {
    // Background
    createWidget(widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: SCREEN_W,
      h: SCREEN_H,
      color: 0x121212,
    });

    // Title
    createWidget(widget.TEXT, {
      x: px(20),
      y: px(20),
      w: SCREEN_W - px(40),
      h: px(40),
      text: 'StarLine Remote',
      text_size: px(32),
      color: 0xffffff,
      align_h: align.CENTER_H,
    });

    // Status line
    statusText = createWidget(widget.TEXT, {
      x: px(20),
      y: px(70),
      w: SCREEN_W - px(40),
      h: px(30),
      text: 'Подключение...',
      text_size: px(24),
      color: 0x888888,
      align_h: align.CENTER_H,
    });

    // Engine status
    engineText = createWidget(widget.TEXT, {
      x: px(20),
      y: px(115),
      w: SCREEN_W - px(40),
      h: px(50),
      text: '🚗 Двигатель: --',
      text_size: px(28),
      color: 0xcccccc,
      align_h: align.CENTER_H,
    });

    // Temperature
    tempText = createWidget(widget.TEXT, {
      x: px(20),
      y: px(170),
      w: SCREEN_W - px(40),
      h: px(40),
      text: '🌡 Температура: --',
      text_size: px(26),
      color: 0xcccccc,
      align_h: align.CENTER_H,
    });

    // Alarm status
    alarmText = createWidget(widget.TEXT, {
      x: px(20),
      y: px(215),
      w: SCREEN_W - px(40),
      h: px(40),
      text: '🔐 Охрана: --',
      text_size: px(26),
      color: 0xcccccc,
      align_h: align.CENTER_H,
    });

    // Loading indicator
    loadingText = createWidget(widget.TEXT, {
      x: px(20),
      y: px(260),
      w: SCREEN_W - px(40),
      h: px(30),
      text: '',
      text_size: px(22),
      color: 0x888888,
      align_h: align.CENTER_H,
    });

    // Engine button (Start / Stop)
    engineBtn = createWidget(widget.BUTTON, {
      x: px(30),
      y: px(300),
      w: px(190),
      h: px(70),
      text: 'Запустить',
      text_size: px(26),
      normal_color: 0x1e8a1e,
      press_color: 0x156815,
      radius: px(20),
      click_func: () => this.onEngineBtn(),
    });

    // Alarm button
    alarmBtn = createWidget(widget.BUTTON, {
      x: px(246),
      y: px(300),
      w: px(190),
      h: px(70),
      text: 'Охрана',
      text_size: px(26),
      normal_color: 0x1a5fa8,
      press_color: 0x114275,
      radius: px(20),
      click_func: () => this.onAlarmBtn(),
    });

    // Refresh button
    createWidget(widget.BUTTON, {
      x: px(133),
      y: px(390),
      w: px(200),
      h: px(55),
      text: '↺ Обновить',
      text_size: px(24),
      normal_color: 0x333333,
      press_color: 0x222222,
      radius: px(27),
      click_func: () => this.fetchStatus(),
    });

    // Initial data fetch
    this.fetchStatus();

    // Auto-refresh timer
    refreshTimer = setInterval(() => {
      if (!state.loading) this.fetchStatus();
    }, STATUS_REFRESH_MS);
  },

  onEngineBtn() {
    if (state.loading) return;

    if (state.engineRunning) {
      // Stop immediately (no confirmation needed for stop)
      this.sendCommand('r_start', 0);
    } else {
      // Navigate to confirmation screen
      hmApp.gotoPage({
        url: 'device-app/pages/confirm',
        param: JSON.stringify({ action: 'r_start' }),
      });
    }
  },

  onAlarmBtn() {
    if (state.loading) return;
    const newVal = state.alarmOn ? 0 : 1;
    this.sendCommand('alarm', newVal);
  },

  fetchStatus() {
    this.setLoading(true);

    messageBuilder.request(
      { cmd: 'get_status' },
      { timeout: 15000 }
    ).then(res => {
      this.setLoading(false);
      if (res && res.code === 0 && res.data) {
        this.updateState(res.data);
      } else {
        this.setStatus('Ошибка получения статуса', 0xff4444);
      }
    }).catch(err => {
      this.setLoading(false);
      this.setStatus('Нет связи с телефоном', 0xff4444);
    });
  },

  sendCommand(cmd, value) {
    this.setLoading(true, 'Выполняется...');

    messageBuilder.request(
      { cmd, value },
      { timeout: 20000 }
    ).then(res => {
      this.setLoading(false);
      if (res && res.code === 0) {
        if (res.data) this.updateState(res.data);
        vibrateSuccess();
        this.setStatus('Команда выполнена', 0x44ff44);
      } else {
        vibrateError();
        const msg = (res && res.message) ? res.message : 'Ошибка команды';
        this.setStatus(msg, 0xff4444);
      }
    }).catch(() => {
      this.setLoading(false);
      vibrateError();
      this.setStatus('Ошибка отправки команды', 0xff4444);
    });
  },

  updateState(data) {
    state.engineRunning = !!data.engine;
    state.alarmOn = !!data.alarm;
    state.temperature = data.temp !== undefined ? data.temp + '°C' : '--';
    state.connected = true;

    engineText && engineText.setProperty(prop.TEXT,
      '🚗 Двигатель: ' + (state.engineRunning ? 'Работает' : 'Заглушен'));
    engineText && engineText.setProperty(prop.COLOR,
      state.engineRunning ? 0x44ff44 : 0xcccccc);

    tempText && tempText.setProperty(prop.TEXT,
      '🌡 Температура: ' + state.temperature);

    alarmText && alarmText.setProperty(prop.TEXT,
      '🔐 Охрана: ' + (state.alarmOn ? 'Включена' : 'Выключена'));
    alarmText && alarmText.setProperty(prop.COLOR,
      state.alarmOn ? 0x44aaff : 0xcccccc);

    engineBtn && engineBtn.setProperty(prop.TEXT,
      state.engineRunning ? 'Заглушить' : 'Запустить');
    engineBtn && engineBtn.setProperty(prop.MORE, {
      normal_color: state.engineRunning ? 0x8a1e1e : 0x1e8a1e,
      press_color: state.engineRunning ? 0x681515 : 0x156815,
    });

    alarmBtn && alarmBtn.setProperty(prop.TEXT,
      state.alarmOn ? 'Снять охр.' : 'Охрана');

    this.setStatus('Обновлено', 0x888888);
  },

  setLoading(isLoading, msg) {
    state.loading = isLoading;
    loadingText && loadingText.setProperty(prop.TEXT,
      isLoading ? (msg || 'Загрузка...') : '');
  },

  setStatus(msg, color) {
    statusText && statusText.setProperty(prop.TEXT, msg);
    statusText && statusText.setProperty(prop.COLOR, color || 0x888888);
  },

  onDestroy() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  },

  // Called from confirm page via back navigation with param
  onResume({ param }) {
    if (param) {
      try {
        const p = JSON.parse(param);
        if (p.confirmed && p.action) {
          this.sendCommand(p.action, 1);
        }
      } catch (e) {
        // ignore
      }
    }
  },
});
