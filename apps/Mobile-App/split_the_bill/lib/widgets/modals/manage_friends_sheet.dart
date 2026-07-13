import 'package:flutter/material.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import '../../models/models.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../common_widgets.dart';
import '../friend_invitations.dart';

Future<void> showManageFriendsSheet(
  BuildContext context, {
  required Invitations? invitations,
  required Future<void> Function(String invitationId, String decision) onAnswerInvitation,
  required Future<void> Function(String invitationId) onCancelSentInvitation,
  required Future<void> Function() onOpenAddFriend,
}) {
  final sheetHeight = MediaQuery.sizeOf(context).height * 0.58;
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    constraints: BoxConstraints(
      minHeight: sheetHeight,
      maxHeight: sheetHeight,
    ),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (sheetContext) => _ManageFriendsSheet(
      invitations: invitations,
      onAnswerInvitation: onAnswerInvitation,
      onCancelSentInvitation: onCancelSentInvitation,
      onOpenAddFriend: onOpenAddFriend,
    ),
  );
}

class _ManageFriendsSheet extends StatefulWidget {
  const _ManageFriendsSheet({
    required this.invitations,
    required this.onAnswerInvitation,
    required this.onCancelSentInvitation,
    required this.onOpenAddFriend,
  });

  final Invitations? invitations;
  final Future<void> Function(String invitationId, String decision) onAnswerInvitation;
  final Future<void> Function(String invitationId) onCancelSentInvitation;
  final Future<void> Function() onOpenAddFriend;

  @override
  State<_ManageFriendsSheet> createState() => _ManageFriendsSheetState();
}

class _ManageFriendsSheetState extends State<_ManageFriendsSheet> {
  late List<FriendInvitation> _pendingReceived;
  late List<FriendInvitation> _pendingSent;
  String? _processingInvitationId;

  @override
  void initState() {
    super.initState();
    _pendingReceived = widget.invitations?.receivedFriends
            .where((invite) => invite.status == InvitationStatus.pending)
            .toList() ??
        [];
    _pendingSent = widget.invitations?.sentFriends
            .where((invite) => invite.status == InvitationStatus.pending)
            .toList() ??
        [];
  }

  Future<void> _openAddFriendFlow() async {
    Navigator.of(context).pop();
    await Future<void>.delayed(const Duration(milliseconds: 140));
    await widget.onOpenAddFriend();
  }

