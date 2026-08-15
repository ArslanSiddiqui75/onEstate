"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  CalendarDays,
  Clock,
  ImagePlus,
  Link2,
  ListOrdered,
  PenLine,
  Plug,
  PlugZap,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type {
  Listing,
  Market,
  SocialAccount,
  SocialMediaItem,
  SocialPlatform,
  SocialPost,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsBar,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PLATFORM_HINT,
  PLATFORM_LABEL,
  SOCIAL_PLATFORMS,
  fileToSocialMedia,
  formatBytes,
  uploadSocialMediaFile,
} from "@/lib/social/media";
import { cn, formatDate } from "@/lib/utils";

type QueueFilter = "all" | "draft" | "scheduled" | "published" | "failed";
type PlannerListing = Pick<Listing, "id" | "title" | "description" | "imageUrl" | "city" | "price" | "address" | "beds" | "baths" | "sqft">;

type OAuthCandidate = {
  id: string;
  displayName: string;
  handle: string;
  kind: string;
};

const PLATFORM_PERMISSIONS: Record<SocialPlatform, string[]> = {
  instagram: [
    "Publish content to your professional account",
    "Read account insights",
    "Manage comments on your media",
  ],
  facebook: [
    "Create and manage posts on pages you manage",
    "Read Page insights",
    "Manage comments and messages",
  ],
  linkedin: [
    "Share posts as your organization or profile",
    "Read basic organization information",
    "Manage comments on your posts",
  ],
  x: [
    "Post Tweets on your behalf",
    "Read your profile information",
    "See accounts you follow",
  ],
};

function oauthCandidates(
  platform: SocialPlatform,
  orgName: string,
): OAuthCandidate[] {
  const slug = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18) || "workspace";
  switch (platform) {
    case "instagram":
      return [
        {
          id: "ig_biz",
          displayName: orgName,
          handle: `@${slug}`,
          kind: "Professional account",
        },
      ];
    case "facebook":
      return [
        {
          id: "fb_page",
          displayName: `${orgName}`,
          handle: `facebook.com/${slug}`,
          kind: "Page",
        },
        {
          id: "fb_page_sales",
          displayName: `${orgName} Sales`,
          handle: `facebook.com/${slug}sales`,
          kind: "Page",
        },
      ];
    case "linkedin":
      return [
        {
          id: "li_company",
          displayName: orgName,
          handle: `linkedin.com/company/${slug}`,
          kind: "Company page",
        },
      ];
    case "x":
      return [
        {
          id: "x_profile",
          displayName: orgName.replace(/\s+/g, ""),
          handle: `@${slug}`,
          kind: "Profile",
        },
      ];
  }
}

