import { connectionNotice, type NetworkObservation } from "./contract";

export function ConnectionNotice({
  network,
  administrator = false,
}: {
  network?: NetworkObservation;
  administrator?: boolean;
}) {
  const message = connectionNotice(network);
  if (!message) return null;
  const unverified =
    network?.verification === "unverified" ||
    network?.source === "unverified_gateway";
  return (
    <aside
      className="my-4 border-l-[3px] border-teal-dark bg-mint px-4 py-3 text-sm leading-6 text-ink"
      role="status"
    >
      <p>{message}</p>
      {administrator && unverified && (
        <p className="mt-2 text-muted">
          Ask AHS to check that the web and API connection keys match and the
          server clocks are synchronized. Employee GPS checks continue
          independently.
        </p>
      )}
      {administrator && unverified && network?.support_reference && (
        <small className="mt-1 block text-muted">
          Support reference: {network.support_reference}
        </small>
      )}
    </aside>
  );
}
