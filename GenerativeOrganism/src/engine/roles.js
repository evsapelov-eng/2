// roles.js: default musical roles of the four voices.
// These are starting points (register, velocity), not hard limits: range,
// channel, density and mutation depth are set per voice in the device.

GO.Roles = [
  { id: 'bass',    name: 'Bass',    center: 40, lo: 28, hi: 55, vel: 96 },
  { id: 'harmony', name: 'Harmony', center: 57, lo: 48, hi: 74, vel: 78 },
  { id: 'melody',  name: 'Melody',  center: 69, lo: 60, hi: 86, vel: 92 },
  { id: 'texture', name: 'Texture', center: 76, lo: 62, hi: 96, vel: 70 }
];
