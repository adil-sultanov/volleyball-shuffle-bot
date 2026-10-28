const LEVELS = [1, 2, 3, 4, 5];

export function StrengthPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="strength" role="radiogroup" aria-label="Strength">
      {LEVELS.map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={value === l}
          className={value === l ? "lvl on" : "lvl"}
          onClick={() => value !== l && onChange(l)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
