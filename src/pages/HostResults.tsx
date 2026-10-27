
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import CostumePhotoFrame from '../components/CostumePhotoFrame';
import './HostResults.css';

const PARTY_ID = '32586d7a-6ade-4bfb-b40a-a0fa8f5e1cc5';

interface ContestResult {
    contest_id: string;
    contest_name: string;
    entry_id: string;
    costume_name: string;
    photo_url: string | null;
    vote_count: number;
}

interface Party {
    voting_start: string;
    voting_end: string;
}

interface ContestGroup {
    id: string;
    name: string;
    entries: ContestResult[];
    totalVotes: number;
}

interface ContestAward {
    id: string;
    contest_id: string;
    entry_id: string;
    placement: 'winner' | 'runner_up';
}

function groupResults(results: ContestResult[]): ContestGroup[] {
    const groups = new Map<string, ContestGroup>();

    for (const result of results) {
        if (!groups.has(result.contest_id)) {
            groups.set(result.contest_id, {
                id: result.contest_id,
                name: result.contest_name,
                entries: [],
                totalVotes: 0,
            });
        }

        const group = groups.get(result.contest_id)!;

        group.entries.push(result);
        group.totalVotes += Number(result.vote_count);
    }

    return Array.from(groups.values())
        .map(group => ({
            ...group,
            entries: group.entries.sort(
                (a, b) =>
                    Number(b.vote_count) - Number(a.vote_count) ||
                    a.costume_name.localeCompare(b.costume_name)
            ),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

export default function HostResults() {
    const [results, setResults] = useState<ContestResult[]>([]);
    const [party, setParty] = useState<Party | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [, setLastUpdated] = useState<Date | null>(null);
    const [now, setNow] = useState(Date.now());
    const [awards, setAwards] = useState<ContestAward[]>([]);
    const [savingAward, setSavingAward] = useState(false);
    const [awardError, setAwardError] = useState<string | null>(null);
    const [expandedContests, setExpandedContests] = useState<string[]>([]);
    const [awardsSummaryExpanded, setAwardsSummaryExpanded] = useState(true);

    const loadResults = useCallback(async () => {
        try {
            const [resultsResponse, partyResponse, awardsResponse] = await Promise.all([
                supabase.rpc('get_contest_results'),
                supabase
                    .from('parties')
                    .select('voting_start, voting_end')
                    .eq('id', PARTY_ID)
                    .single(),
                supabase
                    .from('contest_awards')
                    .select('id, contest_id, entry_id, placement'),
            ]);

            if (resultsResponse.error) {
                throw resultsResponse.error;
            }

            if (partyResponse.error) {
                throw partyResponse.error;
            }

            if (awardsResponse.error) {
                throw awardsResponse.error;
            }

            setResults((resultsResponse.data ?? []) as ContestResult[]);
            setParty(partyResponse.data);
            setLastUpdated(new Date());
            setAwards(awardsResponse.data ?? []);
            setError(null);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Unable to load contest results.'
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadResults();

        const interval = window.setInterval(() => {
            void loadResults();
        }, 5000);

        const clockInterval = window.setInterval(() => {
            setNow(Date.now());
        }, 1000);

        return () => {
            window.clearInterval(interval);
            window.clearInterval(clockInterval);
        };
    }, [loadResults]);

    const contests = groupResults(results);

    const toggleContest = (contestId: string) => {
        setExpandedContests(current =>
            current.includes(contestId)
                ? current.filter(id => id !== contestId)
                : [...current, contestId]
        );
    };

    const expandAllContests = () => {
        setExpandedContests(contests.map(contest => contest.id));
    };

    const collapseAllContests = () => {
        setExpandedContests([]);
    };

    const jumpToContest = (contestId: string) => {
        setExpandedContests(current =>
            current.includes(contestId) ? current : [...current, contestId]
        );
        // Wait for React to render the expanded panel before scrolling.
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                document.getElementById(`contest-section-${contestId}`)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                });
            });
        });
    };

    const selectedAwardCount = awards.filter(award =>
        contests.some(contest => contest.id === award.contest_id)
    ).length;

    const totalVotes = results.reduce(
        (sum, result) => sum + Number(result.vote_count),
        0
    );

    const totalEntries = new Set(results.map(result => result.entry_id)).size;

    const votingStatus = !party
        ? 'Unknown'
        : now < new Date(party.voting_start).getTime()
            ? 'Upcoming'
            : now < new Date(party.voting_end).getTime()
                ? 'Voting Open'
                : 'Voting Closed';

    const selectAward = async (contestId: string, entryId: string, placement: 'winner' | 'runner_up') => {
        if (savingAward || votingStatus !== 'Voting Closed') {
            return;
        }

        const existingAward = awards.find(
            award => award.entry_id === entryId
        );

        if (existingAward) {
            setAwardError(
                'This costume already has an award. Remove or change its existing award first.'
            );
            return;
        }

        setSavingAward(true);
        setAwardError(null);

        try {
            const { error } = await supabase.rpc(
                'select_contest_award',
                {
                    p_contest_id: contestId,
                    p_entry_id: entryId,
                    p_placement: placement,
                }
            );

            if (error) {
                throw error;
            }

            await loadResults();
        } catch (err) {
            setAwardError(
                err instanceof Error ? err.message : 'Unable to save award.'
            );
        } finally {
            setSavingAward(false);
        }
    };

    const removeAward = async (contestId: string, entryId: string, placement: 'winner' | 'runner_up', costumeName: string) => {
        if (savingAward || votingStatus !== 'Voting Closed') return;

        const label = placement === 'winner' ? 'Winner' : 'Runner-Up';
        const categoryName = contests.find(contest => contest.id === contestId)?.name ?? 'this category';
        if (!window.confirm(`Remove ${costumeName} as ${label} in ${categoryName}?`)) return;

        setSavingAward(true);
        setAwardError(null);
        try {
            const { error } = await supabase.rpc('remove_contest_award', {
                p_contest_id: contestId,
                p_entry_id: entryId,
                p_placement: placement,
            });
            if (error) throw error;
            await loadResults();
        } catch (err) {
            setAwardError(err instanceof Error ? err.message : 'Unable to remove award.');
        } finally {
            setSavingAward(false);
        }
    };

    return (
        <main className="host-results-page">
            <div className="host-results-container">
                <header className="host-results-header">
                    <div className="host-results-ornament">✦ ☾ ✦</div>

                    <h1>Meeting of the Midnight Coven</h1>

                    <p>Halloween Costume Contest · 2026</p>

                    {awardError && (
                        <div className="host-results-error">
                            {awardError}
                        </div>
                    )}

                    <div className="host-results-status">
                        <span
                            className={
                                votingStatus === 'Voting Open'
                                    ? 'host-status-dot active'
                                    : 'host-status-dot'
                            }
                        />
                        {votingStatus}
                    </div>
                </header>

                {loading ? (
                    <p className="host-results-message">
                        Summoning the results...
                    </p>
                ) : (
                    <>
                        {error && (
                            <div className="host-results-error">
                                Unable to refresh results: {error}
                            </div>
                        )}

                        <section className="host-results-summary">
                            <div className="host-summary-stat">
                                <strong>{totalVotes}</strong>
                                <span>Total Votes</span>
                            </div>

                            <div className="host-summary-stat">
                                <strong>{totalEntries}</strong>
                                <span>Costumes</span>
                            </div>

                            <div className="host-summary-stat">
                                <strong>{contests.length}</strong>
                                <span>Contests</span>
                            </div>
                        </section>

                        {votingStatus === 'Voting Closed' && contests.length > 0 && (
                            <section className="host-awards-summary" aria-label="Selected costume awards">
                                <button
                                    type="button"
                                    className="host-awards-summary-header"
                                    onClick={() => setAwardsSummaryExpanded(current => !current)}
                                    aria-expanded={awardsSummaryExpanded}
                                    aria-controls="host-awards-summary-panel"
                                >
                                    <span className="host-awards-summary-heading">
                                        <strong>✦ The Honored Costumes ✦</strong>
                                        <span>{selectedAwardCount} of {contests.length * 2} awards selected</span>
                                    </span>
                                    <span aria-hidden="true" className="host-awards-summary-chevron">
                                        {awardsSummaryExpanded ? '▲' : '▼'}
                                    </span>
                                </button>

                                {awardsSummaryExpanded && (
                                    <div id="host-awards-summary-panel" className="host-awards-summary-content">
                                        {contests.map(contest => {
                                            const winnerAward = awards.find(award =>
                                                award.contest_id === contest.id && award.placement === 'winner'
                                            );
                                            const runnerUpAward = awards.find(award =>
                                                award.contest_id === contest.id && award.placement === 'runner_up'
                                            );
                                            const getCostumeName = (award: ContestAward | undefined) =>
                                                award
                                                    ? contest.entries.find(entry => entry.entry_id === award.entry_id)?.costume_name
                                                    ?? 'Costume not found'
                                                    : 'Not selected';

                                            return (
                                                <div key={contest.id} className="host-awards-summary-category">
                                                    <button
                                                        type="button"
                                                        className="host-awards-summary-category-link"
                                                        onClick={() => jumpToContest(contest.id)}
                                                        aria-label={`Open ${contest.name} results`}
                                                    >
                                                        {contest.name} <span aria-hidden="true">↗</span>
                                                    </button>
                                                    <div className="host-awards-summary-placements">
                                                        <div className="host-awards-summary-placement">
                                                            <span className="host-awards-summary-placement-label">✦ Winner</span>
                                                            <span className={!winnerAward ? 'host-awards-summary-unselected' : ''}>
                                                                {getCostumeName(winnerAward)}
                                                            </span>
                                                        </div>
                                                        <div className="host-awards-summary-placement">
                                                            <span className="host-awards-summary-placement-label">✧ Runner-Up</span>
                                                            <span className={!runnerUpAward ? 'host-awards-summary-unselected' : ''}>
                                                                {getCostumeName(runnerUpAward)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        )}

                        {contests.length === 0 && !error && (
                            <p className="host-results-message">
                                No contest entries found yet.
                            </p>
                        )}

                        {contests.length > 0 && (
                            <div className="host-accordion-controls">
                                <button type="button" onClick={expandAllContests}>
                                    Expand All
                                </button>
                                <button type="button" onClick={collapseAllContests}>
                                    Collapse All
                                </button>
                            </div>
                        )}

                        {contests.map(contest => {
                            const isExpanded = expandedContests.includes(contest.id);

                            return (
                                <section
                                    key={contest.id}
                                    id={`contest-section-${contest.id}`}
                                    className={`host-contest-section ${isExpanded ? 'expanded' : ''}`}
                                >
                                    <button
                                        type="button"
                                        className="host-contest-accordion-header"
                                        onClick={() => toggleContest(contest.id)}
                                        aria-expanded={isExpanded}
                                        aria-controls={`contest-panel-${contest.id}`}
                                    >
                                        <span className="host-accordion-title">
                                            ✦ {contest.name} ✦
                                        </span>
                                        <span className="host-accordion-info">
                                            {contest.entries.length} entrants · {contest.totalVotes} votes
                                        </span>
                                        <span
                                            className={`host-accordion-chevron ${isExpanded ? 'open' : ''}`}
                                            aria-hidden="true"
                                        >
                                            ▼
                                        </span>
                                    </button>

                                    {isExpanded && (
                                        <div
                                            id={`contest-panel-${contest.id}`}
                                            className="host-accordion-content"
                                        >
                                            <div className="host-contest-entries">
                                                {contest.entries.map((entry) => {
                                                    const count = Number(entry.vote_count);

                                                    const percentage =
                                                        contest.totalVotes > 0
                                                            ? (count / contest.totalVotes) * 100
                                                            : 0;

                                                    const rank =
                                                        1 +
                                                        contest.entries.filter(
                                                            other =>
                                                                Number(other.vote_count) > count
                                                        ).length;

                                                    return (
                                                        <article
                                                            key={entry.entry_id}
                                                            className={`host-result-card ${
                                                                rank === 1 && count > 0
                                                                    ? 'host-result-leading'
                                                                    : ''
                                                            }`}
                                                        >
                                                            <div className="host-result-rank">
                                                                {count > 0
                                                                    ? `#${rank}`
                                                                    : '—'}
                                                            </div>

                                                            <div className="host-result-photo">
                                                                <CostumePhotoFrame
                                                                    photoUrl={entry.photo_url}
                                                                    costumeName={entry.costume_name}
                                                                />
                                                            </div>

                                                            <div className="host-result-details">
                                                                <h3>{entry.costume_name}</h3>

                                                                <div className="host-result-count">
                                                                    <strong>{count}</strong>
                                                                    <span>
                                                            {count === 1
                                                                ? 'vote'
                                                                : 'votes'}
                                                        </span>
                                                                    <strong>
                                                                        {percentage.toFixed(1)}%
                                                                    </strong>
                                                                </div>

                                                                <div className="host-result-progress">
                                                                    <div
                                                                        className="host-result-progress-fill"
                                                                        style={{
                                                                            width: `${percentage}%`,
                                                                        }}
                                                                    />
                                                                </div>

                                                                {votingStatus === 'Voting Closed' && (() => {
                                                                    const existingAward = awards.find(
                                                                        award => award.entry_id === entry.entry_id
                                                                    );

                                                                    const awardedElsewhere = existingAward !== undefined;

                                                                    return (
                                                                        <>
                                                                            {existingAward && (
                                                                                <div className="host-award-status">
                                                                        <span className="host-award-status-label">
                                                                            ✦ Already Awarded
                                                                        </span>

                                                                                    <span className="host-award-status-detail">
                                                                            {existingAward.placement === 'winner'
                                                                                ? 'Winner'
                                                                                : 'Runner-Up'}
                                                                                        {' in '}
                                                                                        {contests.find(
                                                                                            contest => contest.id === existingAward.contest_id
                                                                                        )?.name ?? 'Unknown Contest'}
                                                                        </span>
                                                                                </div>
                                                                            )}

                                                                            <div className="host-award-actions">
                                                                                {(['winner', 'runner_up'] as const).map(placement => {
                                                                                    const selected =
                                                                                        existingAward?.contest_id === contest.id &&
                                                                                        existingAward?.placement === placement;

                                                                                    const unavailable = awardedElsewhere && !selected;

                                                                                    return (
                                                                                        <button
                                                                                            key={placement}
                                                                                            type="button"
                                                                                            className={`host-award-button ${
                                                                                                selected ? 'selected' : ''
                                                                                            } ${
                                                                                                unavailable ? 'unavailable' : ''
                                                                                            }`}
                                                                                            disabled={
                                                                                                savingAward ||
                                                                                                selected ||
                                                                                                unavailable
                                                                                            }
                                                                                            onClick={() =>
                                                                                                selectAward(
                                                                                                    contest.id,
                                                                                                    entry.entry_id,
                                                                                                    placement
                                                                                                )
                                                                                            }
                                                                                        >
                                                                                            {selected
                                                                                                ? placement === 'winner'
                                                                                                    ? '✓ Winner'
                                                                                                    : '✓ Runner-Up'
                                                                                                : placement === 'winner'
                                                                                                    ? '✦ Winner'
                                                                                                    : '✧ Runner-Up'}
                                                                                        </button>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                            {existingAward?.contest_id === contest.id && (
                                                                                <button
                                                                                    type="button"
                                                                                    className="host-award-remove-button"
                                                                                    disabled={savingAward}
                                                                                    onClick={() => removeAward(
                                                                                        contest.id,
                                                                                        entry.entry_id,
                                                                                        existingAward.placement,
                                                                                        entry.costume_name
                                                                                    )}
                                                                                >
                                                                                    Remove {existingAward.placement === 'winner' ? 'Winner' : 'Runner-Up'} Award
                                                                                </button>
                                                                            )}
                                                                        </>
                                                                    );
                                                                })()}

                                                            </div>
                                                        </article>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </section>
                            );
                        })}

                        <footer className="host-results-footer">
                            <p>✦ The Midnight Coven ✦</p>
                        </footer>
                    </>
                )}
            </div>
        </main>
    );
}

