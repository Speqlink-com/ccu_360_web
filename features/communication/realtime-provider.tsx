"use client";
import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useIdentity, identityKey } from "@/features/identity/queries";
import { useFacilityAccess } from "@/features/worksite/access-provider";
import { useServices } from "@/providers/app-provider";
import { apiRequest, ApiError } from "@/lib/api/client";
import { eventBatch, safeSocketUrl, ticket, type EventBatch } from "./contract";

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const user = useIdentity().data;
  const access = useFacilityAccess();
  const client = useQueryClient();
  const { communication } = useServices();
  const organization = user?.organization_id,
    userId = user?.id;
  const enabled =
    !!organization &&
    user?.platform_role !== "ahs_admin" &&
    access.allowed &&
    access.foreground;
  const refreshAccess = access.refresh;
  useEffect(() => {
    const ui = communication.getState();
    if (!enabled || !organization || !userId) {
      ui.setConnection("paused");
      return;
    }
    ui.bindScope(`${organization}:${userId}`);
    let disposed = false,
      socket: WebSocket | undefined,
      retryTimer: ReturnType<typeof setTimeout> | undefined;
    let cursor = communication.getState().cursor,
      attempt = 0,
      lastSeen = Date.now(),
      heartbeat = 5,
      polling = false,
      pendingBatches = 0;
    let queue = Promise.resolve();
    const abort = new AbortController();
    const prefix = ["communication", organization, userId];
    const process = async (batch: EventBatch) => {
      if (disposed) return;
      if (!batch.resync_required && batch.cursor < cursor) return;
      if (batch.resync_required) {
        await client.cancelQueries({ queryKey: prefix });
        await client.resetQueries({ queryKey: prefix });
        ui.select(null);
      }
      for (const event of batch.items) {
        if (event.kind === "conversation.access_removed") {
          const resource = `conversations/${event.conversation_id}`;
          const filter = {
            predicate: (query: { queryKey: readonly unknown[] }) =>
              query.queryKey[0] === "communication" &&
              query.queryKey[1] === organization &&
              String(query.queryKey[3]).startsWith(resource),
          };
          await client.cancelQueries(filter);
          client.removeQueries(filter);
          if (communication.getState().selected === event.conversation_id)
            ui.select(null);
        }
      }
      if (batch.items.length || batch.resync_required)
        await client.invalidateQueries({
          queryKey: prefix,
          predicate: (query) =>
            query.queryKey[3] !== "names" ||
            batch.items.some((event) => event.kind === "participants.changed"),
        });
      if (!disposed) {cursor = batch.cursor;ui.setCursor(cursor);}
    };
    const poll = async () => {
      if (disposed || polling || socket?.readyState === WebSocket.OPEN) return;
      polling = true;
      try {
        const batch = await apiRequest(
          `/api/v1/communication/events?after_sequence=${cursor}&limit=100`,
          eventBatch,
          { signal: abort.signal },
        );
        queue = queue.then(() => process(batch));
        await queue;
        if (!disposed) ui.setConnection("polling");
      } catch (error) {
        if (error instanceof ApiError && [401, 403].includes(error.status)) {
          refreshAccess();
          void client.invalidateQueries({ queryKey: identityKey });
        }
      } finally {
        polling = false;
      }
    };
    const connect = async () => {
      if (disposed) return;
      ui.setConnection(attempt ? "reconnecting" : "connecting");
      try {
        const issued = await apiRequest(
          "/api/v1/communication/realtime/tickets",
          ticket,
          { method: "POST", body: {}, signal: abort.signal },
        );
        if (disposed) return;
        socket = new WebSocket(
          safeSocketUrl(issued.websocket_url, window.location.origin),
          issued.protocol,
        );
        heartbeat = issued.heartbeat_seconds;
        socket.onopen = () => {
          lastSeen = Date.now();
          socket?.send(
            JSON.stringify({
              type: "authenticate",
              ticket: issued.ticket,
              after_sequence: cursor,
            }),
          );
        };
        socket.onmessage = (event) => {
          if (
            disposed ||
            typeof event.data !== "string" ||
            event.data.length > 100_000
          ) {
            socket?.close();
            return;
          }
          try {
            const raw = JSON.parse(event.data);
            if (raw.type === "ready") {
              attempt = 0;
              ui.setConnection("live");
              lastSeen = Date.now();
              return;
            }
            if (!["events", "heartbeat"].includes(raw.type)) return;
            const parsed = eventBatch.parse(raw);
            lastSeen = Date.now();
            if (pendingBatches >= 10) {
              socket?.close();
              return;
            }
            pendingBatches++;
            queue = queue
              .then(() => process(parsed))
              .catch(() => {
                socket?.close();
              })
              .finally(() => {
                pendingBatches--;
              });
          } catch {
            socket?.close();
          }
        };
        socket.onclose = (event) => {
          if (disposed) return;
          if (event.code === 4403) {
            refreshAccess();
            void client.invalidateQueries({ queryKey: identityKey });
            client.removeQueries({ queryKey: prefix });
            ui.select(null);
          }
          if (event.code === 4401)
            void client.invalidateQueries({ queryKey: identityKey });
          schedule(event.code === 4429 ? 60_000 : undefined);
        };
        socket.onerror = () => socket?.close();
      } catch (error) {
        if (error instanceof ApiError && [401, 403].includes(error.status)) {
          refreshAccess();
          void client.invalidateQueries({ queryKey: identityKey });
        }
        schedule(
          error instanceof ApiError && error.status === 429
            ? 60_000
            : undefined,
        );
      }
    };
    function schedule(delay?: number) {
      if (disposed) return;
      ui.setConnection("reconnecting");
      clearTimeout(retryTimer);
      retryTimer = setTimeout(
        () => void connect(),
        delay ??
          Math.min(30_000, 1000 * 2 ** Math.min(attempt++, 5)) +
            Math.random() * 1000,
      );
      void poll();
    }
    const interval = setInterval(() => {
      if (
        socket?.readyState === WebSocket.OPEN &&
        Date.now() - lastSeen > Math.max(20_000, heartbeat * 4000)
      )
        socket.close();
      else void poll();
    }, 15_000);
    const rotated = () => socket?.close();
    window.addEventListener("ccu360-session-rotated", rotated);
    void connect();
    return () => {
      disposed = true;
      abort.abort();
      clearTimeout(retryTimer);
      clearInterval(interval);
      window.removeEventListener("ccu360-session-rotated", rotated);
      socket?.close();
      ui.setConnection("paused");
    };
  }, [enabled, organization, userId, client, communication, refreshAccess]);
  return children;
}
