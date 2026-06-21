import 'dart:typed_data';

import 'package:dio/dio.dart';
import '../models/models.dart';
import '../models/receipt.dart';
import 'api_client.dart';

class DashboardApi {
  DashboardApi(this._client);
  final ApiClient _client;

  Future<Dashboard> getDashboard() async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>('/dashboard');
      return Dashboard.fromJson(response.data!['dashboard'] as Map<String, dynamic>);
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to load dashboard.');
    }
  }
}

class FriendsApi {
  FriendsApi(this._client);
  final ApiClient _client;

  Future<List<FriendshipSummary>> listFriends() async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>('/friends');
      return (response.data!['friends'] as List<dynamic>)
          .map((e) => FriendshipSummary.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to load friends.');
    }
  }

  Future<FriendshipDetail> getFriendship(String friendshipId) async {
    try {
      final response =
          await _client.dio.get<Map<String, dynamic>>('/friends/$friendshipId');
      return FriendshipDetail.fromJson(
        response.data!['friendship'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to load friend details.');
    }
  }

  Future<int> settleFriend(String friendshipId) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/friends/$friendshipId/settle',
      );
      return response.data!['settledCount'] as int;
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to settle up with this friend.');
    }
  }

  Future<FriendInvitation> inviteFriend(String email) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/friend-invitations',
        data: {'email': email},
      );
      return FriendInvitation.fromJson(
        response.data!['invitation'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to send invitation.');
    }
  }
}

class GroupsApi {
  GroupsApi(this._client);
  final ApiClient _client;

  Future<List<GroupSummary>> listGroups() async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>('/groups');
      return (response.data!['groups'] as List<dynamic>)
          .map((e) => GroupSummary.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to load groups.');
    }
  }

  Future<GroupSummary> createGroup(String name) async {
    try {
      final response =
          await _client.dio.post<Map<String, dynamic>>('/groups', data: {'name': name});
      return GroupSummary.fromJson(response.data!['group'] as Map<String, dynamic>);
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to create group.');
    }
  }

  Future<GroupDetail> getGroup(String groupId) async {
    try {
      final response =
          await _client.dio.get<Map<String, dynamic>>('/groups/$groupId');
      return GroupDetail.fromJson(response.data!['group'] as Map<String, dynamic>);
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to load group.');
    }
  }

  Future<GroupInvitation> inviteGroupMember(String groupId, String email) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/groups/$groupId/invitations',
        data: {'email': email},
      );
      return GroupInvitation.fromJson(
        response.data!['invitation'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to send invitation.');
    }
  }
}

class BillsApi {
  BillsApi(this._client);
  final ApiClient _client;

  Future<List<Bill>> listBills({
    TargetType? targetType,
    String? targetId,
    String? participantId,
  }) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/bills',
        queryParameters: {
          if (targetType != null) 'targetType': targetType.name,
          if (targetId != null) 'targetId': targetId,
          if (participantId != null) 'participantId': participantId,
        },
      );
      return (response.data!['bills'] as List<dynamic>)
          .map((e) => Bill.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to load bills.');
    }
  }

  Future<Bill> getBill(String billId) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>('/bills/$billId');
      return Bill.fromJson(response.data!['bill'] as Map<String, dynamic>);
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to load bill details.');
    }
  }

  Future<Bill> createBill(Map<String, dynamic> input) async {
    try {
      final response =
          await _client.dio.post<Map<String, dynamic>>('/bills', data: input);
      return Bill.fromJson(response.data!['bill'] as Map<String, dynamic>);
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to create bill.');
    }
  }

  Future<Bill> updateBill(String billId, Map<String, dynamic> input) async {
    try {
      final response = await _client.dio.patch<Map<String, dynamic>>(
        '/bills/$billId',
        data: input,
      );
      return Bill.fromJson(response.data!['bill'] as Map<String, dynamic>);
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to update bill.');
    }
  }

  Future<void> deleteBill(String billId) async {
    try {
      await _client.dio.delete('/bills/$billId');
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to delete bill.');
    }
  }

  Future<Bill> settleBill(String billId, {String? friendUserId}) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/bills/$billId/settle',
        queryParameters: {
          if (friendUserId != null) 'friendUserId': friendUserId,
        },
      );
      return Bill.fromJson(response.data!['bill'] as Map<String, dynamic>);
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to settle this bill.');
    }
  }
}

class ReceiptsApi {
  ReceiptsApi(this._client);
  final ApiClient _client;

  Future<ParsedReceipt> parseReceipt(Uint8List imageBytes, String filename) async {
    try {
      final formData = FormData.fromMap({
        'image': MultipartFile.fromBytes(
          imageBytes,
          filename: filename,
        ),
      });
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/receipts/parse',
        data: formData,
        options: Options(
          receiveTimeout: const Duration(seconds: 60),
        ),
      );
      return ParsedReceipt.fromJson(
        response.data!['receipt'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to parse receipt.');
    }
  }
}

class InvitationsApi {
  InvitationsApi(this._client);
  final ApiClient _client;

  Future<Invitations> getInvitations() async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>('/invitations');
      return Invitations.fromJson(response.data!);
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to load invitations.');
    }
  }

  Future<FriendInvitation> answerFriendInvitation(
    String invitationId,
    String decision,
  ) async {
    try {
      final response = await _client.dio.patch<Map<String, dynamic>>(
        '/friend-invitations/$invitationId',
        data: {'decision': decision},
      );
      return FriendInvitation.fromJson(
        response.data!['invitation'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to update invitation.');
    }
  }

  Future<GroupInvitation> answerGroupInvitation(
    String invitationId,
    String decision,
  ) async {
    try {
      final response = await _client.dio.patch<Map<String, dynamic>>(
        '/group-invitations/$invitationId',
        data: {'decision': decision},
      );
      return GroupInvitation.fromJson(
        response.data!['invitation'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to update invitation.');
    }
  }
}

class ActivityApi {
  ActivityApi(this._client);
  final ApiClient _client;

  Future<List<ActivityEvent>> listActivity() async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>('/activity');
      return (response.data!['activity'] as List<dynamic>)
          .map((e) => ActivityEvent.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to load activity.');
    }
  }

  Future<void> deleteActivity(String eventId) async {
    try {
      await _client.dio.delete<void>('/activity/$eventId');
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to remove activity.');
    }
  }
}
