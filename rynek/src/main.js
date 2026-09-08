// Rynek — scena high fantasy. Silnik wspólny (engine/), świat w world.js.
import { createApp } from '../../engine/src/app.js';
import { buildWorld, CONFIG } from './world.js';

// Motyw #7: start z CONFIG.composition.start (pitch przez app.js state.pitch); ?nocompose=1 = start z HEAD (4, 19, yaw 0,15)
const nocompose = new URLSearchParams(location.search).has('nocompose');
createApp({
  buildWorld,
  exposure: 1.15,
  player: { start: nocompose ? { x: 4, z: CONFIG.plaza.size / 2 - 3, yaw: 0.15 } : { ...CONFIG.composition.start }, speed: 2.6 },   // 2.6: prędkość jak HEAD
});
