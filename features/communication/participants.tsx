"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { pageOf } from "@/lib/api/identity-contract";
import { Dialog } from "@/components/ui/dialog";
import {
  Field,
  Notice,
  Pager,
  QueryState,
  value,
} from "@/features/live/shared";
import { Badge } from "@/components/ui/primitives";
import {
  colleague,
  participant,
  type Conversation,
  type Participant,
} from "./contract";
import { useCommunicationQuery, useCommunicationScope } from "./queries";
export function ParticipantsDialog({
  conversation,
  close,
}: {
  conversation: Conversation;
  close: () => void;
}) {
  const { key } = useCommunicationScope();
  const client = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [colleagueOffset, setColleagueOffset] = useState(0);
  const [target, setTarget] = useState<Participant | null>(null);
  const members = useCommunicationQuery(
    `conversations/${conversation.id}/members?offset=${offset}&limit=20`,
    pageOf(participant),
  );
  const peers = useCommunicationQuery(
    `colleagues?offset=${colleagueOffset}&limit=50`,
    pageOf(colleague),
    conversation.kind === "group" && conversation.role === "owner",
  );
  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      apiRequest(
        `/api/v1/communication/conversations/${conversation.id}/members`,
        z.unknown(),
        {
          method: "PUT",
          body: {
            membership_id:
              target?.membership_id ?? value(data, "membership_id"),
            active: value(data, "active") === "true",
            role: value(data, "role"),
            reason: value(data, "reason"),
          },
        },
      ),
    onSuccess: async () => {
      setTarget(null);
      await client.invalidateQueries({ queryKey: key });
    },
    onError: () => {
      void client.invalidateQueries({ queryKey: key });
    },
  });
  const claim = useMutation({
    mutationFn: (data: FormData) =>
      apiRequest(
        `/api/v1/communication/conversations/${conversation.id}/claim-ownership`,
        z.unknown(),
        { method: "POST", body: { reason: value(data, "reason") } },
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: key });
      close();
    },
  });
  return (
    <Dialog
      title="Conversation participants"
      subtitle="Participants belong to this facility. New or returning members see only messages from their joining point."
      onClose={close}
    >
      <QueryState query={members} />
      {members.data?.items.map((person) => (
        <article className="participant-item" key={person.membership_id}>
          <div>
            <strong>{person.display_name}</strong>
            <small>
              {person.role} · {person.membership_status}
            </small>
            <Badge tone={person.active ? "teal" : "neutral"}>
              {person.active ? "In conversation" : "Removed"}
            </Badge>
          </div>
          {conversation.kind === "group" && conversation.role === "owner" && (
            <button
              className="btn btn-secondary"
              onClick={() => setTarget(person)}
            >
              Manage
            </button>
          )}
        </article>
      ))}
      {members.data && (
        <Pager
          offset={offset}
          count={members.data.items.length}
          change={setOffset}
        />
      )}
      {conversation.kind === "group" && conversation.role === "owner" && (
        <form
          key={target?.membership_id ?? "add"}
          className="live-form participant-form"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate(new FormData(event.currentTarget));
          }}
        >
          <h3>
            {target ? `Manage ${target.display_name}` : "Add a colleague"}
          </h3>
          <fieldset disabled={mutation.isPending}>
            {!target && (
              <>
                <QueryState query={peers} />
                <Field name="membership_id" label="Colleague">
                  <option value="">Choose an active colleague</option>
                  {peers.data?.items.map((person) => (
                    <option
                      key={person.membership_id}
                      value={person.membership_id}
                    >
                      {person.display_name} · {person.profession}
                    </option>
                  ))}
                </Field>
                {peers.data && (
                  <Pager
                    offset={colleagueOffset}
                    count={peers.data.items.length}
                    size={50}
                    change={setColleagueOffset}
                  />
                )}
              </>
            )}
            <Field
              name="active"
              label="Participation"
              defaultValue={String(target?.active ?? true)}
            >
              <option value="true">Active participant</option>
              <option value="false">Remove participant</option>
            </Field>
            <Field
              name="role"
              label="Conversation role"
              defaultValue={target?.role ?? "member"}
            >
              <option value="member">Member</option>
              <option value="owner">Owner — can manage this group</option>
            </Field>
            <Field name="reason" label="Reason" minLength={3} maxLength={500} />
            <Notice error={mutation.error} />
            <button className="btn btn-primary">
              {mutation.isPending ? "Saving…" : "Save participant"}
            </button>
            {target && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setTarget(null)}
              >
                Add someone else
              </button>
            )}
          </fieldset>
        </form>
      )}
      {conversation.kind === "group" && conversation.role !== "owner" && (
        <details className="ownership-recovery">
          <summary>Group owner no longer available?</summary>
          <p>
            An active participant can recover ownership only when no current
            owner retains access. The server checks eligibility.
          </p>
          <form
            className="live-form"
            onSubmit={(event) => {
              event.preventDefault();
              claim.mutate(new FormData(event.currentTarget));
            }}
          >
            <Field
              name="reason"
              label="Reason for ownership recovery"
              minLength={3}
              maxLength={500}
            />
            <Notice error={claim.error} />
            <button className="btn btn-secondary" disabled={claim.isPending}>
              Request ownership recovery
            </button>
          </form>
        </details>
      )}
    </Dialog>
  );
}
