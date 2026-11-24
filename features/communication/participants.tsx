"use client";
import { buttonClasses } from "@/lib/presentation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { pageOf } from "@/lib/api/identity-contract";
import { SideDrawer } from "@/components/ui/side-drawer";
import { Icon } from "@/components/ui/icon";
import { ButtonHeartbeat } from "@/components/ui/ccu-loader";
import { SearchSelect } from "@/features/live/search-select";
import {
  Field,
  Notice,
  Pager,
  QueryState,
  value,
} from "@/features/live/shared";
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
  const { key, member } = useCommunicationScope();
  const client = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [colleagueOffset, setColleagueOffset] = useState(0);
  const [target, setTarget] = useState<Participant | null>(null);
  const [formVersion, setFormVersion] = useState(0);
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
      setFormVersion((version) => version + 1);
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
    <SideDrawer
      title="Conversation participants"
      subtitle="Manage who can take part in this conversation."
      eyebrow="CONNECT 360 / PEOPLE"
      closeLabel="Close participants"
      className="connect-participants-drawer"
      onClose={close}
    >
      <div className="connect-participants">
      <div className="connect-participants-section"><h3>People in this conversation</h3><span>{members.data?.items.length ?? 0} shown</span></div>
      <QueryState query={members} />
      <div className="connect-participant-list">
      {members.data?.items.map((person) => (
        <article className="participant-item" key={person.membership_id}>
          <span className="participant-avatar" aria-hidden="true">{person.display_name.slice(0, 1).toUpperCase()}</span>
          <div className="participant-identity">
            <strong>{person.display_name}</strong>
            <span>{person.role === "owner" ? "Owner" : "Member"} · {person.active ? "Active" : "Removed"}</span>
          </div>
          {conversation.kind === "group" && conversation.role === "owner" && (
            <button
              className="participant-manage"
              type="button"
              onClick={() => setTarget(person)}
            >
              Manage <Icon name="arrow" size={14} outline />
            </button>
          )}
        </article>
      ))}
      </div>
      {members.data && (offset > 0 || members.data.items.length >= 20) && (
        <Pager
          offset={offset}
          count={members.data.items.length}
          change={setOffset}
        />
      )}
      {conversation.kind === "group" && conversation.role === "owner" && (
        <form
          key={`${target?.membership_id ?? "add"}:${formVersion}`}
          className="live-form participant-form"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate(new FormData(event.currentTarget));
          }}
        >
          <div className="connect-participants-section"><h3>{target ? `Manage ${target.display_name}` : "Add a colleague"}</h3>{target && <button type="button" className="participant-cancel" onClick={() => setTarget(null)}>Cancel</button>}</div>
          <fieldset disabled={mutation.isPending}>
            {!target && (
              <>
                <QueryState query={peers} />
                <SearchSelect
                  name="membership_id"
                  label="Search colleague"
                  placeholder="Type a name or email"
                  options={(peers.data?.items ?? [])
                    .filter((person) => person.membership_id !== member?.id && !members.data?.items.some((existing) => existing.membership_id === person.membership_id && existing.active))
                    .map((person) => ({ value: person.membership_id, label: person.display_name, detail: `${person.profession} · ${person.email}` }))}
                />
                {peers.data && (colleagueOffset > 0 || peers.data.items.length >= 50) && (
                  <Pager
                    offset={colleagueOffset}
                    count={peers.data.items.length}
                    size={50}
                    change={setColleagueOffset}
                  />
                )}
              </>
            )}
            {target ? <>
              <div className="participant-form-grid">
                <Field name="active" label="Participation" defaultValue={String(target.active)}>
                  <option value="true">Active</option>
                  <option value="false">Remove</option>
                </Field>
                <Field name="role" label="Role" defaultValue={target.role}>
                  <option value="member">Member</option>
                  <option value="owner">Owner</option>
                </Field>
              </div>
            </> : <><input type="hidden" name="active" value="true" /><input type="hidden" name="role" value="member" /></>}
            <Field name="reason" label="Reason for change" minLength={3} maxLength={500} />
            <Notice error={mutation.error} compact />
            <div className="participant-actions"><button className={buttonClasses.primary} disabled={!target && !peers.data}><ButtonHeartbeat loading={mutation.isPending}>{target ? "Save changes" : "Add colleague"}</ButtonHeartbeat></button></div>
          </fieldset>
        </form>
      )}
      {conversation.kind === "group" && conversation.role !== "owner" && (
        <details className="ownership-recovery py-5 text-[14px] leading-[1.7] text-muted">
          <summary className="cursor-pointer font-semibold text-teal-dark">Group owner no longer available?</summary>
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
            <Notice error={claim.error} compact />
            <button className={buttonClasses.secondary} disabled={claim.isPending}>
              <ButtonHeartbeat loading={claim.isPending}>Request ownership recovery</ButtonHeartbeat>
            </button>
          </form>
        </details>
      )}
      </div>
    </SideDrawer>
  );
}
