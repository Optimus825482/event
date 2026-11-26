// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LinkableStaff, UserDetail } from "@/features/users/queries";

const createUserAction = vi.fn();
const updateUserAction = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/features/users/actions", () => ({
  createUserAction: (input: unknown) => createUserAction(input),
  updateUserAction: (input: unknown) => updateUserAction(input),
}));

import { CreateUserForm } from "@/features/users/components/create-user-form";
import { EditUserForm } from "@/features/users/components/edit-user-form";
import { filterLinkable } from "@/features/users/components/staff-link-field";

const OPTIONS: LinkableStaff[] = [
  { id: "s1", fullName: "Ayşe Yılmaz", sicilNo: "A-100", status: "active", linkedUserId: null, linkedUserName: null },
  { id: "s2", fullName: "Mehmet Kaya", sicilNo: "A-200", status: "active", linkedUserId: "u9", linkedUserName: "Mehmet K." },
  { id: "s3", fullName: "İlker Demir", sicilNo: "B-300", status: "active", linkedUserId: "u1", linkedUserName: "Kullanıcı" },
];

const USER: UserDetail = {
  id: "u1",
  username: "ilker",
  name: "Kullanıcı",
  email: "ilker@example.com",
  role: "admin",
  isActive: true,
  staffId: "s3",
  color: null,
  phone: null,
  position: null,
  createdAt: new Date(0),
  memberships: [],
  permissions: [],
};

beforeEach(() => {
  createUserAction.mockResolvedValue({ ok: true, data: {} });
  updateUserAction.mockResolvedValue({ ok: true, data: {} });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("personel kaydı alanı", () => {
  it("oluşturma formu seçilen personel kimliğini gönderir", async () => {
    const { container } = render(<CreateUserForm staffOptions={OPTIONS} />);
    fill("Kullanıcı adı", "ayse");
    fill("Parola", "uzun-bir-parola-123");
    fireEvent.change(screen.getByLabelText("Rol"), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText("Personel kaydı"), { target: { value: "s1" } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(createUserAction).toHaveBeenCalledTimes(1));
    expect(createUserAction.mock.calls[0]?.[0]).toMatchObject({ username: "ayse", staffId: "s1" });
  });

  it("oluşturma formunda dokunulmazsa 'Bağlı değil' olarak null gider", async () => {
    const { container } = render(<CreateUserForm staffOptions={OPTIONS} />);
    fill("Kullanıcı adı", "ayse");
    fill("Parola", "uzun-bir-parola-123");
    fireEvent.change(screen.getByLabelText("Rol"), { target: { value: "admin" } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(createUserAction).toHaveBeenCalledTimes(1));
    expect(createUserAction.mock.calls[0]?.[0]).toMatchObject({ staffId: null });
  });

  it("düzenleme formu mevcut bağı gösterir; 'Bağlı değil' seçilince null gönderir", async () => {
    const { container } = render(<EditUserForm user={USER} staffOptions={OPTIONS} />);
    const select = screen.getByLabelText("Personel kaydı") as HTMLSelectElement;
    expect(select.value).toBe("s3");
    fireEvent.change(select, { target: { value: "" } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(updateUserAction).toHaveBeenCalledTimes(1));
    expect(updateUserAction.mock.calls[0]?.[0]).toMatchObject({ id: "u1", staffId: null });
  });

  it("düzenleme formu başka personeli seçince kimliğini gönderir", async () => {
    const { container } = render(<EditUserForm user={USER} staffOptions={OPTIONS} />);
    fireEvent.change(screen.getByLabelText("Personel kaydı"), { target: { value: "s1" } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(updateUserAction).toHaveBeenCalledTimes(1));
    expect(updateUserAction.mock.calls[0]?.[0]).toMatchObject({ staffId: "s1" });
  });

  it("başka hesaba bağlı kayıt seçilemez; 'Bağlı değil' seçeneği vardır", () => {
    render(<EditUserForm user={USER} staffOptions={OPTIONS} />);
    const options = Array.from((screen.getByLabelText("Personel kaydı") as HTMLSelectElement).options);
    expect(options[0]?.textContent).toBe("Bağlı değil");
    expect(options.find((o) => o.value === "s2")?.disabled).toBe(true);
    expect(options.find((o) => o.value === "s3")?.disabled).toBe(false);
  });

  it("arama ad ve sicil no ile süzer; seçili kayıt listede kalır", () => {
    expect(filterLinkable(OPTIONS, "ayşe", null).map((o) => o.id)).toEqual(["s1"]);
    expect(filterLinkable(OPTIONS, "b-300", null).map((o) => o.id)).toEqual(["s3"]);
    expect(filterLinkable(OPTIONS, "ayşe", "s2").map((o) => o.id)).toEqual(["s1", "s2"]);
    expect(filterLinkable(OPTIONS, "  ", null)).toHaveLength(3);
    // Türkçe büyük/küçük harf: "İ" → "i".
    expect(filterLinkable(OPTIONS, "ilker", null).map((o) => o.id)).toEqual(["s3"]);
  });
});
