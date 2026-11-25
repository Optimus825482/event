// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createEventAction, updateEventAction } = vi.hoisted(() => ({
  createEventAction: vi.fn(),
  updateEventAction: vi.fn(),
}));

vi.mock("@/features/events/actions", () => ({ createEventAction, updateEventAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

import { EventForm, type EventFormValues } from "@/features/events/components/event-form";

const base: EventFormValues = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Gece",
  description: null,
  startsAt: "2030-06-20T17:00:00.000Z",
  endsAt: null,
  eventType: null,
  reservationEnabled: true,
};

async function submit(label: string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
  await waitFor(() => expect(createEventAction.mock.calls.length + updateEventAction.mock.calls.length).toBe(1));
}

describe("EventForm sanatçı alanı", () => {
  beforeEach(() => {
    createEventAction.mockResolvedValue({ ok: true, data: { id: base.id } });
    updateEventAction.mockResolvedValue({ ok: true, data: { id: base.id } });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("düzenlemede mevcut sanatçı gönderilir; alan boşaltılırsa boş metin gider (silme)", async () => {
    render(<EventForm event={{ ...base, artistName: "Sezen Aksu" }} />);
    const input = screen.getByLabelText("Sanatçı") as HTMLInputElement;
    expect(input.value).toBe("Sezen Aksu");
    fireEvent.change(input, { target: { value: "" } });
    await submit("Kaydet");
    expect(updateEventAction.mock.calls[0]?.[0]).toMatchObject({ id: base.id, artistName: "" });
  });

  it("düzenlemede sanatçı değiştirilince yeni değer gönderilir", async () => {
    render(<EventForm event={{ ...base, artistName: null }} />);
    fireEvent.change(screen.getByLabelText("Sanatçı"), { target: { value: "Tarkan" } });
    await submit("Kaydet");
    expect(updateEventAction.mock.calls[0]?.[0]).toMatchObject({ artistName: "Tarkan" });
  });

  it("çağıran sanatçıyı bilmiyorsa (undefined) alan gönderilmez", async () => {
    render(<EventForm event={base} />);
    await submit("Kaydet");
    expect(updateEventAction.mock.calls[0]?.[0].artistName).toBeUndefined();
  });

  it("oluşturmada sanatçı metin olarak gider", async () => {
    render(<EventForm />);
    fireEvent.change(screen.getByLabelText("Etkinlik adı"), { target: { value: "Yeni" } });
    fireEvent.change(screen.getByLabelText("Sanatçı"), { target: { value: "Tarkan" } });
    await submit("Etkinlik oluştur");
    expect(createEventAction.mock.calls[0]?.[0]).toMatchObject({ name: "Yeni", artistName: "Tarkan" });
  });
});