export type SocialPlannerProps = {
  posts: SocialPost[];
  accounts: SocialAccount[];
  listings: PlannerListing[];
  orgName: string;
  market: Market;
  canEdit: boolean;
  planHint?: string;
  /** True for Supabase-backed orgs — enables real OAuth connect + real publishing. */
  live?: boolean;
  /**
   * Returns the current Supabase auth Bearer token. Required in live mode so
   * media files can be uploaded to Supabase Storage instead of being stored as
   * base64 blobs in the database (which causes browser/laptop freezes).
   */
  getAuthToken?: () => Promise<string | null>;
  onPublishNow?: (postId: string) => Promise<{ ok: boolean; message: string }>;
  onUpsertAccount: (
    account: Omit<SocialAccount, "id" | "orgId"> & { id?: string },
  ) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
  onCreate: (
    post: Omit<SocialPost, "id" | "createdAt" | "orgId">,
  ) => Promise<string | undefined | void>;
  onUpdate: (
    id: string,
    patch: Partial<
      Pick<
        SocialPost,
        | "caption"
        | "status"
        | "scheduledFor"
        | "publishedAt"
        | "accountIds"
        | "media"
        | "linkUrl"
        | "listingId"
      >
    >,
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

function toLocalInputValue(iso?: string) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(value: string) {
  return new Date(value).toISOString();
}

function dayKey(day: Date) {
  return format(day, "yyyy-MM-dd");
}

function postDay(post: SocialPost) {
  if (post.scheduledFor) return startOfDay(parseISO(post.scheduledFor));
  if (post.publishedAt) return startOfDay(parseISO(post.publishedAt));
  return startOfDay(parseISO(post.createdAt));
}

function statusTone(
  status: SocialPost["status"],
): "neutral" | "success" | "warning" | "danger" | "accent" {
  if (status === "published") return "success";
  if (status === "scheduled") return "warning";
  if (status === "failed") return "danger";
  return "neutral";
}

function postAccounts(post: SocialPost, accounts: SocialAccount[]) {
  if (post.accountIds?.length) {
    return accounts.filter((a) => post.accountIds.includes(a.id));
  }
  if (post.channel) {
    return accounts.filter((a) => a.platform === post.channel);
  }
  return [];
}

export function SocialPlanner({
  posts,
  accounts,
  listings,
  orgName,
  market,
  canEdit,
  planHint,
  live = false,
  getAuthToken,
  onPublishNow,
  onUpsertAccount,
  onDeleteAccount,
  onCreate,
  onUpdate,
  onDelete,
}: SocialPlannerProps) {
  const weekStartsOn = market === "uk" ? 1 : 0;
  const connected = useMemo(
    () => accounts.filter((a) => a.status === "connected"),
    [accounts],
  );
  const [tab, setTab] = useState(
    connected.length === 0 && canEdit ? "accounts" : "calendar",
  );
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [caption, setCaption] = useState("");
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [media, setMedia] = useState<SocialMediaItem[]>([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [listingId, setListingId] = useState("__none");
  const [scheduleAt, setScheduleAt] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setScheduleAt(toLocalInputValue());
  }, []);

  useEffect(() => {
    setAccountIds((prev) => {
      const stillConnected = prev.filter((id) =>
        connected.some((a) => a.id === id),
      );
      const target =
        stillConnected.length > 0
          ? stillConnected
          : connected.slice(0, 1).map((a) => a.id);

      if (
        prev.length === target.length &&
        prev.every((id, idx) => id === target[idx])
      ) {
        return prev;
      }
      return target;
    });
  }, [connected]);

  const monthAnchor = useMemo(() => new Date(), []);
  const weekdayLabels = useMemo(() => {
    const start = startOfWeek(monthAnchor, { weekStartsOn });
    return eachDayOfInterval({
      start,
      end: endOfWeek(monthAnchor, { weekStartsOn }),
    }).map((d) => format(d, "EEE"));
  }, [monthAnchor, weekStartsOn]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(monthAnchor);
    const monthEnd = endOfMonth(monthAnchor);
    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn }),
      end: endOfWeek(monthEnd, { weekStartsOn }),
    });
  }, [monthAnchor, weekStartsOn]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, SocialPost[]>();
    for (const day of calendarDays) map.set(dayKey(day), []);
    for (const post of posts) {
      const key = dayKey(postDay(post));
      map.get(key)?.push(post);
    }
    for (const list of map.values()) {
      list.sort((a, b) =>
        (a.scheduledFor || a.createdAt).localeCompare(
          b.scheduledFor || b.createdAt,
        ),
      );
    }
    return map;
  }, [posts, calendarDays]);

  const queue = useMemo(() => {
    const filtered =
      queueFilter === "all"
        ? posts
        : posts.filter((p) => p.status === queueFilter);
    return [...filtered].sort((a, b) =>
      (a.scheduledFor || a.createdAt).localeCompare(
        b.scheduledFor || b.createdAt,
      ),
    );
  }, [posts, queueFilter]);

  const selected = posts.find((p) => p.id === selectedId) || null;

  const counts = useMemo(
    () => ({
      draft: posts.filter((p) => p.status === "draft").length,
      scheduled: posts.filter((p) => p.status === "scheduled").length,
      published: posts.filter((p) => p.status === "published").length,
      connected: connected.length,
    }),
    [posts, connected.length],
  );

  function toggleAccount(id: string) {
    setAccountIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setUploadingMedia(true);
    try {
      const next: SocialMediaItem[] = [...media];
      for (const file of Array.from(files)) {
        if (next.length >= 4) {
          setError("You can attach up to 4 media files per post.");
          break;
        }
        if (live && getAuthToken) {
          next.push(await uploadSocialMediaFile(file, getAuthToken));
        } else {
          next.push(await fileToSocialMedia(file));
        }
      }
      setMedia(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingMedia(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function applyListing(id: string) {
    setListingId(id);
    if (id === "__none") return;
    const listing = listings.find((l) => l.id === id);
    if (!listing) return;
    if (!caption.trim()) {
      setCaption(
        `${listing.title} · ${listing.city}\n\n${listing.description || "Book a viewing this week."}`,
      );
    }
    if (listing.imageUrl && media.length === 0) {
      setMedia([
        {
          id: `media_listing_${listing.id}`,
          kind: "image",
          name: `${listing.title}.jpg`,
          mimeType: "image/jpeg",
          sizeBytes: 0,
          dataUrl: listing.imageUrl,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  }

  async function createPosts(status: SocialPost["status"]) {
    if (!caption.trim()) return;
    if (accountIds.length === 0) {
      setError("Connect and select at least one social account.");
      setTab("accounts");
      return;
    }
    const hasInstagram = connected.some(
      (a) => accountIds.includes(a.id) && a.platform === "instagram",
    );
    if (hasInstagram && media.length === 0) {
      setError("Instagram requires at least one image or video to publish.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const canPublishLive = status === "published" && live && Boolean(onPublishNow);
      // In live mode we can't mark a post "published" until the platform APIs
      // actually confirm it — create it as scheduled-for-now first, then fire
      // the real publish call and let it flip the status.
      const initialStatus: SocialPost["status"] = canPublishLive ? "scheduled" : status;
      const scheduledFor =
        initialStatus === "scheduled"
          ? status === "published"
            ? now
            : fromLocalInputValue(scheduleAt)
          : undefined;
      const createdId = await onCreate({
        caption: caption.trim(),
        accountIds,
        media,
        linkUrl: linkUrl.trim() || undefined,
        listingId: listingId === "__none" ? undefined : listingId,
        status: initialStatus,
        scheduledFor,
        publishedAt: status === "published" && !canPublishLive ? now : undefined,
      });
      if (canPublishLive && onPublishNow && createdId) {
        const result = await onPublishNow(createdId);
        if (!result.ok) {
          setError(result.message);
          toast.error(result.message || "Failed to publish post.");
        } else {
          toast.success("Post published to your connected account!");
        }
      } else {
        if (status === "published") {
          toast.success("Post published!");
        } else if (status === "scheduled") {
          toast.success("Post scheduled!");
        } else {
          toast.success("Draft saved to queue!");
        }
      }
      setCaption("");
      setMedia([]);
      setLinkUrl("");
      setListingId("__none");
      setScheduleAt(toLocalInputValue());
      setTab("queue");
      if (status === "draft") setQueueFilter("draft");
      else if (status === "scheduled") setQueueFilter("scheduled");
      else setQueueFilter("all");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--muted)]">
            Connect accounts, upload media, then schedule posts to go out on
            time.
          </p>
          {planHint ? (
            <p className="mt-1 text-xs text-[var(--muted)]">{planHint}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
          <span>{counts.connected} connected</span>
          <span aria-hidden>·</span>
          <span>{counts.draft} drafts</span>
          <span aria-hidden>·</span>
          <span>{counts.scheduled} scheduled</span>
          <span aria-hidden>·</span>
          <span>{counts.published} published</span>
        </div>
      </div>

      {error ? (
        <div className="rounded-[var(--radius-sm)] border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsBar>
          <TabsList>
            <TabsTrigger value="calendar">
              <CalendarDays className="size-3.5" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="queue">
              <ListOrdered className="size-3.5" />
              Queue
            </TabsTrigger>
            <TabsTrigger value="compose" disabled={!canEdit}>
              <PenLine className="size-3.5" />
              Compose
            </TabsTrigger>
            <TabsTrigger value="accounts">
              <PlugZap className="size-3.5" />
              Accounts
            </TabsTrigger>
          </TabsList>
        </TabsBar>

        <TabsContent value="calendar" className="space-y-3">
          <p className="text-sm font-medium">{format(monthAnchor, "MMMM yyyy")}</p>
          <div className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)]">
            <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-muted)]">
              {weekdayLabels.map((label) => (
                <div
                  key={label}
                  className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="grid auto-rows-fr grid-cols-7">
              {calendarDays.map((day) => {
                const key = dayKey(day);
                const dayPosts = postsByDay.get(key) || [];
                const inMonth = isSameMonth(day, monthAnchor);
                const isToday = isSameDay(day, new Date());
                return (
                  <div
                    key={key}
                    className={cn(
                      "min-h-[7.5rem] border-b border-r border-[var(--border)] p-1.5 sm:min-h-[8.5rem] sm:p-2 [&:nth-child(7n)]:border-r-0",
                      !inMonth && "bg-[var(--surface-muted)]/40",
                      isToday && "bg-[var(--accent-soft)]/35",
                    )}
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <span
                        className={cn(
                          "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                          isToday && "bg-accent text-accent-foreground",
                          !isToday && inMonth && "text-[var(--foreground)]",
                          !isToday && !inMonth && "text-[var(--muted)]/55",
                        )}
                      >
                        {format(day, "d")}
                      </span>
                      {dayPosts.length > 2 ? (
                        <span className="text-[10px] text-[var(--muted)]">
                          +{dayPosts.length - 2}
                        </span>
                      ) : null}
                    </div>
                    <ul className="space-y-1">
                      {dayPosts.slice(0, 2).map((post) => {
                        const targets = postAccounts(post, accounts);
                        return (
                          <li key={post.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedId(post.id);
                                setTab("queue");
                              }}
                              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-1.5 py-1 text-left transition hover:border-[var(--foreground)]/20"
                            >
                              <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                                {targets.length
                                  ? targets
                                      .map((a) => PLATFORM_LABEL[a.platform])
                                      .join(" · ")
                                  : "Unassigned"}
                                {post.scheduledFor
                                  ? ` · ${format(parseISO(post.scheduledFor), "HH:mm")}`
                                  : ""}
                              </p>
                              <p className="mt-0.5 line-clamp-1 text-[11px]">
                                {post.caption}
                              </p>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="queue" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "All"],
                ["draft", "Drafts"],
                ["scheduled", "Scheduled"],
                ["published", "Published"],
                ["failed", "Failed"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={queueFilter === value ? "default" : "secondary"}
                onClick={() => setQueueFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-2">
              {queue.length === 0 ? (
                <EmptyState
                  title="Nothing in the queue"
                  description="Compose a post with media and pick connected accounts to fill the calendar."
                />
              ) : (
                queue.map((post) => {
                  const targets = postAccounts(post, accounts);
                  const active = selectedId === post.id;
                  return (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => setSelectedId(post.id)}
                      className={cn(
                        "w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition",
                        active &&
                          "border-[var(--foreground)]/30 bg-[var(--surface-muted)]",
                      )}
                    >
                      <div className="flex gap-3">
                        {post.media?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={post.media[0].dataUrl}
                            alt=""
                            className="h-16 w-16 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-dashed border-[var(--border)] text-[var(--muted)]">
                            <ImagePlus className="size-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              tone={statusTone(post.status)}
                              className="capitalize"
                            >
                              {post.status}
                            </Badge>
                            {targets.map((a) => (
                              <Badge key={a.id} tone="accent">
                                {PLATFORM_LABEL[a.platform]}
                              </Badge>
                            ))}
                            {post.scheduledFor ? (
                              <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
                                <Clock className="size-3" />
                                {format(
                                  parseISO(post.scheduledFor),
                                  market === "uk"
                                    ? "d MMM yyyy · HH:mm"
                                    : "MMM d, yyyy · h:mm a",
                                )}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm">
                            {post.caption}
                          </p>
                          {post.media?.length ? (
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {post.media.length} media
                              {post.linkUrl ? " · link attached" : ""}
                            </p>
                          ) : post.linkUrl ? (
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              Link attached
                            </p>
                          ) : null}
                          {post.status === "failed" && post.lastError ? (
                            <p className="mt-1 text-xs text-[var(--danger)]">
                              {post.lastError}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <aside className="h-fit rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-4">
              {selected ? (
                <SelectedPostEditor
                  key={selected.id}
                  post={selected}
                  accounts={accounts}
                  listings={listings}
                  market={market}
                  canEdit={canEdit}
                  busy={busy}
                  live={live}
                  getAuthToken={getAuthToken}
                  onPublishNow={onPublishNow}
                  onClose={() => setSelectedId(null)}
                  onSave={async (patch) => {
                    setBusy(true);
                    try {
                      await onUpdate(selected.id, patch);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  onDelete={async () => {
                    setBusy(true);
                    try {
                      await onDelete(selected.id);
                      setSelectedId(null);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  Select a post to reschedule, swap media, or publish.
                </p>
              )}
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="compose">
          {canEdit ? (
            connected.length === 0 ? (
              <EmptyState
                title="Connect an account first"
                description="Posts need at least one connected Instagram, Facebook, LinkedIn, or X account."
                action={
                  <Button type="button" onClick={() => setTab("accounts")}>
                    <Plug className="size-4" />
                    Connect accounts
                  </Button>
                }
              />
            ) : (
              <form
                className="mx-auto max-w-2xl space-y-5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void createPosts("draft");
                }}
              >
                <div>
                  <h2 className="font-display text-xl">Compose post</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Pick accounts, upload media, then draft, schedule, or
                    publish.
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Post to
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {connected.map((account) => {
                      const on = accountIds.includes(account.id);
                      return (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => toggleAccount(account.id)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm font-semibold transition",
                            on
                              ? "border-accent bg-accent text-accent-foreground"
                              : "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--foreground)]",
                          )}
                        >
                          {PLATFORM_LABEL[account.platform]}
                          <span className="ml-1 font-normal opacity-80">
                            · {account.displayName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Caption
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1.5 text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                      onClick={() => {
                        const selectedLst = listings.find((l) => l.id === listingId) || listings[0];
                        if (!selectedLst) {
                          setCaption("✨ Discover your dream property with our expert brokerage team! Contact us today for exclusive property tours and consultations. 🏠 #RealEstate #Property #HomeSweetHome");
                          return;
                        }
                        const currencySymbol = market === "uk" ? "£" : "$";
                        const generated = `🏡 EXCLUSIVE PROPERTY: ${selectedLst.title}
📍 ${selectedLst.address}, ${selectedLst.city}
💰 ${currencySymbol}${selectedLst.price.toLocaleString()}
🛏️ ${selectedLst.beds} Beds | 🛁 ${selectedLst.baths} Baths | 📐 ${selectedLst.sqft || 1800} sq ft

${selectedLst.description || "Stunning modern property built with premium finishes and prime neighborhood access."}

DM us or click the link to schedule a private tour today! ✨
#RealEstate #PropertyListing #DreamHome #${selectedLst.city.replace(/[^a-zA-Z]/g, "")}RealEstate #JustListed`;
                        setCaption(generated);
                      }}
                    >
                      <Sparkles className="size-3.5" />
                      AI Generate Caption
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Write your caption or use AI Generate Caption above…"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={5}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Media
                    </p>
                    {uploadingMedia ? (
                      <span className="text-xs text-[var(--accent)] animate-pulse">
                        Uploading & preparing media…
                      </span>
                    ) : null}
                  </div>
                  {error ? (
                    <div className="rounded-[var(--radius-sm)] border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
                      {error}
                    </div>
                  ) : null}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => void handleFiles(e.target.files)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (fileRef.current) fileRef.current.value = "";
                      fileRef.current?.click();
                    }}
                    disabled={uploadingMedia || busy || media.length >= 4}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)]/40 px-4 py-8 text-sm text-[var(--muted)] transition hover:border-accent hover:text-[var(--foreground)] disabled:opacity-50"
                  >
                    <Upload className={cn("size-5", uploadingMedia && "animate-bounce text-[var(--accent)]")} />
                    <span className="font-medium text-[var(--foreground)]">
                      {uploadingMedia ? "Uploading to storage…" : "Upload images or video"}
                    </span>
                    <span className="text-xs">
                      Up to 4 files · images and video under 10MB
                    </span>
                  </button>
                  {media.length > 0 ? (
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {media.map((item) => (
                        <li
                          key={item.id}
                          className="relative overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)]"
                        >
                          {item.kind === "image" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.dataUrl}
                              alt={item.name}
                              className="aspect-video w-full object-cover"
                            />
                          ) : (
                            <video
                              src={item.dataUrl}
                              className="aspect-video w-full object-cover"
                              controls
                            />
                          )}
                          <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px]">
                            <span className="truncate">{item.name}</span>
                            <span className="shrink-0 text-[var(--muted)]">
                              {item.sizeBytes
                                ? formatBytes(item.sizeBytes)
                                : item.kind}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="absolute right-2 top-2 rounded-full bg-[var(--ink)]/70 p-1 text-white"
                            aria-label={`Remove ${item.name}`}
                            onClick={() =>
                              setMedia((prev) =>
                                prev.filter((m) => m.id !== item.id),
                              )
                            }
                          >
                            <X className="size-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      <Link2 className="size-3.5" />
                      Link (optional)
                    </label>
                    <Input
                      placeholder="https://…"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Pull from listing (optional)
                    </label>
                    <Select value={listingId} onValueChange={applyListing}>
                      <SelectTrigger>
                        <SelectValue placeholder="No listing" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">No listing</SelectItem>
                        {listings.map((listing) => (
                          <SelectItem key={listing.id} value={listing.id}>
                            {listing.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Schedule for
                  </label>
                  <Input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={busy || !caption.trim()}
                  >
                    {busy ? "Saving…" : "Save draft"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy || !caption.trim() || !scheduleAt}
                    onClick={() => void createPosts("scheduled")}
                  >
                    Schedule
                  </Button>
                  <Button
                    type="button"
                    disabled={busy || !caption.trim()}
                    onClick={() => void createPosts("published")}
                  >
                    Publish now
                  </Button>
                </div>
              </form>
            )
          ) : (
            <EmptyState
              title="Compose locked"
              description="Your role can view the calendar and queue, but cannot create posts."
            />
          )}
        </TabsContent>

        <TabsContent value="accounts">
          <AccountsPanel
            accounts={accounts}
            orgName={orgName}
            canEdit={canEdit}
            busy={busy}
            live={live}
            getAuthToken={getAuthToken}
            onConnect={async (input) => {
              setBusy(true);
              setError(null);
              try {
                await onUpsertAccount({
                  ...input,
                  status: "connected",
                  connectedAt: new Date().toISOString(),
                });
              } finally {
                setBusy(false);
              }
            }}
            onDisconnect={async (account) => {
              setBusy(true);
              try {
                await onUpsertAccount({
                  ...account,
                  status: "disconnected",
                });
              } finally {
                setBusy(false);
              }
            }}
            onRemove={async (id) => {
              setBusy(true);
              try {
                await onDeleteAccount(id);
              } finally {
                setBusy(false);
              }
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type SocialStatus = {
  supabaseConfigured: boolean;
  platforms: Record<SocialPlatform, { configured: boolean; hint: string }>;
};

function AccountsPanel({
  accounts,
  orgName,
  canEdit,
  busy,
  live,
  getAuthToken,
  onConnect,
  onDisconnect,
  onRemove,
}: {
  accounts: SocialAccount[];
  orgName: string;
  canEdit: boolean;
  busy: boolean;
  live: boolean;
  getAuthToken?: () => Promise<string | null>;
  onConnect: (input: {
    id?: string;
    platform: SocialPlatform;
    displayName: string;
    handle?: string;
  }) => Promise<void>;
  onDisconnect: (account: SocialAccount) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  // --- Simulated flow (local/demo workspaces with no server-side OAuth) ---
  const [oauthPlatform, setOauthPlatform] = useState<SocialPlatform | null>(
    null,
  );
  const [oauthStep, setOauthStep] = useState<"redirect" | "consent">("redirect");
  const [selectedCandidate, setSelectedCandidate] = useState<string>("");
  const [reconnectId, setReconnectId] = useState<string | undefined>();
  const [authorizing, setAuthorizing] = useState(false);

  // --- Real flow (Supabase-backed workspaces) ---
  const [status, setStatus] = useState<SocialStatus | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectingPlatform, setConnectingPlatform] = useState<SocialPlatform | null>(null);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    fetch("/api/social/status")
      .then((res) => res.json())
      .then((json: SocialStatus) => {
        if (!cancelled) setStatus(json);
      })
      .catch(() => {
        if (!cancelled) setConnectError("Could not reach the server to check connection status.");
      });
    return () => {
      cancelled = true;
    };
  }, [live]);

  const candidates = useMemo(
    () => (oauthPlatform ? oauthCandidates(oauthPlatform, orgName) : []),
    [oauthPlatform, orgName],
  );

  const byPlatform = useMemo(() => {
    return SOCIAL_PLATFORMS.map((p) => ({
      platform: p,
      accounts: accounts.filter((a) => a.platform === p),
    }));
  }, [accounts]);

  function startSimulatedOAuth(platform: SocialPlatform, existingId?: string) {
    setOauthPlatform(platform);
    setReconnectId(existingId);
    setOauthStep("redirect");
    setSelectedCandidate("");
    window.setTimeout(() => {
      setOauthStep("consent");
      const options = oauthCandidates(platform, orgName);
      setSelectedCandidate(options[0]?.id || "");
    }, 900);
  }

  async function approveSimulatedOAuth() {
    if (!oauthPlatform) return;
    const chosen =
      candidates.find((c) => c.id === selectedCandidate) || candidates[0];
    if (!chosen) return;
    setAuthorizing(true);
    try {
      await onConnect({
        id: reconnectId,
        platform: oauthPlatform,
        displayName: chosen.displayName,
        handle: chosen.handle,
      });
      setOauthPlatform(null);
      setReconnectId(undefined);
    } finally {
      setAuthorizing(false);
    }
  }

  async function startRealOAuth(platform: SocialPlatform) {
    setConnectError(null);
    setConnectingPlatform(platform);
    try {
      const token = getAuthToken ? await getAuthToken() : null;
      const res = await fetch("/api/social/oauth/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ platform, returnTo: window.location.pathname }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        throw new Error(json.error || "Could not start the connection");
      }
      // Top-level direct navigation to OAuth provider (avoids popup-blocker issues and multi-tab memory bloat)
      window.location.assign(json.url);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Could not start the connection");
      setConnectingPlatform(null);
    }
  }

  function connect(platform: SocialPlatform) {
    if (live) void startRealOAuth(platform);
    else startSimulatedOAuth(platform);
  }

  function reconnect(account: SocialAccount) {
    if (live) void startRealOAuth(account.platform);
    else startSimulatedOAuth(account.platform, account.id);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl">Connected accounts</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {live
            ? "Authorize each network so it can publish on your behalf — you'll sign in and grant access on the platform's own site."
            : "Demo mode: connecting here simulates authorization so you can try the scheduler. Real publishing needs a Supabase-backed workspace with platform credentials configured (see .env.example)."}
        </p>
      </div>

      {connectError ? (
        <div className="rounded-[var(--radius-sm)] border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          {connectError}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {byPlatform.map(({ platform: p, accounts: list }) => {
          const connectedList = list.filter((a) => a.status === "connected");
          const platformStatus = status?.platforms?.[p];
          const needsSetup = live && status !== null && !platformStatus?.configured;
          return (
            <div
              key={p}
              className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{PLATFORM_LABEL[p]}</p>
                  <p className="text-xs text-[var(--muted)]">{PLATFORM_HINT[p]}</p>
                </div>
                <Badge tone={connectedList.length ? "success" : "neutral"}>
                  {connectedList.length
                    ? `${connectedList.length} connected`
                    : "Not connected"}
                </Badge>
              </div>

              <ul className="mt-3 space-y-2">
                {list.map((account) => (
                  <li
                    key={account.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{account.displayName}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {account.handle || account.status}
                        {account.connectedAt
                          ? ` · since ${formatDate(account.connectedAt, "uk")}`
                          : ""}
                      </p>
                      {account.lastError ? (
                        <p className="text-xs text-[var(--danger)]">{account.lastError}</p>
                      ) : null}
                    </div>
                    {canEdit ? (
                      <div className="flex gap-1">
                        {account.status === "connected" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void onDisconnect(account)}
                          >
                            Disconnect
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy || connectingPlatform === account.platform}
                            onClick={() => reconnect(account)}
                          >
                            Reconnect
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void onRemove(account.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>

              {canEdit ? (
                needsSetup ? (
                  <div className="mt-3 rounded-md border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)]/40 p-3 text-xs text-[var(--muted)]">
                    Needs setup — {platformStatus?.hint}
                  </div>
                ) : (
                  <Button
                    type="button"
                    className="mt-3 w-full"
                    variant={connectedList.length ? "secondary" : "default"}
                    disabled={busy || connectingPlatform === p}
                    onClick={() => connect(p)}
                  >
                    <Plug className="size-4" />
                    {connectingPlatform === p
                      ? "Redirecting…"
                      : `Connect ${PLATFORM_LABEL[p]}`}
                  </Button>
                )
              ) : null}
            </div>
          );
        })}
      </div>

      {!live ? (
        <Dialog
          open={oauthPlatform !== null}
          onOpenChange={(open) => {
            if (!open) {
              setOauthPlatform(null);
              setReconnectId(undefined);
              setOauthStep("redirect");
            }
          }}
        >
          <DialogContent className="max-w-lg">
            {oauthPlatform ? (
              oauthStep === "redirect" ? (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                    <PlugZap className="size-5 animate-pulse" />
                  </div>
                  <DialogHeader>
                    <DialogTitle>
                      Opening {PLATFORM_LABEL[oauthPlatform]}…
                    </DialogTitle>
                    <DialogDescription>
                      Simulated for this demo/local workspace — redirecting you
                      to a mock {PLATFORM_LABEL[oauthPlatform]} consent screen.
                    </DialogDescription>
                  </DialogHeader>
                </div>
              ) : (
                <div className="space-y-4">
                  <DialogHeader>
                    <DialogTitle>
                      {PLATFORM_LABEL[oauthPlatform]} wants to connect
                    </DialogTitle>
                    <DialogDescription>
                      {orgName} is requesting permission to manage posts on{" "}
                      {PLATFORM_LABEL[oauthPlatform]}. Choose what to connect,
                      then allow access.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)]/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      This app will be able to
                    </p>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {PLATFORM_PERMISSIONS[oauthPlatform].map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Select account
                    </p>
                    <div className="space-y-2">
                      {candidates.map((candidate) => {
                        const selected = selectedCandidate === candidate.id;
                        return (
                          <button
                            key={candidate.id}
                            type="button"
                            onClick={() => setSelectedCandidate(candidate.id)}
                            className={cn(
                              "flex w-full items-start gap-3 rounded-[var(--radius-sm)] border px-3 py-2.5 text-left transition",
                              selected
                                ? "border-accent bg-accent/10"
                                : "border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--border-strong)]",
                            )}
                          >
                            <span
                              className={cn(
                                "mt-1 h-4 w-4 shrink-0 rounded-full border-2",
                                selected
                                  ? "border-accent bg-accent"
                                  : "border-[var(--border-strong)]",
                              )}
                            />
                            <span>
                              <span className="block text-sm font-semibold">
                                {candidate.displayName}
                              </span>
                              <span className="block text-xs text-[var(--muted)]">
                                {candidate.kind} · {candidate.handle}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setOauthPlatform(null)}
                      disabled={authorizing}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={authorizing || !selectedCandidate}
                      onClick={() => void approveSimulatedOAuth()}
                    >
                      {authorizing ? "Authorizing…" : "Allow access"}
                    </Button>
                  </div>
                </div>
              )
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function SelectedPostEditor({
  post,
  accounts,
  listings,
  market,
  canEdit,
  busy,
  live,
  getAuthToken,
  onPublishNow,
  onClose,
  onSave,
  onDelete,
}: {
  post: SocialPost;
  accounts: SocialAccount[];
  listings: PlannerListing[];
  market: Market;
  canEdit: boolean;
  busy: boolean;
  live?: boolean;
  getAuthToken?: () => Promise<string | null>;
  onPublishNow?: (postId: string) => Promise<{ ok: boolean; message: string }>;
  onClose: () => void;
  onSave: (
    patch: Partial<
      Pick<
        SocialPost,
        | "caption"
        | "status"
        | "scheduledFor"
        | "publishedAt"
        | "accountIds"
        | "media"
        | "linkUrl"
        | "listingId"
      >
    >,
  ) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const connected = accounts.filter((a) => a.status === "connected");
  const [caption, setCaption] = useState(post.caption);
  const [accountIds, setAccountIds] = useState(
    post.accountIds?.length
      ? post.accountIds
      : connected.filter((a) => a.platform === post.channel).map((a) => a.id),
  );
  const [media, setMedia] = useState(post.media || []);
  const [linkUrl, setLinkUrl] = useState(post.linkUrl || "");
  const [scheduleAt, setScheduleAt] = useState(
    toLocalInputValue(post.scheduledFor || undefined),
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  async function publishNow(patch: {
    caption: string;
    accountIds: string[];
    media: typeof media;
    linkUrl?: string;
  }) {
    if (connected.some((a) => accountIds.includes(a.id) && a.platform === "instagram") && patch.media.length === 0) {
      setPublishError("Instagram requires at least one image or video to publish.");
      return;
    }
    setPublishing(true);
    setPublishError(null);
    try {
      if (live && onPublishNow) {
        await onSave({
          ...patch,
          status: "scheduled",
          scheduledFor: new Date().toISOString(),
        });
        const result = await onPublishNow(post.id);
        if (!result.ok) {
          setPublishError(result.message);
          toast.error(result.message || "Failed to publish post.");
        } else {
          toast.success("Post published to your connected account!");
        }
      } else {
        await onSave({
          ...patch,
          status: "published",
          scheduledFor: new Date().toISOString(),
          publishedAt: new Date().toISOString(),
        });
        toast.success("Post published!");
      }
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <Badge tone={statusTone(post.status)} className="capitalize">
          {post.status}
        </Badge>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      {post.status === "failed" && post.lastError ? (
        <div className="rounded-[var(--radius-sm)] border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">
          {post.lastError}
        </div>
      ) : null}
      {publishError ? (
        <div className="rounded-[var(--radius-sm)] border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">
          {publishError}
        </div>
      ) : null}

      <Textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        rows={4}
        disabled={!canEdit || post.status === "published"}
      />

      {canEdit && post.status !== "published" ? (
        <div className="flex flex-wrap gap-2">
          {connected.map((account) => {
            const on = accountIds.includes(account.id);
            return (
              <button
                key={account.id}
                type="button"
                onClick={() =>
                  setAccountIds((prev) =>
                    prev.includes(account.id)
                      ? prev.filter((id) => id !== account.id)
                      : [...prev, account.id],
                  )
                }
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-semibold",
                  on
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-[var(--border)] text-[var(--muted)]",
                )}
              >
                {PLATFORM_LABEL[account.platform]}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {media.map((item) => (
          <div key={item.id} className="relative h-16 w-16 overflow-hidden rounded-md">
            {item.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.dataUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <video src={item.dataUrl} className="h-full w-full object-cover" />
            )}
            {canEdit && post.status !== "published" ? (
              <button
                type="button"
                className="absolute right-0.5 top-0.5 rounded-full bg-[var(--ink)]/70 p-0.5 text-white"
                onClick={() =>
                  setMedia((prev) => prev.filter((m) => m.id !== item.id))
                }
              >
                <X className="size-3" />
              </button>
            ) : null}
          </div>
        ))}
        {canEdit && post.status !== "published" && media.length < 4 ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void (async () => {
                  try {
                    setUploadError(null);
                    const item =
                      live && getAuthToken
                        ? await uploadSocialMediaFile(file, getAuthToken)
                        : await fileToSocialMedia(file);
                    setMedia((prev) => [...prev, item]);
                  } catch (err) {
                    setUploadError(
                      err instanceof Error ? err.message : "Upload failed",
                    );
                  } finally {
                    if (fileRef.current) fileRef.current.value = "";
                  }
                })();
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (fileRef.current) fileRef.current.value = "";
                fileRef.current?.click();
              }}
              className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-[var(--border)] text-[var(--muted)]"
            >
              <Upload className="size-4" />
            </button>
          </>
        ) : null}
      </div>
      {uploadError ? (
        <p className="text-xs text-[var(--danger)]">{uploadError}</p>
      ) : null}

      {post.status !== "published" ? (
        <Input
          type="datetime-local"
          value={scheduleAt}
          onChange={(e) => setScheduleAt(e.target.value)}
          disabled={!canEdit}
        />
      ) : (
        <p className="text-xs text-[var(--muted)]">
          Published{" "}
          {formatDate(post.publishedAt || post.scheduledFor || post.createdAt, market)}
        </p>
      )}

      <Input
        placeholder="Optional link"
        value={linkUrl}
        onChange={(e) => setLinkUrl(e.target.value)}
        disabled={!canEdit || post.status === "published"}
      />

      {listings.length > 0 && post.listingId ? (
        <p className="text-xs text-[var(--muted)]">
          Listing context ·{" "}
          {listings.find((l) => l.id === post.listingId)?.title || post.listingId}
        </p>
      ) : null}

      {/* Multi-Platform Live Preview Box */}
      <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Multi-Platform Live Preview
        </p>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs space-y-2 shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
            <span className="font-semibold text-xs text-[var(--accent)] uppercase tracking-wide">
              {post.channel || "Instagram"} Preview
            </span>
            <span className="text-[10px] text-[var(--muted)]">Live Rendering</span>
          </div>
          <p className="whitespace-pre-wrap">{caption || "Your post preview text will appear here..."}</p>
          {media.length > 0 && (
            <div className="relative h-32 w-full overflow-hidden rounded-md">
              <img src={media[0].dataUrl} alt="" className="h-full w-full object-cover" />
            </div>
          )}
          {linkUrl ? (
            <div className="rounded border border-[var(--border)] bg-[var(--surface-muted)] p-1.5 text-[11px] text-[var(--accent)] truncate">
              🔗 {linkUrl}
            </div>
          ) : null}
        </div>
      </div>

      {canEdit ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {post.status !== "published" ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy || !caption.trim() || accountIds.length === 0}
                onClick={() =>
                  void onSave({
                    caption: caption.trim(),
                    accountIds,
                    media,
                    linkUrl: linkUrl.trim() || undefined,
                    status: "draft",
                    scheduledFor: undefined,
                    publishedAt: undefined,
                  })
                }
              >
                Save draft
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={
                  busy || !caption.trim() || !scheduleAt || accountIds.length === 0
                }
                onClick={() =>
                  void onSave({
                    caption: caption.trim(),
                    accountIds,
                    media,
                    linkUrl: linkUrl.trim() || undefined,
                    status: "scheduled",
                    scheduledFor: fromLocalInputValue(scheduleAt),
                  })
                }
              >
                Schedule
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy || publishing || !caption.trim() || accountIds.length === 0}
                onClick={() =>
                  void publishNow({
                    caption: caption.trim(),
                    accountIds,
                    media,
                    linkUrl: linkUrl.trim() || undefined,
                  })
                }
              >
                {publishing
                  ? "Publishing…"
                  : post.status === "failed"
                    ? "Retry publish"
                    : "Publish"}
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void onDelete()}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      ) : null}
    </div>
  );
}
