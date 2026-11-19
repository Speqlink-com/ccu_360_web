"use client";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Viewer } from "@pdfme/ui";
import { z } from "zod";
import { caseView, entry } from "@/features/live/journey-contract";
import { useLiveQuery } from "@/features/identity/queries";
import { apiRequest } from "@/lib/api/client";
import { buttonClasses } from "@/lib/presentation";
import { Notice, QueryState } from "@/features/live/shared";
import { runtime } from "./pdf-runtime";
import { prepareDocument, documentInputs } from "./prepare-document";
const exportRecord = z.object({
  output_id: z.string(),
  manifest: z.record(z.string(), z.unknown()),
  signature: z.string(),
  key_id: z.string(),
  version: z.number(),
});
const snapshot = z.object({
  export_record: exportRecord.optional(),
  case: caseView,
  entries: z.array(entry),
  attachments: z.array(
    z.object({ id: z.string(), filename: z.string(), sha256: z.string() }),
  ),
  scope: z.literal("latest_note_per_section"),
  head_hash: z.string(),
});
export type DocumentSnapshot = z.infer<typeof snapshot>;
function Preview({ data }: { data: DocumentSnapshot }) {
  const host = useRef<HTMLDivElement>(null),
    viewer = useRef<Viewer>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let gone = false;
    runtime()
      .then(({ Viewer, font, plugins }) => {
        if (!gone && host.current) {
          const template = prepareDocument(data);
          viewer.current = new Viewer({
            domContainer: host.current,
            template,
            inputs: documentInputs(template),
            plugins,
            options: { font, zoomLevel: 0.85 },
          });
        }
      })
      .catch(setError);
    return () => {
      gone = true;
      viewer.current?.destroy();
      viewer.current = null;
    };
  }, [data]);
  return (
    <>
      <Notice error={error} />
      <div className="overflow-auto rounded-lg border border-border bg-slate-100">
        <div ref={host} style={{ height: 760, minWidth: 650 }} />
      </div>
    </>
  );
}
export function CurrentDocument({
  encounterId,
  org,
}: {
  encounterId: string;
  org: string;
}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const query = useLiveQuery(
    org,
    `journey/encounters/${encounterId}/document`,
    snapshot,
    open,
    15_000,
  );
  const download = useMutation({
    mutationFn: async () => {
      if (!query.data) throw new Error("Load the current document first.");
      const source = query.data;
      const { generate, font, plugins } = await runtime();
      // Reuse the server's export authorization, source-version lock and signed output record.
      const proof = await apiRequest(
        `/api/v1/journey/encounters/${encounterId}/outputs`,
        exportRecord,
        {
          method: "POST",
          body: { expected_version: source.case.encounter.version },
        },
      );
      const template = prepareDocument({ ...source, export_record: proof });
      const bytes = await generate({
        template,
        inputs: documentInputs(template),
        plugins,
        options: { font },
      });
      const blob = new Blob([new Uint8Array(bytes)], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CCU360-journey-${encounterId.slice(0, 8)}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["live", org] }),
    onError: () => client.invalidateQueries({ queryKey: ["live", org] }),
  });
  return (
    <section
      className="mb-6 rounded-xl border border-border bg-white p-5"
      aria-label="Shared digital document"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Shared digital document</h2>
          <p className="mt-1 text-sm text-muted">
            Your facility’s page layout, completed from the current section
            notes. Every linked team sees the same document.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={buttonClasses.secondary}
            onClick={() => setOpen(!open)}
          >
            {open ? "Close document view" : "Open document view"}
          </button>
          {open &&
            query.data?.case.effective_roles.some((role) =>
              role.capabilities.includes("export"),
            ) && (
              <button
                className={buttonClasses.primary}
                disabled={!query.data || query.isFetching || download.isPending}
                onClick={() => download.mutate()}
              >
                {download.isPending ? "Preparing PDF…" : "Download current PDF"}
              </button>
            )}
        </div>
      </div>
      {open && (
        <div className="mt-5">
          <QueryState query={query} />
          <Notice error={download.error} />
          {query.data && (
            <>
              <p className="mb-4 rounded bg-slate-50 p-3 text-sm text-muted">
                Current sheet · latest note per section, including clearly
                marked drafts. Use the full ledger and signed export below for
                every round, comment, correction and handover.
              </p>
              <Preview data={query.data} />
            </>
          )}
        </div>
      )}
    </section>
  );
}
