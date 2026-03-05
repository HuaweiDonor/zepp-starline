import "./device-app/shared/device-polyfill";
import { MessageBuilder } from "./device-app/shared/message";
import { getPackageInfo } from "@zos/app";
import * as ble from "@zos/ble";

App({
  globalData: {
    messageBuilder: null,
  },
  onCreate(options) {
    const { appId } = getPackageInfo();
    const messageBuilder = new MessageBuilder({
      appId,
      appDevicePort: 20,
      appSidePort: 0,
      ble,
    });
    this.globalData.messageBuilder = messageBuilder;
    messageBuilder.connect();
  },

  onDestroy(options) {
    this.globalData.messageBuilder &&
      this.globalData.messageBuilder.disConnect();
  },
});
