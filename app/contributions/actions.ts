"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

function fieldValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function parseAmountCents(value: string): bigint {
  const normalized = value.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Amount must be a positive dollar value with up to two decimal places.");
  }

  const [dollars, cents = ""] = normalized.split(".");
  const paddedCents = cents.padEnd(2, "0");
  const amountCents = BigInt(dollars) * BigInt(100) + BigInt(paddedCents);

  if (amountCents <= BigInt(0)) {
    throw new Error("Amount must be greater than zero.");
  }

  return amountCents;
}

function parseContributionDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Contribution date is required.");
  }

  return new Date(`${value}T12:00:00-08:00`);
}

export async function addContribution(formData: FormData) {
  const accountId = fieldValue(formData, "accountId");
  const contributionDateValue = fieldValue(formData, "contributionDate");
  const amountValue = fieldValue(formData, "amount");
  const note = fieldValue(formData, "note");

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true }
  });

  if (!account) {
    throw new Error("Select a valid account.");
  }

  const contributionDate = parseContributionDate(contributionDateValue);
  const amountCents = parseAmountCents(amountValue);

  await prisma.contribution.create({
    data: {
      id: `contrib-${contributionDateValue}-${accountId}-${randomUUID()}`,
      account: {
        connect: { id: accountId }
      },
      contributionDate,
      amountCents,
      kind: "contribution",
      note: note || null,
      source: "manual",
      yearBucket: contributionDate.getFullYear()
    }
  });

  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/contributions");
  revalidatePath("/annual-returns");
  redirect("/contributions");
}

export async function deleteContribution(formData: FormData) {
  const contributionId = fieldValue(formData, "contributionId");

  if (!contributionId) {
    throw new Error("Contribution id is required.");
  }

  await prisma.contribution.delete({
    where: { id: contributionId }
  });

  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/contributions");
  revalidatePath("/annual-returns");
  redirect("/contributions");
}
