"use server";

import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/action";
import { addNote, addTag, deleteNote, removeTag, updateNote } from "./notes-service";
import {
  addNoteInput,
  createCustomerInput,
  customerIdInput,
  noteIdInput,
  setBlacklistInput,
  tagInput,
  updateCustomerInput,
  updateNoteInput,
} from "./schemas";
import { createCustomer, deleteCustomer, setBlacklist, updateCustomer } from "./service";

// Bu dosyadaki her dışa aktarım defineAction(...) sonucu olmalıdır.

function refresh(customerId?: string): void {
  revalidatePath("/customers");
  revalidatePath("/guests");
  if (customerId) revalidatePath(`/customers/${customerId}`);
}

export const createCustomerAction = defineAction({
  module: "customers",
  verb: "create",
  input: createCustomerInput,
  handler: async ({ actor, input, db }) => {
    const result = await createCustomer(db, actor, input);
    refresh();
    return result;
  },
});

export const updateCustomerAction = defineAction({
  module: "customers",
  verb: "edit",
  input: updateCustomerInput,
  handler: async ({ actor, input, db }) => {
    const result = await updateCustomer(db, actor, input);
    refresh(result.id);
    return result;
  },
});

export const setBlacklistAction = defineAction({
  module: "customers",
  verb: "edit",
  input: setBlacklistInput,
  handler: async ({ actor, input, db }) => {
    const result = await setBlacklist(db, actor, input);
    refresh(result.id);
    return result;
  },
});

export const deleteCustomerAction = defineAction({
  module: "customers",
  verb: "delete",
  input: customerIdInput,
  handler: async ({ actor, input, db }) => {
    const result = await deleteCustomer(db, actor, input);
    refresh();
    return result;
  },
});

export const addTagAction = defineAction({
  module: "customers",
  verb: "edit",
  input: tagInput,
  handler: async ({ actor, input, db }) => {
    const result = await addTag(db, actor, input);
    refresh(result.customerId);
    return result;
  },
});

export const removeTagAction = defineAction({
  module: "customers",
  verb: "edit",
  input: tagInput,
  handler: async ({ actor, input, db }) => {
    const result = await removeTag(db, actor, input);
    refresh(result.customerId);
    return result;
  },
});

export const addNoteAction = defineAction({
  module: "customers",
  verb: "edit",
  input: addNoteInput,
  handler: async ({ actor, input, db }) => {
    const result = await addNote(db, actor, input);
    refresh(input.customerId);
    return result;
  },
});

export const updateNoteAction = defineAction({
  module: "customers",
  verb: "edit",
  input: updateNoteInput,
  handler: async ({ actor, input, db }) => {
    const result = await updateNote(db, actor, input);
    refresh();
    return result;
  },
});

export const deleteNoteAction = defineAction({
  module: "customers",
  verb: "edit",
  input: noteIdInput,
  handler: async ({ actor, input, db }) => {
    const result = await deleteNote(db, actor, input);
    refresh();
    return result;
  },
});
