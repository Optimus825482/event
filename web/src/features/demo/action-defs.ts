import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/action";
import { demoConfirmSchema, setSalesDemoSchema } from "./schemas";
import { deleteDemoData, resetDemoData, setSalesDemoEnabled } from "./service";

export const setSalesDemoDef = {
  module: "settings" as const,
  verb: "edit" as const,
  input: setSalesDemoSchema,
  handler: async ({ actor, input, db }: Parameters<Parameters<typeof defineAction<typeof setSalesDemoSchema, Awaited<ReturnType<typeof setSalesDemoEnabled>>>>[0]["handler"]>[0]) => {
    const status = await setSalesDemoEnabled(db, actor, input);
    revalidatePath("/admin/settings");
    revalidatePath("/events");
    revalidatePath("/dashboard");
    return status;
  },
};

export const resetDemoDataDef = {
  module: "settings" as const,
  verb: "edit" as const,
  input: demoConfirmSchema,
  handler: async ({ actor, db }: Parameters<Parameters<typeof defineAction<typeof demoConfirmSchema, Awaited<ReturnType<typeof resetDemoData>>>>[0]["handler"]>[0]) => {
    const status = await resetDemoData(db, actor);
    revalidatePath("/admin/settings");
    revalidatePath("/events");
    revalidatePath("/dashboard");
    return status;
  },
};

export const deleteDemoDataDef = {
  module: "settings" as const,
  verb: "edit" as const,
  input: demoConfirmSchema,
  handler: async ({ actor, db }: Parameters<Parameters<typeof defineAction<typeof demoConfirmSchema, Awaited<ReturnType<typeof deleteDemoData>>>>[0]["handler"]>[0]) => {
    const status = await deleteDemoData(db, actor);
    revalidatePath("/admin/settings");
    revalidatePath("/events");
    revalidatePath("/dashboard");
    return status;
  },
};
