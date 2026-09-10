"use server";

import { revalidatePath } from "next/cache";
import {
  ApiError,
  submitProfessionalApplication,
  withdrawProfessionalApplication,
  type ProfessionalApplicationInput,
} from "@repo/data";

/**
 * Applying, and changing your mind.
 *
 * Both return a message rather than throwing. The form is the only thing the
 * applicant can see, so a failure has to arrive somewhere they are already
 * looking — an error boundary here would replace the page they had just filled
 * in, and with it everything they typed.
 */

export interface ApplicationResult {
  error?: string;
}

export async function submitApplicationAction(
  input: ProfessionalApplicationInput,
): Promise<ApplicationResult> {
  try {
    await submitProfessionalApplication(input);
  } catch (error) {
    return { error: messageFor(error, "We could not send your application just now.") };
  }

  revalidatePath("/account/become-a-professional");
  return {};
}

export async function withdrawApplicationAction(): Promise<ApplicationResult> {
  try {
    await withdrawProfessionalApplication();
  } catch (error) {
    return { error: messageFor(error, "We could not withdraw your application just now.") };
  }

  revalidatePath("/account/become-a-professional");
  return {};
}

function messageFor(error: unknown, fallback: string): string {
  // The API writes these for the person who caused them — "Your application is
  // already with our team" — so they are better than anything invented here.
  if (error instanceof ApiError && error.isClientError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
