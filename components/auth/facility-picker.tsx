"use client";
import { buttonClasses } from "@/lib/presentation";
import { useId, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { ButtonHeartbeat } from "@/components/ui/ccu-loader";
import {
  apiRequest,
  notifyIdentityChange,
  replaceIdentityLocation,
} from "@/lib/api/client";
import type { IdentitySession } from "@/lib/api/identity-contract";
import { useIdentityUI } from "@/providers/app-provider";

export function FacilityPicker({ user }: { user: IdentitySession }) {
  const [search, setSearch] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const id = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);
  const searchId = `${id}-search`;
  const selectId = `${id}-select`;
  const suggestionsId = `${id}-matches`;
  const selected = useIdentityUI((state) => state.pendingOrganization);
  const select = useIdentityUI((state) => state.selectOrganization);
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(
        "/api/v1/auth/switch-organization",
        z.object({ organization_id: z.string().uuid() }),
        { method: "POST", body: { organization_id: id } },
      ),
    onSuccess: async () => {
      await client.cancelQueries();
      client.clear();
      notifyIdentityChange("tenant");
      replaceIdentityLocation("/dashboard");
    },
  });
  const available = user.memberships.filter(
    (item) => item.status === "active" && item.provider_status === "active",
  );
  const query = search.trim().toLowerCase();
  const matching = available
    .filter((item) => item.provider_name.toLowerCase().includes(query))
    .sort(
      (a, b) =>
        Number(b.provider_name.toLowerCase().startsWith(query)) -
          Number(a.provider_name.toLowerCase().startsWith(query)) ||
        a.provider_name.localeCompare(b.provider_name),
    );
  const topMatches = matching.slice(0, 3);
  const showSuggestions = suggestionsOpen && query.length > 0 && available.length > 0;
  const selectedFacility = available.find(
    (item) => item.organization_id === selected,
  );
  return (
    <div className="facility-picker">
      <div className="facility-picker-heading">
        <span className="facility-picker-icon" aria-hidden="true">
          <Icon name="facilities" size={20} outline />
        </span>
        <div>
          <h1>Choose your facility</h1>
          <p>Find a facility and open its care workspace.</p>
        </div>
      </div>
      <div className="facility-picker-fields">
        <div className="facility-picker-field">
          <label htmlFor={searchId}>Search by name</label>
          <div
            className="facility-picker-search"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                setSuggestionsOpen(false);
            }}
          >
            <Icon name="search" size={17} outline />
            <input
              ref={searchRef}
              id={searchId}
              type="search"
              value={search}
              placeholder="Hospital or facility name"
              autoComplete="off"
              disabled={mutation.isPending}
              onFocus={() => setSuggestionsOpen(Boolean(search.trim()))}
              onKeyDown={(event) => {
                if (event.key === "Escape") setSuggestionsOpen(false);
                if (event.key === "ArrowDown" && showSuggestions && topMatches.length) {
                  event.preventDefault();
                  suggestionsRef.current?.querySelector("button")?.focus();
                }
              }}
              onChange={(event) => {
                const next = event.target.value;
                setSearch(next);
                setSuggestionsOpen(Boolean(next.trim()));
                if (
                  selectedFacility &&
                  !selectedFacility.provider_name
                    .toLowerCase()
                    .includes(next.trim().toLowerCase())
                )
                  select(null);
              }}
            />
            {showSuggestions && (
              <ul
                ref={suggestionsRef}
                id={suggestionsId}
                className="facility-picker-suggestions"
                aria-label="Matching facilities"
              >
                {topMatches.map((item, index) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        select(item.organization_id);
                        setSearch(item.provider_name);
                        searchRef.current?.focus();
                        setSuggestionsOpen(false);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          searchRef.current?.focus();
                          setSuggestionsOpen(false);
                        }
                        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                          event.preventDefault();
                          const options = suggestionsRef.current?.querySelectorAll("button");
                          if (event.key === "ArrowUp" && index === 0)
                            searchRef.current?.focus();
                          else
                            options?.[
                              Math.max(0, Math.min(index + (event.key === "ArrowDown" ? 1 : -1), topMatches.length - 1))
                            ]?.focus();
                        }
                      }}
                    >
                      <span>{item.provider_name}</span>
                      <small>{item.role.replaceAll("_", " ")}</small>
                    </button>
                  </li>
                ))}
                {!matching.length && (
                  <li className="facility-picker-no-match">No facilities match that name.</li>
                )}
                {matching.length > 3 && (
                  <li className="facility-picker-more">More matches in the Facility select</li>
                )}
              </ul>
            )}
          </div>
        </div>
        <div className="facility-picker-field">
          <label htmlFor={selectId}>Facility</label>
          <select
            id={selectId}
            value={selected ?? ""}
            disabled={mutation.isPending || !matching.length}
            onChange={(event) => select(event.target.value || null)}
          >
            <option value="">Select a facility</option>
            {matching.map((item) => (
              <option value={item.organization_id} key={item.id}>
                {item.provider_name} · {item.role.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!available.length && (
        <p className="facility-picker-status" role="status">
          No active facility access is available. Contact your administrator.
        </p>
      )}
      {mutation.error && (
        <p className="facility-picker-error" role="alert">
          {mutation.error.message}
        </p>
      )}
      <div className="facility-picker-actions">
        <button
          type="button"
          className={buttonClasses.primary}
          disabled={!selectedFacility || mutation.isPending}
          aria-busy={mutation.isPending}
          onClick={() => selectedFacility && mutation.mutate(selectedFacility.organization_id)}
        >
          <ButtonHeartbeat loading={mutation.isPending}>
            Open workspace
            <Icon name="arrow" size={16} outline />
          </ButtonHeartbeat>
        </button>
        <Link href="/dashboard/security">Manage your account</Link>
      </div>
    </div>
  );
}
