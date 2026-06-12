import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../api/api_exception.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/format.dart';
import '../../widgets/common_widgets.dart';

class ActivityScreen extends ConsumerStatefulWidget {
  const ActivityScreen({super.key});

  @override
  ConsumerState<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends ConsumerState<ActivityScreen> {
  List<ActivityEvent> _events = [];
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
      final events = await ref.read(activityApiProvider).listActivity();
      if (mounted) setState(() => _events = events);
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Unable to load activity.'));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(dataRefreshProvider, (_, __) => _load());

    if (_isLoading && _events.isEmpty) {
      return const LoadingView(message: 'Loading activity...');
    }

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.accent,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Eyebrow('Timeline'),
          const SizedBox(height: 4),
          const Text('Recent Activity', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
          if (_events.isEmpty)
            const EmptyState(message: 'No activity yet.')
          else
            ..._events.map((event) {
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  title: Text(event.message),
                  subtitle: Text(
                    '${displayName(event.actor)} · ${formatRelativeTime(event.createdAt)}',
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}
