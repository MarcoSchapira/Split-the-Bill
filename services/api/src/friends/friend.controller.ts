import type { RequestHandler } from "express";
import { z } from "zod";
import { currentUser } from "../auth/currentUser";
import { getFriend, listFriends } from "./friend.service";

const friendshipIdSchema = z.string().uuid();

export const list: RequestHandler = async (req, res) => {
  const friends = await listFriends(currentUser(req).id);
  res.json({ friends });
};

export const detail: RequestHandler = async (req, res) => {
  const friendship = await getFriend(
    currentUser(req).id,
    friendshipIdSchema.parse(req.params.friendshipId),
  );
  res.json({ friendship });
};
