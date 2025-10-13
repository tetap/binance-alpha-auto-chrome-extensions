export const isNewerVersion = (latest: string, current: string) => {
  const parse = (v: string) =>
    v
      .replace(/^v/, '')
      .split('.')
      .map(n => parseInt(n));
  const [lMaj, lMin, lPatch] = parse(latest);
  const [cMaj, cMin, cPatch] = parse(current);

  if (lMaj > cMaj) return true;
  if (lMaj < cMaj) return false;
  if (lMin > cMin) return true;
  if (lMin < cMin) return false;
  if (lPatch > cPatch) return true;
  return false;
};
