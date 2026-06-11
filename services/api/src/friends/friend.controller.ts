import type { RequestHandler } from "express";
import { z } from "zod";
import { currentUser } from "../auth/currentUser";
import { withUserContext } from "../db/userContext";
import { getFriend, listFriends } from "./friend.service";

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
