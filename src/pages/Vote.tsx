
import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { ensureAnonymousUser } from '../services/auth';

interface Contest {
    id: string;
    name: string;
    entry_type: string;
}

interface CostumeEntry {
    id: string;
    costume_name: string;
    photo_url: string | null;
    user_id: string;
    entry_type: string;
}

interface ContestEntry {
    contest_id: string;
    entry_id: string;
}

interface VoteRecord {
    contest_id: string;
    entry_id: string;
}

interface Party {
    id: string;
    voting_start: string | null;
    voting_end: string | null;
}

export default function Vote() {
    const [contests, setContests] = useState<Contest[]>([]);
    const [entries, setEntries] = useState<CostumeEntry[]>([]);
    const [contestEntries, setContestEntries] =
        useState<ContestEntry[]>([]);

    const [votes, setVotes] =
        useState<Record<string, string>>({});

    const [party, setParty] = useState<Party | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);
    const [savingContest, setSavingContest] =
        useState<string | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const [now, setNow] = useState(Date.now());

    const [expandedContest, setExpandedContest] =
        useState<string | null>(null);


    useEffect(() => {
        const interval = window.setInterval(() => {
            setNow(Date.now());
        }, 1000);

        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        async function loadVoting() {
            try {
                const user = await ensureAnonymousUser();
                setUserId(user.id);

                const { data: partyData, error: partyError } =
                    await supabase
                        .from('parties')
                        .select('id, voting_start, voting_end')
                        .eq(
                            'id',
                            '32586d7a-6ade-4bfb-b40a-a0fa8f5e1cc5'
                        )
                        .single();

                if (partyError) throw partyError;

                setParty(partyData);

                const [
                    contestsResult,
                    entriesResult,
                    contestEntriesResult,
                    votesResult,
                ] = await Promise.all([
                    supabase
                        .from('contests')
                        .select('id, name, entry_type')
                        .eq('party_id', partyData.id),

                    supabase
                        .from('entries')
                        .select(
                            'id, costume_name, photo_url, user_id, entry_type'
                        )
                        .eq('party_id', partyData.id),

                    supabase
                        .from('contest_entries')
                        .select('contest_id, entry_id'),

                    supabase
                        .from('votes')
                        .select('contest_id, entry_id')
                        .eq('voter_id', user.id),
                ]);

                if (contestsResult.error) throw contestsResult.error;
                if (entriesResult.error) throw entriesResult.error;
                if (contestEntriesResult.error)
                    throw contestEntriesResult.error;
                if (votesResult.error) throw votesResult.error;

                setContests(contestsResult.data ?? []);
                setEntries(entriesResult.data ?? []);
                setContestEntries(contestEntriesResult.data ?? []);

                const existingVotes: Record<string, string> = {};

                (votesResult.data as VoteRecord[] ?? []).forEach(
                    (vote) => {
                        existingVotes[vote.contest_id] = vote.entry_id;
                    }
                );

                setVotes(existingVotes);
            } catch (err) {
                console.error('Voting page error:', err);

                setError(
                    err instanceof Error
                        ? err.message
                        : 'Unable to load voting.'
                );
            } finally {
                setLoading(false);
            }
        }

        loadVoting();
    }, []);

    const votingStart = party?.voting_start
        ? new Date(party.voting_start).getTime()
        : null;

    const votingEnd = party?.voting_end
        ? new Date(party.voting_end).getTime()
        : null;

    const votingOpen =
        votingStart !== null &&
        votingEnd !== null &&
        now >= votingStart &&
        now < votingEnd;

    const votingUpcoming =
        votingStart !== null && now < votingStart;

    function formatCountdown(milliseconds: number) {
        const totalSeconds = Math.max(
            0,
            Math.floor(milliseconds / 1000)
        );

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return [
            hours,
            minutes,
            seconds,
        ]
            .map((value) => String(value).padStart(2, '0'))
            .join(':');
    }

    async function submitVote(
        contestId: string,
        entryId: string
    ) {
        if (!votingOpen || savingContest || !userId) return;

        setSavingContest(contestId);
        setMessage(null);
        setError(null);

        try {
            const { error: voteError } = await supabase.rpc(
                'cast_vote',
                {
                    p_contest_id: contestId,
                    p_entry_id: entryId,
                }
            );

            if (voteError) throw voteError;

            setVotes((previous) => ({
                ...previous,
                [contestId]: entryId,
            }));

            // Collapse the category after a successful vote.
            setExpandedContest(null);

            setMessage('Your vote has been saved!');
        } catch (err) {
            console.error('Vote submission error:', err);

            setError(
                err instanceof Error
                    ? err.message
                    : 'Unable to submit your vote.'
            );
        } finally {
            setSavingContest(null);
        }
    }

    if (loading) {
        return (
            <main className="page">
                <section className="registration-card">
                    Loading costume voting...
                </section>
            </main>
        );
    }

    if (error && !party) {
        return (
            <main className="page">
                <section className="registration-card">
                    <h1>Something went wrong</h1>
                    <p>{error}</p>
                </section>
            </main>
        );
    }

    return (
        <main className="page">
            <section className="registration-card">
                <div className="registration-header">
                    <div className="registration-symbol">✦</div>

                    <p>Halloween Party 2026</p>
                    <h1>Cast Your Vote</h1>

                    {votingUpcoming && votingStart !== null && (
                        <>
                            <p>Voting opens in</p>
                            <h2>{formatCountdown(votingStart - now)}</h2>
                        </>
                    )}

                    {votingOpen && votingEnd !== null && (
                        <>
                            <p>Voting is open!</p>
                            <h2>{formatCountdown(votingEnd - now)}</h2>
                            <p>Time remaining</p>
                        </>
                    )}

                    {!votingUpcoming && !votingOpen && (
                        <p>Voting is currently closed.</p>
                    )}
                </div>

                {error && <p role="alert">{error}</p>}
                {message && <p role="status">{message}</p>}


                {contests.map((contest) => {
                    const eligibleIds = new Set(
                        contestEntries
                            .filter((ce) => ce.contest_id === contest.id)
                            .map((ce) => ce.entry_id)
                    );

                    const eligibleEntries = entries.filter(
                        (entry) =>
                            eligibleIds.has(entry.id) &&
                            entry.entry_type === contest.entry_type
                    );

                    const selectedEntryId = votes[contest.id];

                    const selectedEntry = entries.find(
                        (entry) => entry.id === selectedEntryId
                    );

                    const isExpanded = expandedContest === contest.id;
                    const hasVoted = Boolean(selectedEntryId);

                    return (
                        <section
                            key={contest.id}
                            className={`vote-category ${
                                hasVoted ? 'has-voted' : ''
                            }`}
                        >
                            <button
                                type="button"
                                className="vote-category-header"
                                onClick={() =>
                                    setExpandedContest(
                                        isExpanded ? null : contest.id
                                    )
                                }
                                aria-expanded={isExpanded}
                                aria-controls={`contest-${contest.id}`}
                            >
                                <div className="vote-category-title">
                                    <h2>{contest.name}</h2>

                                    {hasVoted ? (
                                        <p className="vote-category-selection">
                                            ✓ Voted for: {selectedEntry?.costume_name ?? 'Selected costume'}
                                        </p>
                                    ) : (
                                        <p className="vote-category-hint">
                                            Tap to view contestants
                                        </p>
                                    )}
                                </div>

                                <span className="vote-category-chevron">
          {isExpanded ? '⌃' : '⌄'}
        </span>
                            </button>

                            {isExpanded && (
                                <div
                                    id={`contest-${contest.id}`}
                                    className="vote-category-content"
                                >
                                    {eligibleEntries.length === 0 ? (
                                        <p className="vote-empty-category">
                                            No contestants in this category yet.
                                        </p>
                                    ) : (
                                        <div className="vote-grid">
                                            {eligibleEntries.map((entry) => {
                                                const isOwnEntry =
                                                    entry.user_id === userId;

                                                const isSelected =
                                                    selectedEntryId === entry.id;

                                                return (
                                                    <div
                                                        key={entry.id}
                                                        className={`vote-card ${
                                                            isSelected ? 'selected' : ''
                                                        }`}
                                                    >
                                                        <h3 className="vote-costume-name">
                                                            {entry.costume_name}
                                                        </h3>

                                                        <div className="vote-image-container">
                                                            {entry.photo_url ? (
                                                                <img
                                                                    src={entry.photo_url}
                                                                    alt={entry.costume_name}
                                                                    className="vote-photo"
                                                                />
                                                            ) : (
                                                                <div className="vote-no-photo">
                                                                    ✦ No Photo ✦
                                                                </div>
                                                            )}
                                                        </div>

                                                        {isOwnEntry ? (
                                                            <div className="vote-own-entry">
                                                                Your Costume
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className="vote-button"
                                                                disabled={
                                                                    !votingOpen ||
                                                                    savingContest !== null ||
                                                                    isSelected
                                                                }
                                                                onClick={() =>
                                                                    submitVote(contest.id, entry.id)
                                                                }
                                                            >
                                                                {isSelected
                                                                    ? '✓ Your Vote'
                                                                    : 'Vote'}
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    );
                })}

            </section>
        </main>
    );
}
