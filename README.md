# zepp-starline

Remote start & security control for StarLine S96/S9 alarms via Amazfit GTR4 (Zepp OS 2.0). Watch → BLE → Phone → StarLine Cloud API.

## Features

- Engine start / stop with warmup timer
- Arm / disarm security
- Cabin temperature display
- Confirmation screen before engine start
- Vibration feedback on success / error
- Token caching (4h TTL), auto-refresh on expiry

## Architecture

```
[GTR4 - Device App]
  ↓ Bluetooth LE (MessageBuilder)
[Android/iOS - Zepp App - Side Service]
  ↓ HTTPS
[StarLine Cloud API — dev.starline.ru]
  ↓
[StarLine S96/S9]
```

## Requirements

- Amazfit GTR4 (Zepp OS 2.0 / API_LEVEL 2.0)
- Zepp App on Android or iOS with Developer Mode enabled
- [Zeus CLI](https://github.com/zepp-health/zeus-cli)
- StarLine developer credentials from [developer.starline.ru](https://developer.starline.ru)
- StarLine account at [my.starline.ru](https://my.starline.ru) with S96/S9 linked

## Setup

1. Register the app at [console.zepp.com](https://console.zepp.com) → get `appId` → put it in `app.json`
2. Register at [developer.starline.ru](https://developer.starline.ru) → get `App ID` and `Secret Key`
3. Install Zeus CLI: `npm install -g @zeppos/zeus-cli`
4. Build: `zeus build`
5. Deploy to watch: `zeus preview` → scan QR in Zepp App

## Configuration (Settings App)

Open the app settings in Zepp App:
- **Email / Password** — your StarLine account
- **App ID / Secret Key** — from developer.starline.ru
- **Select vehicle** — choose from your linked devices
- **Warmup time** — 5 / 10 / 15 / 20 / 30 min
- **Confirm before start** — toggle confirmation screen
- **Status refresh interval** — 90 sec minimum (API rate limit)

## API Rate Limits

StarLine API allows max ~1000 requests/day. Status is polled no more than once per 90 seconds.

## License

MIT
