import {
  CommunicationLayerPreference,
  DappMetadata,
  DisconnectProps,
  ECIESProps,
  KeyInfo,
  MessageType,
  RemoteCommunication,
  WebRTCLib,
} from '@metamask/sdk-communication-layer';
import { ChannelConfig } from 'packages/sdk-communication-layer/src/types/ChannelConfig';
import { Platform } from '../Platform/Platfform';
import { PlatformType } from '../types/PlatformType';
import InstallModal from '../ui/InstallModal/installModal';
import { ProviderService } from './ProviderService';

interface RemoteConnectionProps {
  timer?: {
    runBackgroundTimer?: (cb: () => void, ms: number) => number;
  };
  communicationLayerPreference: CommunicationLayerPreference;
  dappMetadata?: DappMetadata;
  enableDebug?: boolean;
  transports?: string[];
  webRTCLib?: WebRTCLib;
  communicationServerUrl?: string;
  ecies?: ECIESProps;
}
export class RemoteConnection implements ProviderService {
  connector: RemoteCommunication;

  dappMetadata?: DappMetadata;

  transports?: string[];

  webRTCLib?: WebRTCLib;

  universalLink?: string;

  enableDebug: boolean;

  forceRestart = false;

  sentFirstConnect = false;

  communicationLayerPreference: CommunicationLayerPreference;

  constructor({
    dappMetadata,
    webRTCLib,
    communicationLayerPreference,
    transports,
    enableDebug = false,
    timer,
    ecies,
    communicationServerUrl,
  }: RemoteConnectionProps) {
    this.dappMetadata = dappMetadata;
    this.transports = transports;
    this.enableDebug = enableDebug;
    this.communicationLayerPreference = communicationLayerPreference;
    this.webRTCLib = webRTCLib;

    const platform = Platform.getInstance();

    this.connector = new RemoteCommunication({
      platform: platform.getPlatformType(),
      communicationLayerPreference,
      transports: this.transports,
      webRTCLib: this.webRTCLib,
      dappMetadata: this.dappMetadata,
      enableDebug: this.enableDebug,
      communicationServerUrl,
      context: 'dapp',
      ecies,
    });

    this.connector.startAutoConnect();
    this.connector.on(MessageType.CLIENTS_DISCONNECTED, () => {
      this.sentFirstConnect = false;
    });

    if (timer) {
      timer.runBackgroundTimer?.(() => null, 5000);
    }
  }

  getUniversalLink() {
    if (!this.universalLink) {
      throw new Error('connection not started. run startConnection() first.');
    }
    return this.universalLink;
  }

  startConnection() {
    if (this.enableDebug) {
      console.debug(`RemoteConnection::startConnection()`);
    }

    if (this.connector.isConnected()) {
      console.debug(`RemoteConnection::startConnection() Already connected.`);
      // Nothing to do, already connected.
      return Promise.resolve(true);
    }

    const { channelId, pubKey } = this.connector.generateChannelId();
    const linkParams = `channelId=${encodeURIComponent(
      channelId,
    )}&comm=${encodeURIComponent(
      this.communicationLayerPreference,
    )}&pubkey=${encodeURIComponent(pubKey)}`;

    const universalLink = `${'https://metamask.app.link/connect?'}${linkParams}`;
    const deeplink = `metamask://connect?${linkParams}`;

    const platformType = Platform.getInstance().getPlatformType();

    /* #if _REACTNATIVE
    const showQRCode = false
    //#else */
    const showQRCode =
      platformType === PlatformType.DesktopWeb ||
      platformType === PlatformType.NonBrowser;
    // #endif

    let installModal: any;

    if (showQRCode) {
      installModal = InstallModal({ link: universalLink });
      // console.log('OPEN LINK QRCODE', universalLink);
    } else {
      // console.log('OPEN LINK', universalLink);
      Platform.getInstance().openDeeplink?.(universalLink, deeplink, '_self');
    }

    this.universalLink = universalLink;

    return new Promise<boolean>((resolve) => {
      this.connector.once(MessageType.CLIENTS_READY, () => {
        if (
          installModal?.onClose &&
          typeof installModal.onClose === 'function'
        ) {
          installModal?.onClose();
        }

        if (this.sentFirstConnect) {
          return;
        }
        resolve(true);
        this.sentFirstConnect = true;
      });
    });
  }

  getChannelConfig(): ChannelConfig | undefined {
    return this.connector.getChannelConfig();
  }

  getKeyInfo(): KeyInfo | undefined {
    return this.connector.getKeyInfo();
  }

  resetKeys() {
    console.debug(`RemoteConnection::resetKeys()`);
    this.connector.resetKeys();
  }

  getConnector() {
    return this.connector;
  }

  isConnected() {
    return this.connector.isConnected();
  }

  isPaused() {
    return this.connector.isPaused();
  }

  disconnect(options?: DisconnectProps): void {
    return this.connector.disconnect(options);
  }
}
