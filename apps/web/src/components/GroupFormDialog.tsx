import { zodResolver } from '@hookform/resolvers/zod'
import * as Dialog from '@radix-ui/react-dialog'
import { useMutation } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { apiErrorMessage } from '../api/client'
import { createGroup, updateGroup } from '../api/groupsApi'
import { invalidateGroupData, queryClient, queryKeys } from '../api/queryClient'
import type { GroupIconKey, GroupSummary } from '../api/types'
import { groupIconOptions } from '../utils/groupIcons'
import { useToast } from './ui/useToast'

const groupSchema = z.object({
  name: z.string().trim().min(1, 'Enter a group name.').max(80, 'Use 80 characters or fewer.'),
  iconKey: z.enum([
    'home',
    'trip',
    'food',
    'groceries',
    'rent',
    'utilities',
    'entertainment',
    'sports',
    'pets',
    'family',
    'work',
    'other',
  ]),
})

type GroupFormValues = z.infer<typeof groupSchema>

const GROUP_FORM_ERROR_ID = 'group-form-error'
const GROUP_NAME_ERROR_ID = 'group-name-error'

export function GroupFormDialog({
  group,
  onCloseAutoFocus,
  onOpenChange,
  open,
}: {
  group?: Pick<GroupSummary, 'id' | 'name' | 'iconKey'>;
  onCloseAutoFocus?: (event: Event) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const { showToast } = useToast()
  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    values: {
      name: group?.name ?? '',
      iconKey: group?.iconKey ?? 'other',
    },
  })
  const selectedIcon = useWatch({ control: form.control, name: 'iconKey' })
  const mutation = useMutation({
    mutationFn: (values: GroupFormValues) => group
      ? updateGroup(group.id, values)
      : createGroup(values),
    onSuccess: async () => {
      onOpenChange(false)
      form.reset()
      showToast(group ? 'Group updated.' : 'Group created.', 'success')
      await Promise.all([
        invalidateGroupData(),
        ...(group ? [queryClient.invalidateQueries({ queryKey: queryKeys.group(group.id) })] : []),
      ])
    },
    onError: (error) => form.setError('root', { message: apiErrorMessage(error, 'Unable to save group.') }),
  })

  function selectIcon(iconKey: GroupIconKey) {
    form.setValue('iconKey', iconKey, { shouldDirty: true, shouldValidate: true })
  }

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="social-dialog-overlay" />
        <Dialog.Content className="social-dialog social-group-dialog" aria-describedby="group-dialog-description" onCloseAutoFocus={onCloseAutoFocus}>
          <div className="social-dialog__header">
            <div><p className="bc-eyebrow">{group ? 'Group settings' : 'Shared space'}</p><Dialog.Title>{group ? 'Edit group' : 'Create a group'}</Dialog.Title></div>
            <Dialog.Close aria-label="Close group dialog" className="bc-icon-button"><X aria-hidden="true" size={18} /></Dialog.Close>
          </div>
          <Dialog.Description id="group-dialog-description">
            {group ? 'Update the name or icon everyone sees.' : 'Make a home for recurring expenses with friends.'}
          </Dialog.Description>
          <form
            aria-describedby={form.formState.errors.root ? GROUP_FORM_ERROR_ID : undefined}
            className="bc-form"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            {form.formState.errors.root ? <p className="bc-error" id={GROUP_FORM_ERROR_ID} role="alert">{form.formState.errors.root.message}</p> : null}
            <label className="bc-field">Group name
              <input
                aria-describedby={form.formState.errors.name ? GROUP_NAME_ERROR_ID : undefined}
                aria-invalid={Boolean(form.formState.errors.name)}
                autoFocus
                maxLength={80}
                placeholder="Weekend in Montreal"
                {...form.register('name')}
              />
              {form.formState.errors.name ? <span className="bc-field__error" id={GROUP_NAME_ERROR_ID} role="alert">{form.formState.errors.name.message}</span> : null}
            </label>
            <fieldset className="social-icon-picker">
              <legend>Choose an icon</legend>
              <div>
                {groupIconOptions.map(({ icon: Icon, key, label }) => (
                  <button
                    aria-label={label}
                    aria-pressed={selectedIcon === key}
                    className={selectedIcon === key ? 'is-selected' : ''}
                    key={key}
                    onClick={() => selectIcon(key)}
                    title={label}
                    type="button"
                  >
                    <Icon aria-hidden="true" size={21} />
                    {selectedIcon === key ? <Check aria-hidden="true" className="social-icon-picker__check" size={12} /> : null}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="social-dialog__actions">
              <Dialog.Close asChild><button className="bc-button" type="button">Cancel</button></Dialog.Close>
              <button className="bc-button bc-button--primary" disabled={mutation.isPending} type="submit">{mutation.isPending ? 'Saving…' : group ? 'Save changes' : 'Create group'}</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
