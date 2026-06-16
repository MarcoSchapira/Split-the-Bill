import type { RequestHandler } from "express";
import { currentUser } from "../auth/currentUser";
import { withUserContext } from "../db/userContext";
import { billIdSchema, billInputSchema, billListQuerySchema, billSettleQuerySchema } from "./bill.types";
import { createBill, deleteBill, listBills, updateBill } from "./bill.service";
import { settleBill } from "./bill-settle.service";

export const create: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const bill = await withUserContext(userId, (tx) =>
    createBill(tx, userId, billInputSchema.parse(req.body)),
  );
  res.status(201).json({ bill });
};

export const list: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const bills = await withUserContext(userId, (tx) =>
    listBills(tx, userId, billListQuerySchema.parse(req.query)),
  );
  res.json({ bills });
};

export const update: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const bill = await withUserContext(userId, (tx) =>
    updateBill(tx, userId, billIdSchema.parse(req.params.billId), billInputSchema.parse(req.body)),
  );
  res.json({ bill });
};

export const remove: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  await withUserContext(userId, (tx) =>
    deleteBill(tx, userId, billIdSchema.parse(req.params.billId)),
  );
  res.status(204).send();
};

export const settle: RequestHandler = async (req, res) => {
  const userId = currentUser(req).id;
  const query = billSettleQuerySchema.parse(req.query);
  const bill = await withUserContext(userId, (tx) =>
    settleBill(tx, userId, billIdSchema.parse(req.params.billId), query.friendUserId),
  );
  res.json({ bill });
};
