import { LogBox } from 'react-native';
import { registerRootComponent } from 'expo';

import App from './App';

LogBox.ignoreAllLogs();

const devLoading = require('react-native/Libraries/Utilities/DevLoadingView').default as {
  showMessage: (...args: unknown[]) => void;
  hide: () => void;
};
devLoading.showMessage = () => {};
devLoading.hide();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
