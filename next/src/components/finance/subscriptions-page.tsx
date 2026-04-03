"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { Fab } from "@/components/ui/fab";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  type SubscriptionAnalytics,
  type SubscriptionData,
  addSubscription,
  updateSubscription,
  deleteSubscription,
  getSubscriptionAnalytics,
} from "@/actions/finance/subscriptions";
import { SubscriptionSummary } from "./subscription-summary";
import { SubscriptionList } from "./subscription-list";
import { SubscriptionDialog } from "./subscription-dialog";

interface SubscriptionsPageProps {
  initialAnalytics: SubscriptionAnalytics;
}

export function SubscriptionsPage({ initialAnalytics }: SubscriptionsPageProps) {
  const t = useTranslations("subscriptions");
  const tc = useTranslations("common");
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [isPending, startTransition] = useTransition();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<SubscriptionData | null>(null);

  // Confirm delete
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionData | null>(null);

  async function reload() {
    const fresh = await getSubscriptionAnalytics();
    setAnalytics(fresh);
  }

  function handleAdd() {
    setEditingSub(null);
    setDialogOpen(true);
  }

  function handleEdit(sub: SubscriptionData) {
    setEditingSub(sub);
    setDialogOpen(true);
  }

  function handleDeleteRequest(sub: SubscriptionData) {
    setDeleteTarget(sub);
  }

  function handleToggleActive(sub: SubscriptionData) {
    startTransition(async () => {
      try {
        await updateSubscription(sub.id, { isActive: !sub.isActive });
        await reload();
        toast.success(t("saved"));
      } catch {
        toast.error("Error");
      }
    });
  }

  async function handleSave(data: Omit<SubscriptionData, "id">) {
    startTransition(async () => {
      try {
        if (editingSub) {
          await updateSubscription(editingSub.id, data);
        } else {
          await addSubscription({
            name: data.name,
            provider: data.provider,
            amount: data.amount,
            currency: data.currency,
            billingCycle: data.billingCycle,
            nextBilling: data.nextBilling ?? undefined,
            category: data.category ?? undefined,
            isActive: data.isActive,
            url: data.url ?? undefined,
            notes: data.notes ?? undefined,
          });
        }
        await reload();
        setDialogOpen(false);
        setEditingSub(null);
        toast.success(t("saved"));
      } catch {
        toast.error("Error");
      }
    });
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        await deleteSubscription(deleteTarget.id);
        await reload();
        setDeleteTarget(null);
        toast.success(t("deleted"));
      } catch {
        toast.error("Error");
      }
    });
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="sr-only">{t("title")}</h1>
        <Button onClick={handleAdd} size="sm" className="hidden sm:inline-flex gap-1.5 ml-auto">
          <PlusIcon className="size-4" />
          {t("add")}
        </Button>
      </div>

      <SubscriptionSummary analytics={analytics} />

      <SubscriptionList
        subscriptions={analytics.subscriptions}
        isPending={isPending}
        onEdit={handleEdit}
        onDelete={handleDeleteRequest}
        onToggleActive={handleToggleActive}
      />

      <Fab aria-label={t("add")} onClick={handleAdd} />

      <SubscriptionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        subscription={editingSub}
        onSave={handleSave}
        isPending={isPending}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={t("delete_confirm")}
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        onConfirm={handleConfirmDelete}
        destructive
      />
    </div>
  );
}
