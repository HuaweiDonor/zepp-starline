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
    const fieldLabel = {
      fontSize: '13px',
      color: '#888',
      marginBottom: '6px',
      paddingLeft: '2px',
    };
    const inputBox = {
      background: '#1e1e1e',
      border: '1px solid #333',
      borderRadius: '8px',
      padding: '0 4px',
    };
    const divider = { height: '1px', background: '#2a2a2a', margin: '4px 16px 12px' };
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

    // ─── Helper: labelled input ───────────────────────────────────────────────
    const Field = (label, key, placeholder, extra) =>
      View({ style: fieldWrap }, [
        View({ style: fieldLabel }, [label]),
        View({ style: inputBox }, [
          TextInput({
            label: '',
            value: storage.getItem(key) || '',
            placeholder,
            onChange: (val) => { storage.setItem(key, val); },
            ...extra,
          }),
        ]),
      ]);

    // ─── Device list (shown after login) ─────────────────────────────────────
    let deviceListSection = [];
    const rawList = storage.getItem('device_list');
    if (rawList) {
      try {
        const devices = JSON.parse(rawList);
        const text = devices
          .map(d => (d.alias || d.name || 'Устройство') + '  —  ID: ' + d.device_id)
          .join('\n');
        if (text) {
          deviceListSection = [
            View({ style: sectionLabel }, ['Найденные устройства']),
            View({ style: deviceBox }, [text]),
          ];
        }
      } catch (e) {}
    }

    // ─── Build ────────────────────────────────────────────────────────────────
    return View({ style: page }, [
      // Header
      View({ style: header }, [
        View({ style: headerTitle }, ['StarLine Remote']),
        View({ style: headerSub }, ['Настройки подключения']),
      ]),

      // Account
      View({ style: sectionLabel }, ['Аккаунт StarLine']),
      Field('Email', 'email', 'user@example.com'),
      Field('Пароль', 'password', '••••••••'),

      // API keys
      View({ style: sectionLabel }, ['API ключи (developer.starline.ru)']),
      Field('App ID', 'app_id', '12345'),
      Field('Secret Key', 'secret_key', 'xxxxxxxxxxxxxxxx'),

      // Login button
      Button({
        label: 'Войти и получить список устройств',
        style: loginBtn,
        onClick: () => { storage.setItem('action', 'login'); },
      }),

      // Device list after login
      ...deviceListSection,

      // Device settings
      View({ style: sectionLabel }, ['Настройки устройства']),
      Field('ID устройства', 'device_id', 'Скопируйте из списка выше'),
      Field('Время прогрева (мин)', 'warmup_time', '10'),
    ]);
  },
});
