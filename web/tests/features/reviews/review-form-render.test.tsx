// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewForm } from "@/features/reviews/components/review-form";
import type { ReviewView } from "@/features/reviews/queries";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/features/reviews/actions", () => ({
  saveReviewAction: vi.fn(),
  saveShortReviewAction: vi.fn(),
  completeReviewAction: vi.fn(),
}));

const IDS = { eventId: "11111111-1111-4111-8111-111111111111", staffId: "22222222-2222-4222-8222-222222222222" };

function fullReview(over: Partial<ReviewView> = {}): ReviewView {
  return {
    id: "r1",
    formKind: "full",
    overallRating: null,
    score: 0,
    band: "bad",
    ratings: {
      communication: null,
      punctuality: null,
      teamwork: null,
      customerService: null,
      technicalSkills: null,
      initiative: null,
      appearance: null,
      stressManagement: null,
    },
    strengths: [],
    improvements: [],
    recommendedTrainings: [],
    comment: null,
    privateNotes: null,
    nextEventNotes: null,
    isCompleted: false,
    updatedAt: new Date().toISOString(),
    ...over,
  };
}

const switchLink = () => screen.getByRole("button", { name: "Kısa forma geç" });

afterEach(cleanup);

describe("form türü değişimi onayı", () => {
  it("boş ayrıntılı formda onay sorulmadan kısa forma geçilir", () => {
    render(<ReviewForm {...IDS} review={fullReview()} />);
    fireEvent.click(switchLink());
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByText("Kısa değerlendirme")).toBeInTheDocument();
  });

  it("yalnızca kayıtlı 'Güçlü yönler' doluysa onay penceresi açılır ve geçiş bekler", () => {
    render(<ReviewForm {...IDS} review={fullReview({ strengths: ["Dakik"] })} />);
    fireEvent.click(switchLink());
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Ayrıntılı değerlendirme")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Devam et" }));
    expect(screen.getByText("Kısa değerlendirme")).toBeInTheDocument();
  });

  it("kullanıcının yazdığı 'Güçlü yönler' metni de onay gerektirir", () => {
    render(<ReviewForm {...IDS} review={fullReview()} />);
    fireEvent.change(screen.getByLabelText("Güçlü yönler"), { target: { value: "Güler yüzlü" } });
    fireEvent.click(switchLink());
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("kayıtlı özel not kısa kayıtta korunur: onay gerekmez; yazılıp kaydedilmemiş özel not onay ister", () => {
    const { unmount } = render(<ReviewForm {...IDS} review={fullReview({ privateNotes: "Gizli" })} />);
    fireEvent.click(switchLink());
    expect(screen.queryByRole("alertdialog")).toBeNull();
    unmount();
    render(<ReviewForm {...IDS} review={fullReview({ privateNotes: "Gizli" })} />);
    fireEvent.change(screen.getByLabelText("Özel notlar"), { target: { value: "Gizli, değişti" } });
    fireEvent.click(switchLink());
    expect(screen.getByRole("alertdialog")).toHaveTextContent("kaydedilmemiş özel not");
    cleanup();
    render(<ReviewForm {...IDS} review={fullReview({ comment: "İyi" })} />);
    fireEvent.click(switchLink());
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
