export function UnitSelector<T extends string>({ label, modes, value, modeLabel, onChange }: {
  label: string; modes: readonly T[]; value: T; modeLabel: (mode: T) => string; onChange: (mode: T) => void
}) {
  return <fieldset className="unit-selector"><legend>{label}</legend>
    <div>{modes.map(mode => <button key={mode} type="button" aria-pressed={value === mode} onClick={() => onChange(mode)}>{modeLabel(mode)}</button>)}</div>
  </fieldset>
}
