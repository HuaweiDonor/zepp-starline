import {
  AppSettingsPage,
  Section,
  Input,
  Button,
  Select,
  Toggle,
  Text,
  Separator,
} from '@zos/settings';
import { settingsStorage } from '@zos/storage';
import { router } from '@zos/router';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function get(key, fallback = '') {
  const v = settingsStorage.getItem(key);
  if (!v) return fallback;
  try { return JSON.parse(v); } catch { return v; }
}

function set(key, value) {
  settingsStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
}

// ─── Page 1: Login ────────────────────────────────────────────────────────────
const LoginPage = AppSettingsPage({
  state: {
    email: get('email'),
    password: get('password'),
    appId: get('app_id'),
    secretKey: get('secret_key'),
    status: '',
    loading: false,
  },

  build() {
    return [
      Section({
        title: 'Аккаунт StarLine',
      }, [
        Input({
          label: 'Email',
          value: this.state.email,
          placeholder: 'user@example.com',
          onChange: (val) => {
            this.state.email = val;
            set('email', val);
          },
        }),
        Input({
          label: 'Пароль',
          value: this.state.password,
          type: 'password',
          placeholder: '••••••••',
          onChange: (val) => {
            this.state.password = val;
            set('password', val);
          },
        }),
      ]),

      Section({
        title: 'API-ключи (developer.starline.ru)',
      }, [
        Input({
          label: 'App ID',
          value: this.state.appId,
          placeholder: 'Получить на developer.starline.ru',
          onChange: (val) => {
            this.state.appId = val;
            set('app_id', val);
          },
        }),
        Input({
          label: 'Secret Key',
          value: this.state.secretKey,
          type: 'password',
          placeholder: '••••••••••••••••',
          onChange: (val) => {
            this.state.secretKey = val;
            set('secret_key', val);
          },
        }),
      ]),

      Section({}, [
        this.state.status
          ? Text({
              text: this.state.status,
              style: { color: this.state.status.startsWith('✓') ? '#44ff44' : '#ff4444' },
            })
          : null,

        Button({
          label: this.state.loading ? 'Выполняется...' : 'Войти и получить список устройств',
          disabled: this.state.loading,
          onClick: () => this.doLogin(),
        }),
      ]),
    ].filter(Boolean);
  },

  doLogin() {
    if (this.state.loading) return;
    if (!this.state.email || !this.state.password || !this.state.appId || !this.state.secretKey) {
      this.state.status = '✗ Заполните все поля';
      this.setState({});
      return;
    }

    this.state.loading = true;
    this.state.status = 'Выполняется вход...';
    this.setState({});

    // Trigger login action — Side Service listens to this key
    set('action', 'login');

    // Poll for result
    const pollStart = Date.now();
    const poll = () => {
      const raw = settingsStorage.getItem('action_result');
      if (raw) {
        settingsStorage.removeItem('action_result');
        this.state.loading = false;
        try {
          const result = JSON.parse(raw);
          if (result.ok) {
            this.state.status = '✓ Вход выполнен';
            this.setState({});
            // Navigate to device selection after short delay
            setTimeout(() => router.push({ url: 'settings-app/index', param: 'page=devices' }), 800);
          } else {
            this.state.status = '✗ ' + (result.error || 'Ошибка входа');
            this.setState({});
          }
        } catch {
          this.state.status = '✗ Ошибка ответа';
          this.setState({});
        }
        return;
      }

      if (Date.now() - pollStart < 30000) {
        setTimeout(poll, 500);
      } else {
        this.state.loading = false;
        this.state.status = '✗ Превышено время ожидания';
        this.setState({});
      }
    };

    setTimeout(poll, 1000);
  },
});

// ─── Page 2: Device Selection ─────────────────────────────────────────────────
const DevicesPage = AppSettingsPage({
  state: {
    devices: [],
    selectedId: get('device_id'),
    status: '',
  },

  onInit() {
    const raw = settingsStorage.getItem('device_list');
    if (raw) {
      try {
        this.state.devices = JSON.parse(raw);
      } catch {
        this.state.devices = [];
      }
    }
  },

  build() {
    const { devices, selectedId } = this.state;

    if (!devices || devices.length === 0) {
      return [
        Section({
          title: 'Выбор автомобиля',
        }, [
          Text({ text: 'Список устройств пуст. Вернитесь и выполните вход.' }),
          Button({
            label: '← Назад к авторизации',
            onClick: () => router.pop(),
          }),
        ]),
      ];
    }

    const options = devices.map(d => ({
      label: `${d.alias || d.type_name || 'Устройство'} (ID: ${d.device_id})`,
      value: String(d.device_id),
    }));

    return [
      Section({
        title: 'Выберите автомобиль',
      }, [
        Select({
          label: 'Автомобиль',
          value: selectedId ? String(selectedId) : '',
          options,
          onChange: (val) => {
            this.state.selectedId = val;
          },
        }),
      ]),

      Section({}, [
        this.state.status ? Text({ text: this.state.status }) : null,
        Button({
          label: 'Сохранить',
          onClick: () => {
            if (!this.state.selectedId) {
              this.state.status = '✗ Выберите устройство';
              this.setState({});
              return;
            }
            set('device_id', this.state.selectedId);
            this.state.status = '✓ Сохранено';
            this.setState({});
            setTimeout(() => router.push({ url: 'settings-app/index', param: 'page=extra' }), 600);
          },
        }),
      ]).filter(Boolean),
    ];
  },
});

// ─── Page 3: Extra Settings ───────────────────────────────────────────────────
const ExtraPage = AppSettingsPage({
  state: {
    warmupTime: get('warmup_time') || 10,
    confirmBeforeStart: get('confirm_start') !== false,
    refreshInterval: get('refresh_interval') || 90,
  },

  build() {
    return [
      Section({
        title: 'Дополнительные настройки',
      }, [
        Select({
          label: 'Время прогрева (мин)',
          value: String(this.state.warmupTime),
          options: [5, 10, 15, 20, 30].map(v => ({ label: `${v} мин`, value: String(v) })),
          onChange: (val) => {
            this.state.warmupTime = Number(val);
            set('warmup_time', Number(val));
          },
        }),

        Toggle({
          label: 'Подтверждение перед запуском',
          subLabel: 'Требовать подтверждение нажатием кнопки',
          value: this.state.confirmBeforeStart,
          onChange: (val) => {
            this.state.confirmBeforeStart = val;
            set('confirm_start', val);
          },
        }),

        Select({
          label: 'Интервал обновления статуса',
          value: String(this.state.refreshInterval),
          options: [
            { label: '90 сек (минимум)', value: '90' },
            { label: '2 мин', value: '120' },
            { label: '3 мин', value: '180' },
            { label: '5 мин', value: '300' },
          ],
          onChange: (val) => {
            this.state.refreshInterval = Number(val);
            set('refresh_interval', Number(val));
          },
        }),
      ]),

      Section({}, [
        Button({
          label: '✓ Готово',
          onClick: () => router.pop(),
        }),
      ]),
    ];
  },
});

// ─── Router / Entry Point ─────────────────────────────────────────────────────
AppSettingsPage({
  build({ param }) {
    const page = param ? (param.split('page=')[1] || '') : '';

    switch (page) {
      case 'devices':
        return DevicesPage.build.call(DevicesPage);
      case 'extra':
        return ExtraPage.build.call(ExtraPage);
      default:
        return LoginPage.build.call(LoginPage);
    }
  },
});
