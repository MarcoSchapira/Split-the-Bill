import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../api/api_exception.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../utils/request_items.dart';
import '../../widgets/common_widgets.dart';
import '../../widgets/requests/request_list_item.dart';
import '../../widgets/requests/show_passed_requests_toggle.dart';

class FriendsScreen extends StatelessWidget {
  const FriendsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink();
  }
}

class FriendDetailScreen extends ConsumerStatefulWidget {
  const FriendDetailScreen({super.key, required this.friendshipId});

  final String friendshipId;

  @override
  ConsumerState<FriendDetailScreen> createState() => _FriendDetailScreenState();
}

class _FriendDetailScreenState extends ConsumerState<FriendDetailScreen> {
  FriendshipDetail? _friendship;
  List<Bill> _bills = [];
  String? _error;
  bool _isLoading = true;
  bool _showPassedRequests = false;
  String? _settlingShareId;
  bool _isSettlingAll = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _error = null;
      _isLoading = true;
    });

    try {
      final friendship =
          await ref.read(friendsApiProvider).getFriendship(widget.friendshipId);
      final bills = await ref
          .read(billsApiProvider)
          .listBills(participantId: friendship.friend.id);
      if (mounted) {
        setState(() {
          _friendship = friendship;
          _bills = bills;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(
          () => _error = apiErrorMessage(e, 'Unable to load friend details.'),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _markPaid(RequestItem item) async {
    setState(() => _settlingShareId = item.shareId);

    try {
      if (item.role == RequestRole.debtor) {
        await ref.read(billsApiProvider).settleBill(item.billId);
      } else {
        await ref.read(billsApiProvider).settleBill(
              item.billId,
              participantUserId: item.counterparty.id,
            );
      }
      notifyDataChanged(ref);
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              item.role == RequestRole.debtor
                  ? 'Marked as paid.'
                  : '${displayName(item.counterparty)} marked as paid.',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              apiErrorMessage(e, 'Unable to update payment status.'),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _settlingShareId = null);
    }
  }

  void _toggleShowPassedRequests() {
    HapticFeedback.selectionClick();
    setState(() => _showPassedRequests = !_showPassedRequests);
  }

  Future<void> _openSettleDialog({
    required int balanceCents,
    required String friendName,
  }) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => _SettleUpConfirmDialog(
        balanceCents: balanceCents,
        friendName: friendName,
      ),
    );
    if (confirmed == true && mounted) {
      await _settleAll();
    }
  }

  Future<void> _settleAll() async {
    if (_isSettlingAll) return;
    setState(() => _isSettlingAll = true);

    try {
      final settledCount =
          await ref.read(friendsApiProvider).settleFriend(widget.friendshipId);
      notifyDataChanged(ref);
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              settledCount == 0
                  ? 'Already settled up.'
                  : 'All bills settled up.',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              apiErrorMessage(e, 'Unable to settle up with this friend.'),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSettlingAll = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(dataRefreshProvider, (_, __) => _load());

    final friendship = _friendship;
    final currentUserId = ref.watch(authProvider).user?.id;
    final items = friendship == null || currentUserId == null
        ? const <RequestItem>[]
        : requestItemsForFriend(
            bills: _bills,
            currentUserId: currentUserId,
            friendUserId: friendship.friend.id,
            includePassedRequests: _showPassedRequests,
          );
    final balanceCents = friendNetBalanceCents(items);
    final awaitingConfirmationCents = friendAwaitingConfirmationCents(items);
    final friendName =
        friendship != null ? displayName(friendship.friend) : 'Friend';

    return Scaffold(
      appBar: AppBar(
        title: Text(friendName),
      ),
      body: _isLoading && friendship == null
          ? const LoadingView(message: 'Loading friend...')
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.accent,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  if (_error != null) ...[
                    ErrorBanner(message: _error!),
                    const SizedBox(height: 12),
                  ],
                  if (friendship != null) ...[
                    _FriendHeader(
                      email: friendship.friend.email,
                      balanceCents: balanceCents,
                      awaitingConfirmationCents: awaitingConfirmationCents,
                      isSettling: _isSettlingAll,
                      onSettleUp: () => _openSettleDialog(
                        balanceCents: balanceCents,
                        friendName: friendName,
                      ),
                    ),
                    const SizedBox(height: 22),
                    Row(
                      children: [
                        const Expanded(
                          child: Text(
                            'Requests',
                            style: TextStyle(
                              color: AppColors.textH,
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        ShowPassedRequestsToggle(
                          isEnabled: _showPassedRequests,
                          onPressed: _toggleShowPassedRequests,
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    if (items.isEmpty)
                      const Padding(
                        padding: EdgeInsets.only(top: 40),
                        child: _FriendRequestsEmptyState(),
                      )
                    else
                      ...items.map(
                        (item) => RequestListItem(
                          key: ValueKey(item.shareId),
                          item: item,
                          isSettling: _settlingShareId == item.shareId,
                          onMarkPaid: () => _markPaid(item),
                        ),
                      ),
                  ],
                ],
              ),
            ),
    );
  }
}

class _FriendHeader extends StatelessWidget {
  const _FriendHeader({
    required this.email,
    required this.balanceCents,
    required this.awaitingConfirmationCents,
    required this.onSettleUp,
    this.isSettling = false,
  });

  final String email;
  final int balanceCents;
  final int awaitingConfirmationCents;
  final VoidCallback onSettleUp;
  final bool isSettling;

  @override
  Widget build(BuildContext context) {
    final positive = balanceCents > 0;
    final negative = balanceCents < 0;
    final amountColor = positive
        ? AppColors.accent
        : negative
            ? AppColors.error
            : AppColors.textH;
    final statusLabel = positive
        ? 'Owed to you'
        : negative
            ? 'You owe'
            : 'Settled up';
    final statusBackground = positive
        ? AppColors.accentSoft
        : negative
            ? AppColors.errorBg
            : AppColors.surfaceMuted;
    final statusForeground = positive
        ? AppColors.accent
        : negative
            ? AppColors.error
            : AppColors.text;
    final statusIcon = positive
        ? Icons.south_west_rounded
        : negative
            ? Icons.north_east_rounded
            : Icons.check_rounded;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.accent, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: AppColors.textH.withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.fromLTRB(10, 6, 12, 6),
                  decoration: BoxDecoration(
                    color: statusBackground,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(statusIcon, size: 14, color: statusForeground),
                      const SizedBox(width: 6),
                      Text(
                        statusLabel,
                        style: TextStyle(
                          color: statusForeground,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.1,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Balance',
                            style: TextStyle(
                              color: AppColors.text.withValues(alpha: 0.85),
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            formatCad(balanceCents.abs()),
                            style: TextStyle(
                              color: amountColor,
                              fontSize: 34,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.8,
                              height: 1.05,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    FilledButton(
                      onPressed: isSettling ? null : onSettleUp,
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.accent,
                        foregroundColor: Colors.white,
                        disabledBackgroundColor:
                            AppColors.accent.withValues(alpha: 0.55),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: isSettling
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text(
                              'Settle up',
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                              ),
                            ),
                    ),
                  ],
                ),
                if (awaitingConfirmationCents > 0) ...[
                  const SizedBox(height: 14),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.pendingBg,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.hourglass_top_rounded,
                          size: 18,
                          color: AppColors.pendingText,
                        ),
                        const SizedBox(width: 8),
                        const Expanded(
                          child: Text(
                            'Awaiting confirmation',
                            style: TextStyle(
                              color: AppColors.pendingText,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Text(
                          formatCad(awaitingConfirmationCents),
                          style: const TextStyle(
                            color: AppColors.pendingText,
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          Container(
            height: 1,
            color: AppColors.border.withValues(alpha: 0.85),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 16),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceMuted,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    Icons.mail_outline_rounded,
                    size: 18,
                    color: AppColors.text.withValues(alpha: 0.9),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Email',
                        style: TextStyle(
                          color: AppColors.text.withValues(alpha: 0.7),
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.2,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        email,
                        style: const TextStyle(
                          color: AppColors.textH,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SettleUpConfirmDialog extends StatelessWidget {
  const _SettleUpConfirmDialog({
    required this.balanceCents,
    required this.friendName,
  });

  final int balanceCents;
  final String friendName;

  @override
  Widget build(BuildContext context) {
    final positive = balanceCents > 0;
    final negative = balanceCents < 0;
    final amountColor = positive
        ? AppColors.accent
        : negative
            ? AppColors.error
            : AppColors.textH;
    final whoOwesWhom = positive
        ? '$friendName owes you'
        : negative
            ? 'You owe $friendName'
            : "You're settled up";

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      backgroundColor: AppColors.surface,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(22, 24, 22, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Settle up?',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.textH,
                fontSize: 20,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              formatCad(balanceCents.abs()),
              textAlign: TextAlign.center,
              style: TextStyle(
                color: amountColor,
                fontSize: 40,
                fontWeight: FontWeight.w800,
                letterSpacing: -1,
                height: 1.05,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              whoOwesWhom,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: amountColor.withValues(alpha: 0.9),
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'This will settle all open requests with $friendName.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.text.withValues(alpha: 0.85),
                fontSize: 14,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 24),
            PrimaryButton(
              label: 'Confirm',
              onPressed: () => Navigator.of(context).pop(true),
            ),
            const SizedBox(height: 10),
            SecondaryButton(
              label: 'Cancel',
              onPressed: () => Navigator.of(context).pop(false),
            ),
          ],
        ),
      ),
    );
  }
}

class _FriendRequestsEmptyState extends StatelessWidget {
  const _FriendRequestsEmptyState();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 56,
          height: 56,
          decoration: const BoxDecoration(
            color: AppColors.surfaceMuted,
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.receipt_long_outlined,
            color: AppColors.text,
            size: 28,
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'No requests yet',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppColors.text,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Shared requests between you and this friend will show up here.',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: AppColors.text.withValues(alpha: 0.7),
            fontSize: 14,
            height: 1.4,
          ),
        ),
      ],
    );
  }
}
