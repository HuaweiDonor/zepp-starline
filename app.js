import { MessageBuilder } from '@zos/ble/message';

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
