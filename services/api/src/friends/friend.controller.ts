import type { RequestHandler } from "express";
import { z } from "zod";
import { currentUser } from "../auth/currentUser";
import { withUserContext } from "../db/userContext";
import { getFriend, listFriends, removeFriend } from "./friend.service";
import { settleFriend } from "../bills/bill-settle.service";

const friendshipIdSchema = z.string().uuid();

export const list: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const friends = await withUserContext(userId, (tx) => listFriends(tx, userId));
  res.json({ friends });
};

export const detail: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const friendship = await withUserContext(userId, (tx) =>
    getFriend(tx, userId, friendshipIdSchema.parse(req.params.friendshipId)),
  );
  res.json({ friendship });
};

export const settle: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const result = await withUserContext(userId, (tx) =>
    settleFriend(tx, userId, friendshipIdSchema.parse(req.params.friendshipId)),
  );
  res.json(result);
};

export const remove: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  await withUserContext(userId, (tx) =>
    removeFriend(tx, userId, friendshipIdSchema.parse(req.params.friendshipId)),
  );
  res.status(204).send();
};
