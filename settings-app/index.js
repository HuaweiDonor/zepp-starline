AppSettingsPage({
  state: {
    email: '',
    password: '',
    appId: '',
    secretKey: '',
    deviceId: '',
    warmupTime: '10',
  },

  build(props) {
    const storage = props.settingsStorage;

    this.state.email = storage.getItem('email') || '';
    this.state.password = storage.getItem('password') || '';
    this.state.appId = storage.getItem('app_id') || '';
    this.state.secretKey = storage.getItem('secret_key') || '';
    this.state.deviceId = storage.getItem('device_id') || '';
    this.state.warmupTime = storage.getItem('warmup_time') || '10';

    const rawList = storage.getItem('device_list');
    let deviceListText = '';
    if (rawList) {
      try {
        const devices = JSON.parse(rawList);
        deviceListText = devices
          .map(d => (d.alias || d.name || 'Device') + ': ' + d.device_id)
          .join('\n');
      } catch (e) {}
    }

    const items = [
      Section({ title: 'Аккаунт StarLine' }),
      Input({
        label: 'Email',
        value: this.state.email,
        placeholder: 'user@example.com',
        onChange: (val) => { storage.setItem('email', val); },
      }),
      Input({
        label: 'Пароль',
        value: this.state.password,
        type: 'password',
        placeholder: '••••••••',
        onChange: (val) => { storage.setItem('password', val); },
      }),
      Section({ title: 'API ключи (developer.starline.ru)' }),
      Input({
        label: 'App ID',
        value: this.state.appId,
        placeholder: '12345',
        onChange: (val) => { storage.setItem('app_id', val); },
      }),
      Input({
        label: 'Secret Key',
        value: this.state.secretKey,
        type: 'password',
        placeholder: 'xxxxxxxxxxxxxxxx',
        onChange: (val) => { storage.setItem('secret_key', val); },
      }),
      Section({ title: '' }),
      Button({
        label: 'Войти и получить список устройств',
        onClick: () => {
          storage.setItem('action', 'login');
        },
      }),
    ];

    if (deviceListText) {
      items.push(
        Section({ title: 'Доступные устройства' }),
        Text({ text: deviceListText }),
      );
    }

    items.push(
      Section({ title: 'Настройки' }),
      Input({
        label: 'ID устройства',
        value: this.state.deviceId,
        placeholder: 'Из списка выше',
        onChange: (val) => { storage.setItem('device_id', val); },
      }),
      Input({
        label: 'Время прогрева (мин)',
        value: this.state.warmupTime,
        placeholder: '10',
        onChange: (val) => { storage.setItem('warmup_time', val); },
      }),
    );

    return items;
  },
});
