/**
 * Customer-facing language. Staff/Control Center keep technical detail.
 * Never claims FDIC insurance, licensing, or live banking unless established.
 */

export function customerGenericError(): string {
  return "We couldn't complete that request. Please try again shortly.";
}

export function customerBankingPreparing(): { title: string; body: string } {
  return {
    title: "Your banking account is being prepared",
    body: "You can keep going with your profile. Checking details appear once your account is ready.",
  };
}

export function customerVerificationWait(): { title: string; body: string } {
  return {
    title: "Verification in progress",
    body: "We're reviewing your information. You'll be notified when your checking account is ready.",
  };
}

export function customerFinishVerification(): { title: string; body: string } {
  return {
    title: "Finish verification",
    body: "Complete identity verification so we can open your checking account.",
  };
}

export function formatCustomerTxStatus(status: string): string {
  switch (status) {
    case "posted":
    case "completed":
      return "Completed";
    case "pending":
      return "Pending";
    case "processing":
      return "Processing";
    case "failed":
      return "Failed";
    case "reversed":
      return "Reversed";
    case "refunded":
      return "Refunded";
    case "disputed":
      return "Disputed";
    case "canceled":
    case "cancelled":
      return "Canceled";
    case "returned":
      return "Returned";
    default:
      return status.replaceAll("_", " ");
  }
}

export function groupLabelForDate(isoDate: string, now = new Date()): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
