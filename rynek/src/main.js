// Rynek — scena high fantasy. Silnik wspólny (engine/), świat w world.js.
import { createApp } from '../../engine/src/app.js';
import { buildWorld, CONFIG } from './world.js';

createApp({
  buildWorld,
  exposure: 1.15,
  player: { start: { x: 4, z: CONFIG.plaza.size / 2 - 3, yaw: 0.15 }, speed: 2.6 },
});
