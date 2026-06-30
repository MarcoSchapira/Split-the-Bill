import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../api/api_exception.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../theme/app_colors.dart';
import '../../utils/activity_navigation.dart';
import '../../utils/format.dart';
import '../../widgets/common_widgets.dart';

class ActivityScreen extends ConsumerStatefulWidget {
  const ActivityScreen({super.key});

  @override
  ConsumerState<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends ConsumerState<ActivityScreen> {
  List<ActivityEvent> _events = [];
  final Set<String> _deletingIds = {};
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

  Future<void> _deleteActivity(String eventId) async {
    setState(() => _error = null);
    setState(() => _deletingIds.add(eventId));

    try {
      await ref.read(activityApiProvider).deleteActivity(eventId);
      if (mounted) {
        setState(() => _events = _events.where((event) => event.id != eventId).toList());
      }
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Unable to remove activity.'));
    } finally {
      if (mounted) setState(() => _deletingIds.remove(eventId));
    }
  }

  void _openActivity(ActivityEvent event) {
    final route = activityRoute(event);
    if (route == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No destination for this activity item.')),
      );
      return;
    }
    context.push(route);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(dataRefreshProvider, (_, __) => _load());

    return Scaffold(
      appBar: AppBar(title: const Text('Activity')),
      body: _isLoading && _events.isEmpty
          ? const LoadingView(message: 'Loading activity...')
          : RefreshIndicator(
        onRefresh: _load,
        color: AppColors.accent,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text('Recent Activity', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            if (_error != null) ...[ErrorBanner(message: _error!), const SizedBox(height: 12)],
            if (_events.isEmpty)
              const EmptyState(message: 'No activity yet.')
            else
              ..._events.map((event) {
                final deleting = _deletingIds.contains(event.id);
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(event.message),
                    subtitle: Text(
                      '${displayName(event.actor)} · ${formatRelativeTime(event.createdAt)}',
                    ),
                    onTap: () => _openActivity(event),
                    trailing: IconButton(
                      tooltip: 'Remove activity',
                      icon: deleting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.delete_outline),
                      onPressed: deleting ? null : () => _deleteActivity(event.id),
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}
