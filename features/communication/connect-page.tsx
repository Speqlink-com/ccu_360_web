"use client";
import { buttonClasses } from "@/lib/presentation";
import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { pageOf, memberLabels, memberRole } from "@/lib/api/identity-contract";
import { useCommunicationUI } from "@/providers/app-provider";
import { useFacilityAccess } from "@/features/worksite/access-provider";
import { SideDrawer } from "@/components/ui/side-drawer";
import { Empty } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { ButtonHeartbeat } from "@/components/ui/ccu-loader";
import {
  Heading,
  Notice,
  QueryState,
  Pager,
  Field,
  stamp,
  value,
} from "@/features/live/shared";
import {
  colleague,
  conversation,
  conversationPage,
  participant,
  type Conversation,
} from "./contract";
import { useCommunicationQuery, useCommunicationScope } from "./queries";
import { ConversationThread } from "./thread";

const connectionLabels = {
  offline: "Offline",
  connecting: "Connecting…",
  live: "Live connection",
  reconnecting: "Reconnecting…",
  polling: "Updates via polling",
  paused: "Connection paused",
};
export function ConnectPage() {
  const selected = useCommunicationUI((state) => state.selected);
  const select = useCommunicationUI((state) => state.select);
  const connection = useCommunicationUI((state) => state.connection);
  const [offset, setOffset] = useState(0);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const searchParams = useSearchParams();
  const encounter = z.string().uuid().safeParse(searchParams.get("encounter"));
  const inbox = useCommunicationQuery(
    `conversations?offset=${offset}&limit=20`,
    conversationPage,
  );
  const rows = inbox.data?.items.filter(
    (item) =>
      !search ||
      (item.title ?? "Direct conversation")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <Heading
        title="Connect 360"
        detail="Private conversations with colleagues across your facility."
        actions={
          <div
            className={`connection-indicator connection-${connection}`}
            role="status"
          >
            <i />
            {connectionLabels[connection]}
          </div>
        }
      />
      {encounter.success && (
        <div className="context-banner mb-5 flex items-center justify-between gap-5 rounded-[10px] bg-mint px-5 py-4 text-sm max-[760px]:flex-col max-[760px]:items-start">
          <span>
            Starting from a patient journey. Every invited colleague must have
            current access to that journey.
          </span>
          <button
            className={buttonClasses.secondary}
            onClick={() => setCreating(true)}
          >
            Start linked discussion
          </button>
        </div>
      )}
      <div className={`connect-workspace grid min-h-[650px] overflow-hidden rounded-2xl border border-[#dce5e8] bg-surface shadow-[0_5px_24px_#06234c05] [grid-template-columns:340px_minmax(0,1fr)] [height:min(800px,calc(100dvh-230px))] max-[1100px]:[grid-template-columns:290px_minmax(0,1fr)] max-[760px]:block max-[760px]:min-h-[610px] max-[760px]:[height:calc(100dvh-180px)] ${selected ? "has-thread" : ""}`}>
        <section className="connect-inbox flex min-h-0 flex-col border-r border-border max-[760px]:h-full max-[760px]:border-r-0" aria-label="Conversation inbox">
          <header className="connect-inbox-header flex items-center justify-between px-5.5 pt-[26px] pb-3">
            <div>
              <h2 className="my-1.5 text-[22px] tracking-[-.03em] text-navy">Conversations</h2>
              <p>Messages within your facility</p>
            </div>
            <button
              className="connect-new grid h-10 w-10 place-items-center rounded-[11px] border border-[#b6dcd4] bg-mint text-teal-dark"
              aria-label="New conversation"
              title="New conversation"
              onClick={() => setCreating(true)}
            >
              <Icon name="plus" size={21} outline />
            </button>
          </header>
          <label className="connect-search mx-5 mt-3 mb-[18px] flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-[10px] text-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-teal">
            <Icon name="search" size={17} outline />
            <input
              className="w-full min-w-0 border-0 bg-transparent text-[13px] outline-none"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search conversation titles"
              aria-label="Search conversation titles"
            />
          </label>
          <QueryState query={inbox} />
          <div className="conversation-list flex-1 overflow-y-auto">
            {rows?.map((item) => (
              <ConversationRow
                key={item.id}
                item={item}
                active={item.id === selected}
                open={() => select(item.id)}
              />
            ))}
          </div>
          {inbox.data && !rows?.length && (
            <Empty
              title={
                search
                  ? "No matching conversations"
                  : "Your conversations start here"
              }
            >
              Create a direct conversation or bring colleagues together in a
              group.
            </Empty>
          )}
          {inbox.data && (offset > 0 || inbox.data.scanned >= 20) && (
            <Pager
              offset={offset}
              count={inbox.data.scanned}
              change={setOffset}
            />
          )}
          <footer className="connect-inbox-footer flex items-center gap-2 border-t border-border px-5.5 py-4.5 text-xs text-muted">
            <Icon name="shield" size={16} outline />
            <span>Private to invited participants</span>
          </footer>
        </section>
        {selected ? (
          <ConversationThread
            key={selected}
            id={selected}
            back={() => select(null)}
          />
        ) : (
          <section className="conversation-placeholder flex flex-col items-center justify-center p-10 text-center">
            <div className="connect-emblem mb-7 grid h-[88px] w-[88px] place-items-center text-teal">
              <Icon name="connect" size={44} outline />
            </div>
            <h2 className="my-4.5 max-w-[440px] text-[27px] leading-[1.2] tracking-[-.04em] text-navy">Select a conversation</h2>
            <p className="mb-6 max-w-[420px] text-[14px] leading-[1.7] text-muted">
              Choose a chat from the list, or start a new one with a colleague.
            </p>
            <button
              className={buttonClasses.primary}
              onClick={() => setCreating(true)}
            >
              New conversation <Icon name="arrow" size={16} outline />
            </button>
            <small className="mt-7 max-w-[380px] leading-[1.8] text-muted">
              Clinical sign-offs remain in the patient journey.
            </small>
          </section>
        )}
      </div>
      {creating && (
        <NewConversation
          encounterId={encounter.success ? encounter.data : undefined}
          close={() => setCreating(false)}
          created={(id) => {
            select(id);
            setCreating(false);
            setOffset(0);
          }}
        />
      )}
    </>
  );
}
function ConversationRow({
  item,
  active,
  open,
}: {
  item: Conversation;
  active: boolean;
  open: () => void;
}) {
  const { key, member } = useCommunicationScope();
  const access = useFacilityAccess();
  const people = useQuery({
    queryKey: [...key, "names", item.id],
    queryFn: ({ signal }) =>
      apiRequest(
        `/api/v1/communication/conversations/${item.id}/members?limit=100`,
        pageOf(participant),
        { signal },
      ),
    enabled: item.kind === "direct" && access.allowed,
    staleTime: 60_000,
    gcTime: 0,
    retry: false,
  });
  const label =
    item.title ??
    (people.data?.items
      .filter((person) => person.membership_id !== member?.id)
      .map((person) => person.display_name)
      .join(", ") ||
      "Direct conversation");
  return (
    <button
      className={`conversation-row flex w-full items-center gap-3 border-0 border-b border-b-[#eef2f3] border-l-[3px] p-5 text-left ${active ? "selected border-l-teal bg-mint" : "border-l-transparent bg-surface hover:bg-[#f4f9f8]"}`}
      onClick={open}
      aria-current={active ? "true" : undefined}
    >
      <span className={`conversation-avatar grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[14px] ${item.kind === "group" ? "group bg-[#e6f4ee] text-teal-dark" : "direct bg-[#edf2f7] text-navy"}`}>
        <Icon name={item.kind === "group" ? "connect" : "profile"} size={22} outline />
      </span>
      <span className="conversation-summary flex min-w-0 flex-1 flex-col gap-[6px]">
        <span className="conversation-row-top"><strong className="truncate text-[15px] text-navy">{label}</strong><small>{stamp(item.updated_at)}</small></span>
        <span className="conversation-row-bottom"><span className="text-xs text-muted">
          {item.encounter_id
            ? "Patient journey discussion"
            : item.kind === "group"
              ? "Facility group"
              : "Private conversation"}
        </span>
        {!!item.unread_count && (
          <span className="unread-count grid h-[22px] min-w-[22px] place-items-center rounded-[20px] bg-teal px-[5px] text-[11px] font-bold text-white" aria-label={`${item.unread_count} unread messages`}>
            {item.unread_count > 99 ? "99+" : item.unread_count}
          </span>
        )}</span>
      </span>
    </button>
  );
}
function NewConversation({
  encounterId,
  close,
  created,
}: {
  encounterId?: string;
  close: () => void;
  created: (id: string) => void;
}) {
  const { member, key } = useCommunicationScope();
  const [offset, setOffset] = useState(0);
  const [kind, setKind] = useState<"direct" | "group">("direct");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("");
  const colleagues = useCommunicationQuery(
    `colleagues?offset=${offset}&limit=50`,
    pageOf(colleague),
  );
  const client = useQueryClient();
  const pending = useRef<{ shape: string; id: string } | null>(null);
  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const body = {
        kind,
        membership_ids: Object.keys(selected).sort(),
        ...(kind === "group" ? { title: value(data, "title") } : {}),
        ...(encounterId ? { encounter_id: encounterId } : {}),
      };
      const shape = JSON.stringify(body);
      if (pending.current?.shape !== shape)
        pending.current = { shape, id: crypto.randomUUID() };
      return apiRequest("/api/v1/communication/conversations", conversation, {
        method: "POST",
        body: { ...body, client_id: pending.current!.id },
      });
    },
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: key });
      created(result.id);
    },
  });
  const chosen = Object.keys(selected).length;
  return (
    <SideDrawer
      title="Start a conversation"
      eyebrow="CONNECT 360 / NEW"
      closeLabel="Close new conversation"
      className="connect-new-drawer"
      subtitle={
        encounterId
          ? "Linked discussion · only colleagues with access to this journey can join."
          : "Only invited participants can read this conversation."
      }
      onClose={close}
    >
      <form
        className="live-form"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(new FormData(event.currentTarget));
        }}
      >
        <fieldset disabled={mutation.isPending}>
          <div
            className="connect-kind mb-5.5 flex gap-2"
            role="group"
            aria-label="Conversation type"
          >
            <button
              className="flex-1 rounded-lg border border-border bg-white p-3 text-[13px] font-semibold text-muted aria-pressed:border-teal aria-pressed:bg-mint aria-pressed:text-teal-dark"
              type="button"
              aria-pressed={kind === "direct"}
              onClick={() => {
                setKind("direct");
                setSelected({});
              }}
            >
              Direct conversation
            </button>
            <button
              className="flex-1 rounded-lg border border-border bg-white p-3 text-[13px] font-semibold text-muted aria-pressed:border-teal aria-pressed:bg-mint aria-pressed:text-teal-dark"
              type="button"
              aria-pressed={kind === "group"}
              onClick={() => {
                setKind("group");
                setSelected({});
              }}
            >
              Group conversation
            </button>
          </div>
          {kind === "group" && (
            <Field
              name="title"
              label="Group name"
              minLength={2}
              maxLength={160}
            />
          )}
          <div className="chosen-people my-3 flex flex-wrap gap-2">
            {Object.entries(selected).map(([id, name]) => (
              <button
                className="rounded-[22px] border border-[#cde6df] bg-mint px-3 py-2 text-xs text-teal-dark"
                type="button"
                key={id}
                onClick={() =>
                  setSelected((current) =>
                    Object.fromEntries(
                      Object.entries(current).filter(([key]) => key !== id),
                    ),
                  )
                }
              >
                {name} ×
              </button>
            ))}
          </div>
          <input
            aria-label="Filter colleagues"
            placeholder="Search names or email on this page"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <QueryState query={colleagues} />
          <div className="colleague-options my-3.5 max-h-[280px] overflow-y-auto rounded-[10px] border border-border">
            {colleagues.data?.items
              .filter(
                (person) =>
                  person.membership_id !== member?.id &&
                  `${person.display_name} ${person.email}`
                    .toLowerCase()
                    .includes(filter.toLowerCase()),
              )
              .map((person) => (
                <label className="flex cursor-pointer items-center gap-3.5 border-b border-border p-[15px]" key={person.membership_id}>
                  <input
                    type={kind === "direct" ? "radio" : "checkbox"}
                    name="colleague"
                    checked={!!selected[person.membership_id]}
                    disabled={
                      kind === "group" &&
                      chosen >= 49 &&
                      !selected[person.membership_id]
                    }
                    onChange={(event) =>
                      setSelected((current) =>
                        kind === "direct"
                          ? { [person.membership_id]: person.display_name }
                          : event.target.checked
                            ? {
                                ...current,
                                [person.membership_id]: person.display_name,
                              }
                            : Object.fromEntries(
                                Object.entries(current).filter(
                                  ([id]) => id !== person.membership_id,
                                ),
                              ),
                      )
                    }
                  />
                  <span className="flex min-w-0 flex-col gap-[5px]">
                    <strong className="text-sm text-navy">{person.display_name}</strong>
                    <small className="wrap-anywhere text-xs text-muted">
                      {memberRole.safeParse(person.profession).success
                        ? memberLabels[
                            person.profession as keyof typeof memberLabels
                          ]
                        : person.profession}{" "}
                      · {person.email}
                    </small>
                  </span>
                </label>
              ))}
          </div>
          {colleagues.data && (
            <Pager
              offset={offset}
              count={colleagues.data.items.length}
              size={50}
              change={setOffset}
            />
          )}
          <Notice error={mutation.error} compact />
          <button
            className={buttonClasses.primary}
            type="submit"
            disabled={!chosen || (kind === "direct" && chosen !== 1)}
          >
            <ButtonHeartbeat loading={mutation.isPending}>Open conversation</ButtonHeartbeat>
          </button>
        </fieldset>
      </form>
    </SideDrawer>
  );
}
