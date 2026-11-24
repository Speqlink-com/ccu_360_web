"use client";
import { buttonClasses } from "@/lib/presentation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { pageOf } from "@/lib/api/identity-contract";
import { Dialog } from "@/components/ui/dialog";
import { Empty } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { ButtonHeartbeat } from "@/components/ui/ccu-loader";
import {
  Field,
  Notice,
  QueryState,
  stamp,
  value,
} from "@/features/live/shared";
import {
  conversation,
  message,
  participant,
  revision,
  historyPage,
  type Message,
} from "./contract";
import {
  useCommunicationQuery,
  useCommunicationScope,
  useHistory,
} from "./queries";
import { ParticipantsDialog } from "./participants";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

export function ConversationThread({
  id,
  back,
}: {
  id: string;
  back: () => void;
}) {
  const { key, member } = useCommunicationScope();
  const client = useQueryClient();
  const meta = useCommunicationQuery(`conversations/${id}`, conversation);
  const people = useCommunicationQuery(
    `conversations/${id}/members?limit=100`,
    pageOf(participant),
    !!meta.data,
  );
  const history = useHistory(id);
  const [membersOpen, setMembersOpen] = useState(false);
  const [action, setAction] = useState<{
    kind: "edit" | "redact" | "history";
    item: Message;
  } | null>(null);
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiArea = useRef<HTMLDivElement>(null);
  const draft = useRef<HTMLTextAreaElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const scroll = useRef<HTMLDivElement>(null);
  const pending = useRef<{ body: string; id: string } | null>(null);
  const lastRead = useRef(0);
  useEffect(() => {
    if (!emojiOpen) return;
    const dismissOutside = (event: PointerEvent) => {
      if (!emojiArea.current?.contains(event.target as Node)) setEmojiOpen(false);
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEmojiOpen(false);
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [emojiOpen]);
  const refresh = async () => {
    await client.invalidateQueries({
      queryKey: key,
      predicate: (query) => query.queryKey[3] !== "names",
    });
  };
  const send = useMutation({
    mutationFn: () => {
      const body = text.trim();
      if (!body) throw new Error("Write a message before sending.");
      if (pending.current?.body !== body)
        pending.current = { body, id: crypto.randomUUID() };
      return apiRequest(
        `/api/v1/communication/conversations/${id}/messages`,
        message,
        { method: "POST", body: { body, client_id: pending.current!.id } },
      );
    },
    onSuccess: async () => {
      setText("");
      pending.current = null;
      setAtBottom(true);
      await refresh();
    },
  });
  const receipt = useMutation({
    mutationFn: (sequence: number) =>
      apiRequest(
        `/api/v1/communication/conversations/${id}/read-receipt`,
        z.object({ last_read_sequence: z.number() }),
        { method: "PUT", body: { sequence } },
      ),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: [...key, `conversations/${id}`],
      });
      void client.invalidateQueries({
        queryKey: key,
        predicate: (query) =>
          String(query.queryKey[3]).startsWith("conversations?"),
      });
    },
    onError: () => {
      lastRead.current = 0;
    },
  });
  const acknowledge = receipt.mutate;
  const items = [
    ...new Map(
      history.data?.pages
        .flatMap((page) => page.items)
        .map((item) => [item.id, item]) ?? [],
    ).values(),
  ].sort((a, b) => a.sequence - b.sequence);
  const latest = items.at(-1)?.sequence ?? 0;
  useEffect(() => {
    if (atBottom && scroll.current)
      scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [latest, atBottom]);
  useEffect(() => {
    if (
      meta.error instanceof ApiError &&
      [403, 404].includes(meta.error.status)
    ) {
      const filter = {
        queryKey: key,
        predicate: (query: { queryKey: readonly unknown[] }) =>
          String(query.queryKey[3]).startsWith(`conversations/${id}`),
      };
      void client
        .cancelQueries(filter)
        .then(() => client.removeQueries(filter));
    }
  }, [meta.error, client, id, key]);
  useEffect(() => {
    if (
      atBottom &&
      meta.data &&
      latest > Math.max(meta.data.last_read_sequence, lastRead.current) &&
      document.hasFocus() &&
      document.visibilityState === "visible"
    ) {
      lastRead.current = latest;
      acknowledge(latest);
    }
  }, [latest, atBottom, meta.data, acknowledge, history.dataUpdatedAt]);
  const title =
    meta.data?.title ??
    (people.data?.items
      .filter((person) => person.membership_id !== member?.id)
      .map((person) => person.display_name)
      .join(", ") ||
      "Direct conversation");
  return (
    <section className="conversation-thread relative flex min-h-0 min-w-0 flex-col" aria-label="Open conversation">
      <header className="thread-heading flex items-center gap-3.5 border-b border-border bg-surface px-6 py-5 max-[1100px]:gap-2.5 max-[1100px]:p-4">
        <button
          className="thread-back hidden border-0 bg-transparent max-[760px]:block"
          onClick={back}
          aria-label="Back to conversations"
        >
          <Icon name="left" size={19} outline />
        </button>
        <span className="conversation-avatar thread-avatar-art" data-kind={meta.data?.kind === "group" ? "group" : "direct"} aria-hidden="true">
          {meta.data?.kind === "group" ? <>
            <Image unoptimized className="thread-avatar-person thread-avatar-left" src="/icons/profile-icon.webp" alt="" width={32} height={32} />
            <Image unoptimized className="thread-avatar-person thread-avatar-right" src="/icons/profile-icon.webp" alt="" width={32} height={32} />
            <Image unoptimized className="thread-avatar-person thread-avatar-front" src="/icons/profile-icon.webp" alt="" width={35} height={35} />
          </> : <Image unoptimized className="thread-avatar-single" src="/icons/profile-icon.webp" alt="" width={38} height={38} />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="mb-[5px] wrap-anywhere text-[19px] text-navy max-[760px]:text-[17px]">{title}</h2>
          <p className="text-xs text-muted">
            {meta.data?.encounter_id
              ? "Patient journey discussion"
              : "Private facility conversation"}
          </p>
        </div>
        <button
          className={`${buttonClasses.secondary} thread-participants px-3 py-[9px] text-xs`}
          disabled={!meta.data}
          onClick={() => setMembersOpen(true)}
        >
          <Icon name="team" size={16} outline /> Participants
        </button>
      </header>
      <QueryState query={meta} />
      {meta.data && (
        <>
          {meta.data.encounter_id && (
            <Link
              className="thread-context flex items-center gap-2.5 bg-mint px-6 py-3 text-[13px] text-teal-dark"
              href={`/dashboard/patients/${meta.data.encounter_id}`}
            >
              <Icon name="patients" /> Open patient journey{" "}
              <Icon name="arrow" />
            </Link>
          )}
          <div
            ref={scroll}
            className="message-history min-h-0 flex-1 overflow-y-auto overscroll-contain px-7 py-6 max-[1100px]:p-5 max-[760px]:p-4.5"
            aria-label="Message history"
            onScroll={() => {
              const view = scroll.current!;
              setAtBottom(
                view.scrollHeight - view.scrollTop - view.clientHeight < 80,
              );
            }}
          >
            <div className="history-controls flex justify-center gap-2">
              {history.hasNextPage && (
                <button
                  className={`${buttonClasses.secondary} mb-5 px-3 py-2 text-xs`}
                  disabled={history.isFetchingNextPage}
                  onClick={() => {
                    setAtBottom(false);
                    void history.fetchNextPage();
                  }}
                >
                  {history.isFetchingNextPage
                    ? "Loading…"
                    : "Load earlier messages"}
                </button>
              )}
              {history.data && latest < meta.data.last_sequence && (
                <button
                  className={`${buttonClasses.secondary} mb-5 px-3 py-2 text-xs`}
                  onClick={() => {
                    void client.resetQueries({
                      queryKey: [...key, `conversations/${id}/messages`],
                    });
                    setAtBottom(true);
                  }}
                >
                  Return to latest
                </button>
              )}
            </div>
            <QueryState query={history} />
            {history.data && !items.length && (
              <Empty title="The conversation is open">
                Send the first message. New group members see messages from the
                time they join.
              </Empty>
            )}
            {items.map((item) => {
              const mine = item.sender_id === member?.id;
              const readers =
                people.data?.items.filter(
                  (person) =>
                    person.active &&
                    person.membership_id !== item.sender_id &&
                    person.last_read_sequence >= item.sequence,
                ).length ?? 0;
              return (
                <article
                  key={item.id}
                  className={`chat-message mb-6 w-fit max-w-[min(82%,650px)] max-[1100px]:max-w-[95%] ${mine ? "mine ml-auto" : ""}`}
                >
                  <div className="message-byline mb-2 flex flex-wrap items-baseline gap-3">
                    <strong className="text-[13px] text-navy">{mine ? "You" : item.sender_name}</strong>
                    <time className="text-[10px] text-muted" dateTime={item.created_at}>
                      {stamp(item.created_at)}
                    </time>
                  </div>
                  <div
                    className={`message-body wrap-anywhere whitespace-pre-wrap leading-[1.65] ${item.redacted ? "redacted text-sm italic" : "text-[15px]"}`}
                  >
                    {item.redacted
                      ? "Message removed · revision record retained"
                      : item.body}
                  </div>
                  <footer className="flex items-center justify-between gap-5 pt-2 text-[10px] text-muted">
                    <span>
                      {item.revision > 1 && !item.redacted ? "Edited · " : ""}
                      {mine && readers > 0
                        ? `Viewed by ${readers} colleague${readers === 1 ? "" : "s"}`
                        : ""}
                    </span>
                    <div className="flex gap-2.5">
                      {!item.redacted && mine && (
                        <button
                          className="border-0 bg-transparent px-0 py-[3px] text-[11px] text-teal-dark"
                          onClick={() => setAction({ kind: "edit", item })}
                        >
                          Edit
                        </button>
                      )}
                      {!item.redacted &&
                        (mine || meta.data!.role === "owner") && (
                          <button
                            className="border-0 bg-transparent px-0 py-[3px] text-[11px] text-teal-dark"
                            onClick={() => setAction({ kind: "redact", item })}
                          >
                            Remove
                          </button>
                        )}
                      <button
                        className="border-0 bg-transparent px-0 py-[3px] text-[11px] text-teal-dark"
                        onClick={() => setAction({ kind: "history", item })}
                      >
                        History
                      </button>
                    </div>
                  </footer>
                </article>
              );
            })}
          </div>
          {!atBottom && (
            <button className="new-messages absolute bottom-[150px] left-1/2 -translate-x-1/2 rounded-[5px] border-0 bg-navy px-[15px] py-2.5 text-xs text-white shadow-[0_3px_10px_#06234c22]" onClick={() => setAtBottom(true)}>
              Jump to latest messages ↓
            </button>
          )}
          <form
            className="message-composer border-t border-border bg-surface px-6 py-4 max-[760px]:p-4"
            onSubmit={(event) => {
              event.preventDefault();
              send.mutate();
            }}
          >
            <label className="sr-only" htmlFor="message-draft">Message this conversation</label>
            <div className="message-composer-row">
              <div className="emoji-control" ref={emojiArea}>
              <button
                type="button"
                className="emoji-trigger"
                aria-label="Choose emoji"
                aria-expanded={emojiOpen}
                aria-controls="connect-emoji-picker"
                onClick={() => setEmojiOpen((open) => !open)}
              >
                <Icon name="emoji" size={22} outline />
              </button>
              {emojiOpen && (
                <div className="connect-emoji-popover" id="connect-emoji-picker">
                  <EmojiPicker
                    colorScheme="light"
                    width="min(350px, calc(100vw - 30px))"
                    height="min(390px, 48dvh)"
                    previewConfig={{ showPreview: false }}
                    skinTonesDisabled
                    onEmojiClick={({ emoji }) => {
                      const field = draft.current;
                      const start = field?.selectionStart ?? text.length;
                      const end = field?.selectionEnd ?? start;
                      if (text.length - (end - start) + emoji.length > 8000) return;
                      setText((current) => current.slice(0, start) + emoji + current.slice(end));
                      requestAnimationFrame(() => {
                        field?.focus();
                        field?.setSelectionRange(start + emoji.length, start + emoji.length);
                      });
                    }}
                  />
                </div>
              )}
              </div>
              <textarea
                id="message-draft"
                ref={draft}
                value={text}
                maxLength={8000}
                rows={2}
                placeholder="Write a message…"
                disabled={send.isPending}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing &&
                    !event.repeat
                  ) {
                    event.preventDefault();
                    if (text.trim() && !send.isPending) send.mutate();
                  }
                }}
              />
              <button className={buttonClasses.primary} disabled={!text.trim() || send.isPending} aria-busy={send.isPending} aria-label="Send message">
                <ButtonHeartbeat loading={send.isPending}><span className="send-label">Send</span><Icon name="arrow" size={17} outline /></ButtonHeartbeat>
              </button>
            </div>
            <Notice error={send.error} compact />
            <small className="message-composer-note">Enter to send · Shift+Enter for a new line · {text.length.toLocaleString()} / 8,000</small>
          </form>
        </>
      )}
      {membersOpen && meta.data && (
        <ParticipantsDialog
          conversation={meta.data}
          close={() => setMembersOpen(false)}
        />
      )}
      {action && (
        <MessageDialog
          action={action}
          close={() => setAction(null)}
          saved={async () => {
            setAction(null);
            await refresh();
          }}
        />
      )}
    </section>
  );
}
function MessageDialog({
  action,
  close,
  saved,
}: {
  action: { kind: "edit" | "redact" | "history"; item: Message };
  close: () => void;
  saved: () => Promise<void>;
}) {
  const { key } = useCommunicationScope();
  const client = useQueryClient();
  const resource = `conversations/${action.item.conversation_id}/messages/${action.item.id}`;
  const [offset, setOffset] = useState(0);
  const paged = useCommunicationQuery(
    resource + `/revisions?offset=${offset}&limit=20`,
    pageOf(revision),
    action.kind === "history",
  );
  // Revision pages contain metadata only; bodies are never reconstructed from old revisions.
  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      apiRequest(
        `/api/v1/communication/${resource}${action.kind === "redact" ? "/redact" : ""}`,
        message,
        {
          method: action.kind === "redact" ? "POST" : "PATCH",
          body: {
            expected_revision: action.item.revision,
            reason: value(data, "reason"),
            ...(action.kind === "edit" ? { body: value(data, "body") } : {}),
          },
        },
      ),
    onSuccess: async (result) => {
      // Apply the validated current revision before closing the dialog, so the
      // author never waits on delivery/refetch to see an edit or redaction.
      client.setQueriesData<InfiniteData<z.infer<typeof historyPage>>>(
        {
          queryKey: [
            ...key,
            `conversations/${action.item.conversation_id}/messages`,
          ],
        },
        (data) =>
          data
            ? {
                ...data,
                pages: data.pages.map((page) => ({
                  ...page,
                  items: page.items.map((item) =>
                    item.id === result.id ? result : item,
                  ),
                })),
              }
            : data,
      );
      await saved();
    },
    onError: () => {
      void client.invalidateQueries({ queryKey: key });
    },
  });
  return (
    <Dialog
      className="connect-message-dialog"
      title={
        action.kind === "history"
          ? "Message revision record"
          : action.kind === "edit"
            ? "Edit your message"
            : "Remove this message"
      }
      subtitle={
        action.kind === "history"
          ? "An immutable record of changes. Previous message content is not exposed."
          : action.kind === "redact"
            ? "Removal cannot be undone in the app. Encrypted evidence remains retained."
            : "Your name, reason and revision are recorded."
      }
      onClose={close}
    >
      <div className="connect-message-dialog-body">
      {action.kind === "history" ? (
        <>
          <QueryState query={paged} />
          {paged.data?.items.map((item) => (
            <article className="revision-item border-b border-border py-4" key={item.revision}>
              <strong className="text-navy">
                Revision {item.revision} · {item.kind}
              </strong>
              <p className="text-xs text-muted">{stamp(item.created_at)}</p>
              <small className="hash-value wrap-anywhere font-mono text-xs">{item.content_digest}</small>
            </article>
          ))}
          <div className="live-pager mt-5 flex flex-wrap items-center justify-end gap-3">
            <button
              className={buttonClasses.secondary}
              disabled={!offset}
              onClick={() => setOffset(Math.max(0, offset - 20))}
            >
              Previous
            </button>
            <button
              className={buttonClasses.secondary}
              disabled={(paged.data?.items.length ?? 0) < 20}
              onClick={() => setOffset(offset + 20)}
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <form
          className="live-form"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate(new FormData(event.currentTarget));
          }}
        >
          <fieldset disabled={mutation.isPending}>
            {action.kind === "edit" && (
              <Field
                name="body"
                label="Message"
                type="textarea"
                maxLength={8000}
                defaultValue={action.item.body ?? ""}
              />
            )}
            <Field
              name="reason"
              label="Reason for this change"
              minLength={3}
              maxLength={500}
            />
            <Notice error={mutation.error} compact />
            <button className={buttonClasses.primary}>
              <ButtonHeartbeat loading={mutation.isPending}>
                {action.kind === "redact" ? "Remove message" : "Save revision"}
              </ButtonHeartbeat>
            </button>
          </fieldset>
        </form>
      )}
      </div>
    </Dialog>
  );
}
