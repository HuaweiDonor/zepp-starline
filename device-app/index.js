import { MessageBuilder } from '@zos/ble/message';

// Initialize MessageBuilder for device-side communication
const messageBuilder = new MessageBuilder();

App({
  globalData: {
    messageBuilder,
  },

  onCreate() {
    messageBuilder.connect();
  },

  onDestroy() {
    messageBuilder.disConnect();
  },
});
