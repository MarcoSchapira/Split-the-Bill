import type { RequestHandler } from "express";
import { currentUser } from "../auth/currentUser";
import { billIdSchema, billInputSchema, billListQuerySchema } from "./bill.types";
import { createBill, deleteBill, listBills, updateBill } from "./bill.service";

export const create: RequestHandler = async (req, res) => {
  const bill = await createBill(currentUser(req).id, billInputSchema.parse(req.body));
  res.status(201).json({ bill });
};

export const list: RequestHandler = async (req, res) => {
  const bills = await listBills(currentUser(req).id, billListQuerySchema.parse(req.query));
  res.json({ bills });
};

export const update: RequestHandler = async (req, res) => {
  const bill = await updateBill(
    currentUser(req).id,
    billIdSchema.parse(req.params.billId),
    billInputSchema.parse(req.body),
  );
  res.json({ bill });
};

export const remove: RequestHandler = async (req, res) => {
  await deleteBill(currentUser(req).id, billIdSchema.parse(req.params.billId));
  res.status(204).send();
};
