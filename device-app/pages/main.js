import { createWidget, widget, align, prop } from '@zos/ui';
import { push } from '@zos/router';

const SCREEN_W = 466;
const SCREEN_H = 466;
const STATUS_REFRESH_MS = 90 * 1000;

const globalData = getApp()._options.globalData;

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
};

Page({
  build() {
    createWidget(widget.FILL_RECT, {
      x: 0, y: 0, w: SCREEN_W, h: SCREEN_H,
      color: 0x121212,
    });

    createWidget(widget.TEXT, {
      x: 0, y: 18, w: SCREEN_W, h: 48,
      text: 'StarLine Remote',
      text_size: 32, color: 0xffffff,
      align_h: align.CENTER_H,
    });

    statusText = createWidget(widget.TEXT, {
      x: 0, y: 72, w: SCREEN_W, h: 32,
      text: 'Подключение...',
      text_size: 22, color: 0x888888,
      align_h: align.CENTER_H,
    });

    engineText = createWidget(widget.TEXT, {
      x: 20, y: 114, w: SCREEN_W - 40, h: 38,
      text: 'Двигатель: --',
      text_size: 26, color: 0xcccccc,
      align_h: align.CENTER_H,
    });

    tempText = createWidget(widget.TEXT, {
      x: 20, y: 158, w: SCREEN_W - 40, h: 34,
      text: 'Температура: --',
      text_size: 24, color: 0xcccccc,
      align_h: align.CENTER_H,
    });

    alarmText = createWidget(widget.TEXT, {
      x: 20, y: 198, w: SCREEN_W - 40, h: 34,
      text: 'Охрана: --',
      text_size: 24, color: 0xcccccc,
      align_h: align.CENTER_H,
    });

    loadingText = createWidget(widget.TEXT, {
      x: 0, y: 238, w: SCREEN_W, h: 30,
      text: '', text_size: 20, color: 0x888888,
      align_h: align.CENTER_H,
    });

    engineBtn = createWidget(widget.BUTTON, {
      x: 20, y: 280, w: 200, h: 64,
      text: 'Запустить', text_size: 24,
      normal_color: 0x1e8a1e, press_color: 0x156815,
      radius: 16,
      click_func: () => this.onEngineBtn(),
    });

    alarmBtn = createWidget(widget.BUTTON, {
      x: 246, y: 280, w: 200, h: 64,
      text: 'Охрана', text_size: 24,
      normal_color: 0x1a5fa8, press_color: 0x114275,
      radius: 16,
      click_func: () => this.onAlarmBtn(),
    });

    createWidget(widget.BUTTON, {
      x: 133, y: 366, w: 200, h: 54,
      text: 'Обновить', text_size: 22,
      normal_color: 0x333333, press_color: 0x222222,
      radius: 27,
      click_func: () => this.fetchStatus(),
    });

    this.fetchStatus();

    refreshTimer = setInterval(() => {
      if (!state.loading) this.fetchStatus();
    }, STATUS_REFRESH_MS);
  },

  onEngineBtn() {
    if (state.loading) return;
    if (state.engineRunning) {
      this.sendCommand('r_start', 0);
    } else {
      globalData.pendingAction = 'r_start';
      globalData.mainPage = this;
      push({ url: 'device-app/pages/confirm' });
    }
  },

  onAlarmBtn() {
    if (state.loading) return;
    this.sendCommand('alarm', state.alarmOn ? 0 : 1);
  },

  fetchStatus() {
    this.setLoading(true);
    globalData.messageBuilder
      .request({ cmd: 'get_status' }, { timeout: 15000 })
      .then(res => {
        this.setLoading(false);
        if (res && res.code === 0 && res.data) {
          this.updateState(res.data);
        } else {
          this.setStatus('Ошибка статуса', 0xff4444);
        }
      })
      .catch(() => {
        this.setLoading(false);
        this.setStatus('Нет связи', 0xff4444);
      });
  },

  sendCommand(cmd, value) {
    this.setLoading(true, 'Выполняется...');
    globalData.messageBuilder
      .request({ cmd, value }, { timeout: 20000 })
      .then(res => {
        this.setLoading(false);
        if (res && res.code === 0) {
          if (res.data) this.updateState(res.data);
          this.setStatus('Готово', 0x44ff44);
        } else {
          this.setStatus((res && res.message) || 'Ошибка', 0xff4444);
        }
      })
      .catch(() => {
        this.setLoading(false);
        this.setStatus('Ошибка команды', 0xff4444);
      });
  },

  updateState(data) {
    state.engineRunning = !!data.engine;
    state.alarmOn = !!data.alarm;
    state.temperature = data.temp !== undefined ? data.temp + 'C' : '--';

    engineText && engineText.setProperty(prop.TEXT,
      'Двигатель: ' + (state.engineRunning ? 'Работает' : 'Заглушен'));
    engineText && engineText.setProperty(prop.COLOR,
      state.engineRunning ? 0x44ff44 : 0xcccccc);
    tempText && tempText.setProperty(prop.TEXT, 'Темп: ' + state.temperature);
    alarmText && alarmText.setProperty(prop.TEXT,
      'Охрана: ' + (state.alarmOn ? 'Вкл' : 'Выкл'));
    alarmText && alarmText.setProperty(prop.COLOR,
      state.alarmOn ? 0x44aaff : 0xcccccc);
    engineBtn && engineBtn.setProperty(prop.TEXT,
      state.engineRunning ? 'Заглушить' : 'Запустить');
    engineBtn && engineBtn.setProperty(prop.MORE, {
      normal_color: state.engineRunning ? 0x8a1e1e : 0x1e8a1e,
      press_color:  state.engineRunning ? 0x681515 : 0x156815,
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
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    globalData.mainPage = null;
  },
});
