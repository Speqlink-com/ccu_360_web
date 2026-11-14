"use client";
import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { pageOf, memberLabels, memberRole } from "@/lib/api/identity-contract";
import { useCommunicationUI } from "@/providers/app-provider";
import { useFacilityAccess } from "@/features/worksite/access-provider";
import { Dialog } from "@/components/ui/dialog";
import { Empty } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
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
        detail="A shared conversation. A clearer next step. Stay connected with the people in your facility."
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
        <div className="context-banner">
          <span>
            Starting from a patient journey. Every invited colleague must have
            current access to that journey.
          </span>
          <button
            className="btn btn-secondary"
            onClick={() => setCreating(true)}
          >
            Start linked discussion
          </button>
        </div>
      )}
      <div className={`connect-workspace ${selected ? "has-thread" : ""}`}>
        <section className="connect-inbox" aria-label="Conversation inbox">
          <header>
            <div>
              <p className="eyebrow">YOUR FACILITY</p>
              <h2>Conversations</h2>
            </div>
            <button
              className="connect-new"
              aria-label="New conversation"
              onClick={() => setCreating(true)}
            >
              <Icon name="plus" size={23} />
            </button>
          </header>
          <label className="connect-search">
            <Icon name="search" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter conversation titles"
              aria-label="Filter conversation titles"
            />
          </label>
          <QueryState query={inbox} />
          <div className="conversation-list">
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
          {inbox.data && (
            <Pager
              offset={offset}
              count={inbox.data.scanned}
              change={setOffset}
            />
          )}
          <footer>
            <Icon name="shield" size={16} />
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
          <section className="conversation-placeholder">
            <div className="connect-emblem">
              <Icon name="connect" size={48} />
            </div>
            <p className="eyebrow">CONNECTED PEOPLE. COORDINATED CARE.</p>
            <h2>Make room for a conversation.</h2>
            <p>
              Reach a colleague, coordinate your department, or start a
              discussion around a patient journey.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => setCreating(true)}
            >
              Start a conversation <Icon name="arrow" />
            </button>
            <small>
              Read receipts show a message was viewed. Clinical sign-offs stay
              in the patient journey.
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
      className={`conversation-row ${active ? "selected" : ""}`}
      onClick={open}
      aria-current={active ? "true" : undefined}
    >
      <span className={`conversation-avatar ${item.kind}`}>
        <Icon name={item.kind === "group" ? "connect" : "profile"} size={24} />
      </span>
      <span className="conversation-summary">
        <strong>{label}</strong>
        <span>
          {item.encounter_id
            ? "Patient journey discussion"
            : item.kind === "group"
              ? "Facility group"
              : "Private conversation"}
        </span>
        <small>{stamp(item.updated_at)}</small>
      </span>
      {!!item.unread_count && (
        <span
          className="unread-count"
          aria-label={`${item.unread_count} unread messages`}
        >
          {item.unread_count > 99 ? "99+" : item.unread_count}
        </span>
      )}
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
    <Dialog
      title="Start a conversation"
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
            className="connect-kind"
            role="group"
            aria-label="Conversation type"
          >
            <button
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
          <div className="chosen-people">
            {Object.entries(selected).map(([id, name]) => (
              <button
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
          <div className="colleague-options">
            {colleagues.data?.items
              .filter(
                (person) =>
                  person.membership_id !== member?.id &&
                  `${person.display_name} ${person.email}`
                    .toLowerCase()
                    .includes(filter.toLowerCase()),
              )
              .map((person) => (
                <label key={person.membership_id}>
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
                  <span>
                    <strong>{person.display_name}</strong>
                    <small>
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
          <Notice error={mutation.error} />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={!chosen || (kind === "direct" && chosen !== 1)}
          >
            {mutation.isPending ? "Creating…" : "Open conversation"}
          </button>
        </fieldset>
      </form>
    </Dialog>
  );
}
