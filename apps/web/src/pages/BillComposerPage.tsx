import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getBill } from '../api/billsApi'
import { apiErrorMessage } from '../api/client'
import { listFriends } from '../api/friendsApi'
import { listGroups } from '../api/groupsApi'
import { queryKeys } from '../api/queryClient'
import { BillForm } from '../components/BillForm'
import '../styles/bills.css'

export function BillComposerPage() {
  const { billId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const friendsQuery = useQuery({ queryKey: queryKeys.friends, queryFn: listFriends })
  const groupsQuery = useQuery({ queryKey: queryKeys.groups, queryFn: listGroups })
  const billQuery = useQuery({
    queryKey: queryKeys.bill(billId ?? 'new'),
    queryFn: () => getBill(billId!),
    enabled: Boolean(billId),
  })
  const bill = billQuery.data
  const friends = friendsQuery.data ?? []
  const groups = groupsQuery.data ?? []
  const isLoading = friendsQuery.isPending || groupsQuery.isPending || (Boolean(billId) && billQuery.isPending)
  const error = billQuery.error
  const partialError = friendsQuery.error || groupsQuery.error

  return (
    <section className="page bc-composer-page">
      <Link className="back-link" to={billId ? `/bills/${billId}` : '/bills'}>
        {billId ? 'Back to bill' : 'Back to bills'}
      </Link>
      <header className="page-header bc-composer-header">
        <div>
          <p className="eyebrow">{billId ? 'Edit expense' : 'New expense'}</p>
          <h1>{billId ? 'Update bill' : 'Create a bill'}</h1>
          <p>{billId ? 'Every saved receipt and split field is loaded below.' : 'Record a total or scan a receipt, then choose exactly how to share it.'}</p>
        </div>
      </header>
      {error ? <div className="bc-page-error"><strong>We could not open this editor.</strong><p>{apiErrorMessage(error, 'Unable to open the bill editor.')}</p><button className="secondary-button" type="button" onClick={() => void billQuery.refetch()}>Try again</button></div> : null}
      {!error && partialError && !isLoading ? <p className="bc-data-warning">Some people or groups could not be loaded. You can still create a bill with the options shown.</p> : null}
      {isLoading ? <div className="bc-composer-skeleton"><span /><span /><span /></div> : null}
      {!isLoading && !error && (!billId || bill) ? (
        billId && bill && !bill.canEdit ? (
          <div className="bc-page-error"><strong>This bill cannot be edited.</strong><p>You can still view its split and settlement status.</p><Link className="primary-button compact" to={`/bills/${bill.id}`}>View bill</Link></div>
        ) : (
          <BillForm
            bill={bill}
            friends={friends}
            groups={groups}
            initialFriendshipId={searchParams.get('friendshipId')}
            initialGroupId={searchParams.get('groupId')}
            onCancel={() => navigate(bill ? `/bills/${bill.id}` : '/bills')}
            onSaved={(savedBill) => navigate(`/bills/${savedBill.id}`, { replace: true })}
          />
        )
      ) : null}
    </section>
  )
}
