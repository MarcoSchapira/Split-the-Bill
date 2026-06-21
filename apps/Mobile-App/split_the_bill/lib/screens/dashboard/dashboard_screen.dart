import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../api/api_exception.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../widgets/common_widgets.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  Dashboard? _dashboard;
  String? _error;
  bool _isLoading = true;

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
      final dashboard = await ref.read(dashboardApiProvider).getDashboard();
      if (mounted) {
        setState(() => _dashboard = dashboard);
      }
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Unable to load dashboard.'));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(dataRefreshProvider, (_, __) => _load());

    if (_isLoading && _dashboard == null) {
      return const LoadingView(message: 'Loading balances...');
    }

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppColors.accent,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
          children: [
          const Text('Dashboard', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          const Text('Keep track of every shared balance in one place.'),
          const SizedBox(height: 16),
          if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
          if (_dashboard != null) ...[
            Row(
              children: [
                Expanded(
                  child: SummaryCard(
                    label: 'You are owed',
                    amount: formatCad(_dashboard!.totalOwedToYouCents),
                    positive: true,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: SummaryCard(
                    label: 'You owe',
                    amount: formatCad(_dashboard!.totalYouOweCents),
                    negative: true,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            SummaryCard(
              label: 'Net balance',
              amount: formatCad(_dashboard!.netBalanceCents),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                const Text('People', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                const Spacer(),
                CountBadge(count: _dashboard!.balances.length),
              ],
            ),
            const SizedBox(height: 12),
            if (_dashboard!.balances.isEmpty)
              const EmptyState(message: 'No balances yet. Capture a receipt or invite a friend.')
            else
              ..._dashboard!.balances.map((balance) {
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(displayName(balance.user)),
                    subtitle: Text(balance.relationship),
                    trailing: BalanceChip(cents: balance.balanceCents),
                    onTap: balance.friendshipId != null
                        ? () => context.push('/friends/${balance.friendshipId}')
                        : null,
                  ),
                );
              }),
          ],
        ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/dashboard/capture'),
        backgroundColor: AppColors.accent,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.camera_alt),
        label: const Text('Capture'),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.startFloat,
    );
  }
}
