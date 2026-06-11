import type { CustomSplitMode, SplitKind } from '../utils/billSplit'

type SplitControlsProps = {
  splitKind: SplitKind;
  customMode: CustomSplitMode;
  onSplitKindChange: (kind: SplitKind) => void;
  onCustomModeChange: (mode: CustomSplitMode) => void;
};

export function SplitControls({
  splitKind,
  customMode,
  onSplitKindChange,
  onCustomModeChange,
}: SplitControlsProps) {
  return (
    <fieldset className="bill-split-fieldset">
      <legend>Split</legend>
      <div className="segmented-control" role="radiogroup" aria-label="Split mode">
        <button
          aria-checked={splitKind === 'equal'}
          className={`segmented-control-option${splitKind === 'equal' ? ' is-active' : ''}`}
          role="radio"
          type="button"
          onClick={() => onSplitKindChange('equal')}
        >
          Split equally
        </button>
        <button
          aria-checked={splitKind === 'custom'}
          className={`segmented-control-option${splitKind === 'custom' ? ' is-active' : ''}`}
          role="radio"
          type="button"
          onClick={() => onSplitKindChange('custom')}
        >
          Split differently
        </button>
      </div>
      {splitKind === 'custom' ? (
        <div className="split-value-mode-row">
          <span className="split-value-mode-label" id="split-value-mode-label">
            Split by
          </span>
          <div
            aria-labelledby="split-value-mode-label"
            className="labeled-toggle"
            role="group"
          >
            <button
              className={`labeled-toggle-option${customMode === 'amount' ? ' is-active' : ''}`}
              type="button"
              onClick={() => onCustomModeChange('amount')}
            >
              Amount
            </button>
            <button
              aria-checked={customMode === 'percent'}
              aria-label={
                customMode === 'percent'
                  ? 'Splitting by percentage. Switch to amount.'
                  : 'Splitting by amount. Switch to percentage.'
              }
              className={`labeled-toggle-switch${customMode === 'percent' ? ' is-on' : ''}`}
              role="switch"
              type="button"
              onClick={() =>
                onCustomModeChange(customMode === 'amount' ? 'percent' : 'amount')
              }
            >
              <span aria-hidden="true" className="labeled-toggle-thumb" />
            </button>
            <button
              className={`labeled-toggle-option${customMode === 'percent' ? ' is-active' : ''}`}
              type="button"
              onClick={() => onCustomModeChange('percent')}
            >
              Percentage
            </button>
          </div>
        </div>
      ) : null}
    </fieldset>
  )
}
