import type { CustomSplitMode, MemberSplitState, SplitKind } from '../utils/billSplit'
import { displayName } from '../utils/format'

type BillSplitMemberListProps = {
  members: MemberSplitState[];
  payerId: string;
  splitKind: SplitKind;
  customMode: CustomSplitMode;
  readOnlyValues: boolean;
  onToggleIncluded: (userId: string) => void;
  onAmountChange: (userId: string, value: string) => void;
  onPercentChange: (userId: string, value: string) => void;
};

export function BillSplitMemberList({
  members,
  payerId,
  splitKind,
  customMode,
  readOnlyValues,
  onToggleIncluded,
  onAmountChange,
  onPercentChange,
}: BillSplitMemberListProps) {
  return (
    <div className="bill-split-member-list">
      {members.map((member) => {
        const isPayer = member.user.id === payerId
        const valueDisabled = !member.included || readOnlyValues
        const showPercent = splitKind === 'custom' && customMode === 'percent'

        return (
          <div
            className={`bill-split-member-row${member.included ? ' is-included' : ''}${isPayer ? ' is-payer' : ''}`}
            key={member.user.id}
          >
            <button
              aria-checked={member.included}
              aria-label={`${member.included ? 'Exclude' : 'Include'} ${displayName(member.user)}`}
              className="bill-split-member-toggle"
              onClick={() => onToggleIncluded(member.user.id)}
              role="checkbox"
              type="button"
            >
              <span aria-hidden="true" className="bill-split-check">
                {member.included ? '✓' : ''}
              </span>
              <span className="bill-split-member-name">
                {displayName(member.user)}
                {isPayer ? <span className="bill-split-payer-tag">Paid by</span> : null}
              </span>
            </button>
            <label className="bill-split-value">
              <span className="sr-only">
                {showPercent ? 'Percent for' : 'Amount for'} {displayName(member.user)}
              </span>
              {showPercent ? (
                <>
                  <input
                    disabled={valueDisabled}
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    type="number"
                    value={member.percent}
                    onChange={(event) => onPercentChange(member.user.id, event.target.value)}
                  />
                  <span className="bill-split-suffix">%</span>
                </>
              ) : (
                <>
                  <span className="bill-split-prefix">$</span>
                  <input
                    disabled={valueDisabled}
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    type="number"
                    value={member.amount}
                    onChange={(event) => onAmountChange(member.user.id, event.target.value)}
                  />
                </>
              )}
            </label>
          </div>
        )
      })}
    </div>
  )
}
