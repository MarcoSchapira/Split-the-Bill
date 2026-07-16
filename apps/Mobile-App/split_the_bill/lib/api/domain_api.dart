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
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/dashboard',
      );
      return Dashboard.fromJson(
        response.data!['dashboard'] as Map<String, dynamic>,
      );
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
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/friends/$friendshipId',
      );
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

  Future<void> removeFriend(String friendshipId) async {
    try {
      await _client.dio.delete<void>('/friends/$friendshipId');
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to remove this friend.');
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

class BillsApi {
  BillsApi(this._client);
  final ApiClient _client;

  Future<List<Bill>> listBills({String? participantId, String? groupId}) async {
    try {
      final queryParameters = <String, dynamic>{};
      if (participantId != null) {
        queryParameters['participantId'] = participantId;
      }
      if (groupId != null) {
        queryParameters['groupId'] = groupId;
      }
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/bills',
        queryParameters: queryParameters.isEmpty ? null : queryParameters,
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
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/bills/$billId',
      );
      return Bill.fromJson(response.data!['bill'] as Map<String, dynamic>);
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to load bill details.');
    }
  }

  Future<Bill> createBill(Map<String, dynamic> input) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/bills',
        data: input,
      );
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

  Future<Bill> settleBill(
    String billId, {
    String? friendUserId,
    String? participantUserId,
  }) async {
    try {
      final queryParameters = <String, dynamic>{};
      if (friendUserId != null) {
        queryParameters['friendUserId'] = friendUserId;
      }
      if (participantUserId != null) {
        queryParameters['participantUserId'] = participantUserId;
      }
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/bills/$billId/settle',
        queryParameters: queryParameters.isEmpty ? null : queryParameters,
      );
      return Bill.fromJson(response.data!['bill'] as Map<String, dynamic>);
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to settle this bill.');
    }
  }

  Future<Bill> unsettleBill(
    String billId, {
    String? friendUserId,
    String? participantUserId,
  }) async {
    try {
      final queryParameters = <String, dynamic>{};
      if (friendUserId != null) {
        queryParameters['friendUserId'] = friendUserId;
      }
      if (participantUserId != null) {
        queryParameters['participantUserId'] = participantUserId;
      }
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/bills/$billId/unsettle',
        queryParameters: queryParameters.isEmpty ? null : queryParameters,
      );
      return Bill.fromJson(response.data!['bill'] as Map<String, dynamic>);
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to undo settlement.');
    }
  }
}

class ReceiptsApi {
  ReceiptsApi(this._client);
  final ApiClient _client;

  Future<ParsedReceipt> parseReceipt(
    Uint8List imageBytes,
    String filename,
  ) async {
    try {
      final formData = FormData.fromMap({
        'image': MultipartFile.fromBytes(imageBytes, filename: filename),
      });
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/receipts/parse',
        data: formData,
        options: Options(receiveTimeout: const Duration(seconds: 60)),
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
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/invitations',
      );
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

  Future<void> cancelFriendInvitation(String invitationId) async {
    try {
      await _client.dio.delete<void>('/friend-invitations/$invitationId');
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to cancel invitation.');
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

  Future<GroupDetail> getGroup(String groupId) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/groups/$groupId',
      );
      return GroupDetail.fromJson(
        response.data!['group'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to load group details.');
    }
  }

  Future<GroupSummary> createGroup({
    required String name,
    required String iconKey,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/groups',
        data: {'name': name, 'iconKey': iconKey},
      );
      return GroupSummary.fromJson(
        response.data!['group'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to create group.');
    }
  }

  Future<GroupSummary> updateGroup(
    String groupId, {
    String? name,
    String? iconKey,
  }) async {
    try {
      final response = await _client.dio.patch<Map<String, dynamic>>(
        '/groups/$groupId',
        data: {
          if (name != null) 'name': name,
          if (iconKey != null) 'iconKey': iconKey,
        },
      );
      return GroupSummary.fromJson(
        response.data!['group'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to update group.');
    }
  }

  Future<void> deleteGroup(String groupId) async {
    try {
      await _client.dio.delete<void>('/groups/$groupId');
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to delete group.');
    }
  }

  Future<GroupDetail> addMember(String groupId, String userId) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/groups/$groupId/members',
        data: {'userId': userId},
      );
      return GroupDetail.fromJson(
        response.data!['group'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to add group member.');
    }
  }

  Future<GroupDetail?> removeMember(String groupId, String userId) async {
    try {
      final response = await _client.dio.delete<Map<String, dynamic>>(
        '/groups/$groupId/members/$userId',
      );
      if (response.statusCode == 204 || response.data == null) {
        return null;
      }
      return GroupDetail.fromJson(
        response.data!['group'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to remove group member.');
    }
  }

  Future<GroupDetail?> leaveGroup(String groupId) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/groups/$groupId/leave',
      );
      if (response.statusCode == 204 || response.data == null) {
        return null;
      }
      return GroupDetail.fromJson(
        response.data!['group'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      _client.throwApiError(e, 'Unable to leave group.');
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
