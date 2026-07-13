import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../api/api_exception.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../widgets/bill_list/bill_list.dart';
import '../../widgets/common_widgets.dart';

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
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final friendship =
          await ref.read(friendsApiProvider).getFriendship(widget.friendshipId);
      if (mounted) setState(() => _friendship = friendship);
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Unable to load friend details.'));
    }
  }

  Future<void> _settleAll() async {
    try {
      final settledCount =
          await ref.read(friendsApiProvider).settleFriend(widget.friendshipId);
      notifyDataChanged(ref);
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              settledCount == 0 ? 'Already settled up.' : 'All bills settled up.',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(apiErrorMessage(e, 'Unable to settle up with this friend.'))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(dataRefreshProvider, (_, __) => _load());

    final friendship = _friendship;

    return Scaffold(
      appBar: AppBar(
        title: Text(friendship != null ? displayName(friendship.friend) : 'Friend'),
        actions: [
          TextButton(onPressed: _settleAll, child: const Text('Settle up')),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.accent,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
            if (friendship != null) ...[
              Text(friendship.friend.email, style: const TextStyle(color: AppColors.text)),
              const SizedBox(height: 24),
              Row(
                children: [
                  const Text('Direct bills', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  const Spacer(),
                  CountBadge(count: friendship.bills.length),
                ],
              ),
              const SizedBox(height: 12),
              BillList(bills: friendship.bills),
            ],
          ],
        ),
      ),
    );
  }
}
