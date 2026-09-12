# ReceiptSnap

Native iOS, Android, and web app built with [Expo](https://expo.dev) and [Expo Router](https://docs.expo.dev/router/introduction/).

## Setup

Install [Node.js](https://github.com/nvm-sh/nvm) (20.19.4+) and [Yarn](https://yarnpkg.com/getting-started/install), then:

```bash
git clone <YOUR_GIT_URL>
cd receipt-snap
yarn install
```

If Yarn reports an engine mismatch on Node 20.17, use:

```bash
yarn install --ignore-engines
```

## Run

```bash
yarn start
```

This opens the Expo dev server. From there:

- scan the QR code in [Expo Go](https://expo.dev/go) on a phone (camera and filing work; on-device OCR does not)
- press `i` for iOS Simulator
- press `a` for Android emulator
- press `w` for web

**Receipt detection** uses Apple VisionKit and Google ML Kit Document Scanner (edge find, crop, then OCR). Rebuild after installing:

```bash
yarn android:device
# or
yarn ios:device
```

Tunnel mode (if the device is not on the same Wi-Fi):

```bash
yarn start -- --tunnel
```

## Deploy

Install EAS CLI and follow Expo's store guides:

```bash
yarn global add eas-cli
eas build:configure
eas build --platform ios
eas build --platform android
eas submit --platform ios
eas submit --platform android
```

- [iOS App Store](https://docs.expo.dev/submit/ios/)
- [Google Play](https://docs.expo.dev/submit/android/)
- [EAS Hosting (web)](https://docs.expo.dev/eas/hosting/get-started/)

Custom development builds are needed for Face ID, in-app purchases, push notifications, and other native modules. See [development builds](https://docs.expo.dev/develop/development-builds/introduction/).

```bash
eas build --profile development --platform ios
eas build --profile development --platform android
yarn start -- --dev-client
```

## Troubleshooting

1. Clear the bundler cache: `yarn start -- --clear`
2. Reinstall dependencies: `rm -rf node_modules && yarn install --ignore-engines`
3. Check [Expo troubleshooting](https://docs.expo.dev/troubleshooting/build-errors/)
