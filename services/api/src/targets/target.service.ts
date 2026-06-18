import type { PrismaTransaction } from "../db/userContext";
import { assertParticipantsAllowed, sortedParticipantKey } from "../bills/participants";
import type { ResolveTargetInput } from "./target.types";

export async function resolveBillTarget(
  tx: PrismaTransaction,
  actingUserId: string,
  input: ResolveTargetInput,
) {
  const participantKey = sortedParticipantKey(input.participantIds);
  await assertParticipantsAllowed(tx, actingUserId, participantKey);

  return {
    participantIds: participantKey,
    deprecated: true,
  };
}
