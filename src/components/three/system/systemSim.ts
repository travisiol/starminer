/**
 * Per-frame state shared by the system scene, kept out of React so
 * useFrame can write to it freely (React Compiler forbids mutating props/refs there).
 * Orbits run on wall-clock time so every tab and reload agrees on where a planet is.
 */
export const systemSim = {
  epoch: null as number | null,
  miningPlanet: null as number | null,
  time(elapsed: number): number {
    if (this.epoch === null) this.epoch = Date.now() / 1000 - elapsed;
    return this.epoch + elapsed;
  },
};