  Future<void> _answerInvitation(
    FriendInvitation invite,
    String decision,
  ) async {
    setState(() {
      _processingInvitationId = invite.id;
    });
    try {
      await widget.onAnswerInvitation(invite.id, decision);
      if (!mounted) return;
      setState(() {
        _pendingReceived = _pendingReceived
            .where((pendingInvite) => pendingInvite.id != invite.id)
            .toList();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            decision == 'accept'
                ? 'Invitation accepted.'
                : 'Invitation declined.',
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _processingInvitationId = null;
        });
      }
    }
  }

  Future<void> _cancelSentInvitation(FriendInvitation invite) async {
    setState(() {
      _processingInvitationId = invite.id;
    });
    try {
      await widget.onCancelSentInvitation(invite.id);
      if (!mounted) return;
      setState(() {
        _pendingSent = _pendingSent
            .where((pendingInvite) => pendingInvite.id != invite.id)
            .toList();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invitation canceled.')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _processingInvitationId = null;
        });
      }
    }
  }

  Widget _buildPendingSentInvitation(FriendInvitation invite) {
    final isProcessing = _processingInvitationId == invite.id;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Slidable(
        key: ValueKey('pending-sent-${invite.id}'),
        groupTag: 'pending-sent-invitations',
        closeOnScroll: true,
        enabled: !isProcessing,
        endActionPane: ActionPane(
          motion: const BehindMotion(),
          extentRatio: 0.34,
          dragDismissible: false,
          openThreshold: 0.18,
          closeThreshold: 0.12,
          children: [
            CustomSlidableAction(
              onPressed: (_) => _cancelSentInvitation(invite),
              autoClose: true,
              padding: EdgeInsets.zero,
              backgroundColor: Colors.transparent,
              child: const _SwipeCancelAction(),
            ),
          ],
        ),
        child: Card(
          clipBehavior: Clip.antiAlias,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: const BorderSide(color: AppColors.border),
          ),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 14,
              vertical: 4,
            ),
            leading: CircleAvatar(
              radius: 18,
              backgroundColor: AppColors.surfaceMuted,
              child: const Icon(
                Icons.schedule,
                size: 18,
                color: AppColors.text,
              ),
            ),
            title: Text(
              friendInvitationRecipientLabel(invite),
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            subtitle: const Text(
              'Invitation sent',
              style: TextStyle(fontSize: 13),
            ),
            trailing: isProcessing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const InvitationStatusChip(status: InvitationStatus.pending),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasPending = _pendingReceived.isNotEmpty || _pendingSent.isNotEmpty;

    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 14,
          bottom: MediaQuery.viewInsetsOf(context).bottom + 16,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 32,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Manage friends',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                  ),
                ),
                TextButton.icon(
                  onPressed: _openAddFriendFlow,
                  icon: const Icon(Icons.person_add_alt_1, size: 18),
                  label: const Text('Add friend'),
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.accent,
                    backgroundColor: AppColors.accentSoft,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Expanded(
              child: widget.invitations == null
                  ? const Center(child: LoadingView())
                  : !hasPending
                      ? const Card(
                          child: Padding(
                            padding: EdgeInsets.all(20),
                            child: EmptyState(
                              message:
                                  'No pending invitations. Tap Add friend to invite someone.',
                            ),
                          ),
                        )
                      : SingleChildScrollView(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              if (_pendingReceived.isNotEmpty) ...[
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Wants to be friends',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textH,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                ..._pendingReceived.map((invite) {
                  final isProcessing = _processingInvitationId == invite.id;
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    color: AppColors.pendingBg,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                      side: BorderSide(
                        color: AppColors.pendingText.withValues(alpha: 0.18),
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            displayName(invite.sender),
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              color: AppColors.textH,
                            ),
                          ),
                          const SizedBox(height: 12),
                          if (isProcessing)
                            const Center(
                              child: SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              ),
                            )
                          else
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: () => _answerInvitation(invite, 'decline'),
                                    child: const Text('Decline'),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: FilledButton(
                                    onPressed: () => _answerInvitation(invite, 'accept'),
                                    style: FilledButton.styleFrom(
                                      backgroundColor: AppColors.accent,
                                    ),
                                    child: const Text('Accept'),
                                  ),
                                ),
                              ],
                            ),
                        ],
                      ),
                    ),
                  );
                }),
              ],
              if (_pendingSent.isNotEmpty) ...[
                if (_pendingReceived.isNotEmpty) const SizedBox(height: 8),
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Pending invitations',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textH,
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Swipe left on a sent invitation to cancel.',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.text,
                      height: 1.35,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                ..._pendingSent.map(_buildPendingSentInvitation),
              ],
                            ],
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SwipeCancelAction extends StatelessWidget {
  const _SwipeCancelAction();

  static const _cancelRedLight = Color(0xFFE53935);
  static const _cancelRed = Color(0xFFC62828);
  static const _cancelRedDark = Color(0xFFB71C1C);

  @override
  Widget build(BuildContext context) {
    final animation = Slidable.of(context)?.animation;

    Widget content = Padding(
      padding: const EdgeInsets.only(left: 10),
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
            colors: [
              _cancelRedLight,
              _cancelRed,
              _cancelRedDark,
            ],
          ),
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: _cancelRed.withValues(alpha: 0.42),
              blurRadius: 14,
              offset: const Offset(-3, 4),
            ),
          ],
        ),
        child: const SizedBox(
          width: double.infinity,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.close_rounded,
                color: Colors.white,
                size: 22,
              ),
              SizedBox(height: 4),
              Text(
                'Cancel',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                  letterSpacing: 0.1,
                ),
              ),
            ],
          ),
        ),
      ),
    );

    if (animation == null) return content;

    return AnimatedBuilder(
      animation: animation,
      builder: (context, child) {
        final progress = Curves.easeOutCubic.transform(animation.value);
        return Opacity(
          opacity: progress,
          child: Transform.translate(
            offset: Offset(18 * (1 - progress), 0),
            child: Transform.scale(
              scale: 0.84 + (progress * 0.16),
              alignment: Alignment.centerLeft,
              child: child,
            ),
          ),
        );
      },
      child: content,
    );
  }
}
