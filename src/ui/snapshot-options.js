const OPTION_KEYS = ['eventFramework', 'history', 'personality', 'rules', 'safety'];

const PRESETS = {
  adapt: { eventFramework: true, history: false, personality: false, rules: true, safety: true },
  clone: { eventFramework: true, history: true, personality: true, rules: true, safety: true },
};

export function applySnapshotMode(options, mode) {
  options.mode = mode;
  const preset = PRESETS[mode];
  if (preset) Object.assign(options, preset);
  return options;
}

export function customizeSnapshotOption(options, key, checked) {
  if (!OPTION_KEYS.includes(key)) return options;
  options[key] = Boolean(checked);
  options.mode = 'custom';
  return options;
}
