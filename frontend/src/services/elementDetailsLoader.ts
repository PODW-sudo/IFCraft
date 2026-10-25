import type { ElementDetails } from '../types/ifc';

/**
 * Fetches element details for a project/element pair.
 *
 * Injected so the loader stays pure and testable: production code passes
 * `api.getElementDetails`.
 */
export type DetailsFetcher = (projectId: string, expressId: number) => Promise<ElementDetails>;

export interface DetailsResult {
  /** The element this result belongs to, or `null` for a cleared selection. */
  expressId: number | null;
  details: ElementDetails | null;
  /** Human-readable failure message when the fetch failed; otherwise `null`. */
  error: string | null;
  /**
   * `true` when a newer `select()` call was issued while this request was in
   * flight. A superseded result must never be applied to the UI.
   */
  superseded: boolean;
}

export const CLEARED_DETAILS_RESULT: DetailsResult = {
  expressId: null,
  details: null,
  error: null,
  superseded: false
};

/**
 * Sequence-guarded, single-flight element-details loader (STEP-14 / F-016, F-036).
 *
 * A single instance owns the ordering of every details request it starts, so the
 * result with `superseded === false` is always the one for the most recent
 * `select()` call - independent of the order in which the network answers.
 *
 * The loader never rejects: a failed fetch resolves with `{ details: null, error }`
 * so a network failure can never produce an unhandled rejection.
 *
 * One instance must be shared between everything that displays element details
 * (the selection hook and any reload triggered by a property save); two instances
 * would each have their own ordering.
 */
export class ElementDetailsLoader {
  /** Monotonic request counter; the largest value is the only "current" request. */
  private seq = 0;
  private readonly fetchDetails: DetailsFetcher;

  constructor(fetchDetails: DetailsFetcher) {
    this.fetchDetails = fetchDetails;
  }

  /**
   * Starts a request for `expressId` and returns its result.
   *
   * `select(projectId, null)` resolves immediately with a cleared result and
   * supersedes any in-flight request. Selecting the same element again
   * (e.g. a reload after a save) also supersedes the earlier request - there is
   * deliberately no "same id, so ignore" shortcut.
   */
  async select(projectId: string | null, expressId: number | null): Promise<DetailsResult> {
    const mySeq = ++this.seq;

    if (expressId === null || projectId === null) {
      return { ...CLEARED_DETAILS_RESULT };
    }

    try {
      const details = await this.fetchDetails(projectId, expressId);
      return { expressId, details, error: null, superseded: mySeq !== this.seq };
    } catch (err) {
      return {
        expressId,
        details: null,
        error: err instanceof Error ? err.message : String(err),
        superseded: mySeq !== this.seq
      };
    }
  }
}
