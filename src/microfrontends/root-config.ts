import { registerApplication, start } from 'single-spa';
import 'systemjs/dist/system.js';
import 'systemjs/dist/extras/amd.js';

// Declare System for TypeScript
declare const System: any;

// Register microfrontends
registerApplication({
  name: '@proximity-play/auth',
  app: () => System.import('@proximity-play/auth'),
  activeWhen: ['/auth'],
});

registerApplication({
  name: '@proximity-play/dashboard',
  app: () => System.import('@proximity-play/dashboard'),
  activeWhen: ['/'],
});

registerApplication({
  name: '@proximity-play/messages',
  app: () => System.import('@proximity-play/messages'),
  activeWhen: ['/messages'],
});

registerApplication({
  name: '@proximity-play/live',
  app: () => System.import('@proximity-play/live'),
  activeWhen: ['/live'],
});

registerApplication({
  name: '@proximity-play/maps',
  app: () => System.import('@proximity-play/maps'),
  activeWhen: ['/maps'],
});

registerApplication({
  name: '@proximity-play/profile',
  app: () => System.import('@proximity-play/profile'),
  activeWhen: ['/profile'],
});

registerApplication({
  name: '@proximity-play/settings',
  app: () => System.import('@proximity-play/settings'),
  activeWhen: ['/settings'],
});

// Start the single-spa application
start();