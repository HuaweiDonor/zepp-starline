AppSettingsPage({
  state: { props: null },

  build(props) {
    this.state.props = props;
    const storage = props.settingsStorage;

    // ─── Styles ───────────────────────────────────────────────────────────────
    const page = {
      background: '#121212',
      minHeight: '100vh',
      padding: '0 0 40px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    };
    const header = {
      background: '#1a1a1a',
      padding: '24px 20px 18px',
      borderBottom: '1px solid #2a2a2a',
      textAlign: 'center',
    };
    const headerTitle = {
      fontSize: '20px',
      fontWeight: '700',
      color: '#ffffff',
      margin: '0',
      letterSpacing: '0.5px',
    };
    const headerSub = {
      fontSize: '12px',
      color: '#555',
      marginTop: '4px',
    };
    const sectionLabel = {
      fontSize: '11px',
      fontWeight: '600',
      color: '#555',
      textTransform: 'uppercase',
      letterSpacing: '1.2px',
      margin: '24px 20px 8px',
    };
    const fieldWrap = {
      margin: '0 16px 12px',
    };
    const loginBtn = {
      display: 'block',
      margin: '8px 16px 0',
      background: '#1a5c8a',
      color: '#fff',
      fontSize: '15px',
      fontWeight: '600',
      borderRadius: '10px',
      padding: '14px',
      textAlign: 'center',
      border: 'none',
      width: 'auto',
    };
    const deviceBox = {
      margin: '0 16px',
      background: '#162416',
      border: '1px solid #1e3a1e',
      borderRadius: '10px',
      padding: '12px 14px',
      fontSize: '13px',
      color: '#7ec87e',
      lineHeight: '1.7',
      whiteSpace: 'pre-wrap',
    };
    const toggleRow = {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 20px',
      margin: '0 0 2px',
    };
    const toggleLabel = {
      fontSize: '14px',
      color: '#cccccc',
    };
    const logBox = {
      margin: '0 16px',
      background: '#0a0a0a',
      border: '1px solid #222',
      borderRadius: '10px',
      padding: '10px 12px',
      fontSize: '11px',
      color: '#7ec87e',
      lineHeight: '1.9',
      whiteSpace: 'pre-wrap',
      fontFamily: 'monospace',
      overflowX: 'hidden',
      wordBreak: 'break-all',
      maxHeight: '240px',
      overflowY: 'auto',
    };
    const deviceRow = {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: '1px solid #1e3a1e',
    };
    const copyBtn = {
      background: '#1a3a1a',
      color: '#7ec87e',
      fontSize: '12px',
      fontWeight: '600',
      borderRadius: '8px',
      padding: '8px 12px',
      border: '1px solid #2a5a2a',
    };
    const clearBtn = {
      display: 'block',
      margin: '8px 16px 0',
      background: '#1a1a1a',
      color: '#555',
      fontSize: '13px',
      borderRadius: '8px',
      padding: '10px',
      textAlign: 'center',
      border: '1px solid #2a2a2a',
      width: 'auto',
    };

    // ─── Helper: input field ──────────────────────────────────────────────────
    const Field = (label, key, placeholder) =>
      View({ style: fieldWrap }, [
        TextInput({
          label,
          value: storage.getItem(key) || '',
          placeholder,
          onChange: (val) => { storage.setItem(key, val); },
        }),
      ]);

    // ─── Helper: toggle row ───────────────────────────────────────────────────
    const ToggleRow = (label, key) => {
      const stored = storage.getItem(key);
      const isOn = stored === null ? true : stored === 'true';
      return View({ style: toggleRow }, [
        View({ style: toggleLabel }, [label]),
        Toggle({
          value: isOn,
          onChange: (val) => { storage.setItem(key, val ? 'true' : 'false'); },
        }),
      ]);
    };

    // ─── Device list (shown after login) ─────────────────────────────────────
    let deviceListSection = [];
    const rawList = storage.getItem('device_list');
    if (rawList) {
      try {
        const devices = JSON.parse(rawList);
        if (devices && devices.length) {
          deviceListSection = [
            View({ style: sectionLabel }, ['Найденные устройства']),
            View({ style: deviceBox }, [
              ...devices.map(d =>
                View({ style: deviceRow }, [
                  View({ style: { flex: '1', fontSize: '13px', color: '#7ec87e' } }, [
                    (d.alias || d.name || 'Устройство') + '\nID: ' + d.device_id
                  ]),
                  Button({
                    label: 'Копировать',
                    style: copyBtn,
                    onClick: () => {
                      try { navigator.clipboard.writeText(String(d.device_id)); } catch(e) {}
                      storage.setItem('device_id', String(d.device_id));
                    }
                  })
                ])
              )
            ]),
          ];
        }
      } catch (e) {}
    }

    // ─── Log section ─────────────────────────────────────────────────────────
    let logText = '— нет событий —\n(закройте и откройте настройки для обновления)';
    try {
      const stored = storage.getItem('_log');
      if (stored) {
        const entries = JSON.parse(stored);
        if (entries && entries.length) {
          logText = entries.slice(0, 10).join('\n') + '\n\n(закройте и откройте для обновления)';
        }
      }
    } catch (e) {}

    const logSection = [
      View({ style: sectionLabel }, ['Журнал событий']),
      View({ style: logBox }, [logText]),
      Button({
        label: 'Очистить лог',
        style: clearBtn,
        onClick: () => { storage.setItem('_log', '[]'); },
      }),
    ];

    // ─── Build ────────────────────────────────────────────────────────────────
    return View({ style: page }, [
      View({ style: header }, [
        View({ style: headerTitle }, ['StarLine Remote']),
        View({ style: headerSub }, ['Настройки подключения']),
      ]),

      View({ style: sectionLabel }, ['Аккаунт StarLine']),
      Field('Email', 'email', 'user@example.com'),
      Field('Пароль', 'password', '••••••••'),

      View({ style: sectionLabel }, ['API ключи (developer.starline.ru)']),
      Field('App ID', 'app_id', '12345'),
      Field('Secret Key', 'secret_key', 'xxxxxxxxxxxxxxxx'),

      Button({
        label: 'Войти и получить список устройств',
        style: loginBtn,
        onClick: () => { storage.setItem('action', 'login'); },
      }),

      ...deviceListSection,

      View({ style: sectionLabel }, ['Настройки устройства']),
      Field('ID устройства', 'device_id', 'Скопируйте из списка выше'),
      Field('Время прогрева (мин)', 'warmup_time', '10'),

      View({ style: sectionLabel }, ['Виджеты на часах']),
      ToggleRow('Температура двигателя', 'show_etemp'),
      ToggleRow('Напряжение АКБ', 'show_battery'),
      ToggleRow('Баланс SIM-карты', 'show_balance'),

      ...logSection,
    ]);
  },
});
