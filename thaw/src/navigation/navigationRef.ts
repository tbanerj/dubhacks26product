import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/** Lets non-screen code (deep-link handling) navigate once the container is ready. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
