import {
    useEffect,
    useState,
} from 'react';

import {
    useNavigate,
} from 'react-router-dom';

import { supabase } from '../services/supabase';
import { ensureAnonymousUser } from '../services/auth';


type EntryType =
    | 'individual'
    | 'duo'
    | 'group';


interface Entry {
    id: string;
    costume_name: string;
    entry_type: EntryType;
    photo_url: string | null;
}


interface Contest {
    name: string;
}


function Dashboard() {
    const navigate = useNavigate();

    const [entry, setEntry] =
        useState<Entry | null>(null);

    const [contests, setContests] =
        useState<Contest[]>([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState<string | null>(null);


    useEffect(() => {
        async function loadDashboard() {
            try {
                /*
                 * Make sure this browser has an
                 * anonymous Supabase user.
                 */
                const user =
                    await ensureAnonymousUser();


                /*
                 * Get the party.
                 */
                const {
                    data: party,
                    error: partyError,
                } = await supabase
                    .from('parties')
                    .select('id')
                    .limit(1)
                    .single();

                if (partyError) {
                    throw partyError;
                }


                /*
                 * Find this user's entry directly.
                 *
                 * We no longer have participants.
                 */
                const {
                    data: entryData,
                    error: entryError,
                } = await supabase
                    .from('entries')
                    .select(
                        `
              id,
              costume_name,
              entry_type,
              photo_url
            `
                    )
                    .eq(
                        'party_id',
                        party.id
                    )
                    .eq(
                        'user_id',
                        user.id
                    )
                    .maybeSingle();

                if (entryError) {
                    throw entryError;
                }


                /*
                 * No entry means this browser has
                 * not registered yet.
                 */
                if (!entryData) {
                    navigate(
                        '/register',
                        {
                            replace: true,
                        }
                    );

                    return;
                }


                setEntry(
                    entryData as Entry
                );


                /*
                 * Get the contests this entry
                 * belongs to.
                 */
                const {
                    data: contestEntryData,
                    error: contestError,
                } = await supabase
                    .from('contest_entries')
                    .select(
                        `
              contests (
                name
              )
            `
                    )
                    .eq(
                        'entry_id',
                        entryData.id
                    );

                if (contestError) {
                    throw contestError;
                }



                const contestNames: Contest[] = (contestEntryData ?? [])
                    .flatMap((row) => {
                        const contests = row.contests;

                        if (!contests) {
                            return [];
                        }

                        const contestList = Array.isArray(contests)
                            ? contests
                            : [contests];

                        return contestList.map((contest) => ({
                            name: contest.name,
                        }));
                    });



                setContests(contestNames);

            } catch (err) {
                console.error(
                    'Dashboard error:',
                    err
                );

                if (err instanceof Error) {
                    setError(err.message);
                } else {
                    setError(
                        'Unable to load your entry.'
                    );
                }
            } finally {
                setLoading(false);
            }
        }


        loadDashboard();

    }, [navigate]);


    if (loading) {
        return (
            <main className="page">
                <section className="registration-card">
                    Loading your entry...
                </section>
            </main>
        );
    }


    if (error) {
        return (
            <main className="page">
                <section className="registration-card">
                    <h1>
                        Something went wrong
                    </h1>

                    <p>{error}</p>
                </section>
            </main>
        );
    }


    if (!entry) {
        return null;
    }


    function formatEntryType(
        type: EntryType
    ) {
        switch (type) {
            case 'individual':
                return 'Individual';

            case 'duo':
                return 'Duo';

            case 'group':
                return 'Group';
        }
    }


    return (
        <main className="page">

            <section className="registration-card">

                <div className="registration-header">

                    <div className="registration-symbol">
                        ✦
                    </div>

                    <p>
                        Welcome Back
                    </p>

                    <h1>
                        {entry.costume_name}
                    </h1>

                    <p>
                        {formatEntryType(
                            entry.entry_type
                        )}{' '}
                        Entry
                    </p>

                </div>


                {entry.photo_url && (
                    <div className="dashboard-photo">

                        <img
                            src={entry.photo_url}
                            alt={entry.costume_name}
                        />

                    </div>
                )}


                <div className="form-section">

                    <label>
                        Entered In
                    </label>

                    <div className="contest-list">

                        {contests.map(
                            (contest) => (

                                <div
                                    key={contest.name}
                                    className="contest-option selected"
                                >
                  <span className="contest-check">
                    ✦
                  </span>

                                    <span className="contest-info">
                    <strong>
                      {contest.name}
                    </strong>
                  </span>
                                </div>

                            )
                        )}

                    </div>

                </div>


                <button
                    type="button"
                    className="enter-button"
                    onClick={() =>
                        navigate('/edit-entry')
                    }
                >
                    Edit My Entry
                </button>

            </section>

        </main>
    );
}


export default Dashboard;