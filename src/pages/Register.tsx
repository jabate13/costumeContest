import {
    useEffect,
    useState,
    type FormEvent,
} from 'react';

import { useNavigate } from 'react-router-dom';

import { supabase } from '../services/supabase';
import { ensureAnonymousUser } from '../services/auth';


type EntryType =
    | 'individual'
    | 'duo'
    | 'group';


interface Party {
    id: string;
}


interface Contest {
    id: string;
    name: string;
    description: string | null;
    entry_type: EntryType;
}


function Register() {
    const navigate = useNavigate();

    const [party, setParty] =
        useState<Party | null>(null);

    const [entryType, setEntryType] =
        useState<EntryType | null>(null);

    const [costumeName, setCostumeName] =
        useState('');

    const [contests, setContests] =
        useState<Contest[]>([]);

    const [
        selectedContests,
        setSelectedContests,
    ] = useState<string[]>([]);

    const [loading, setLoading] =
        useState(true);

    const [submitting, setSubmitting] =
        useState(false);

    const [error, setError] =
        useState<string | null>(null);


    useEffect(() => {
        async function initialize() {
            try {
                const user =
                    await ensureAnonymousUser();


                /*
                 * Get our party.
                 */
                const {
                    data: partyData,
                    error: partyError,
                } = await supabase
                    .from('parties')
                    .select('id')
                    .limit(1)
                    .single();

                if (partyError) {
                    throw partyError;
                }

                setParty(partyData);


                /*
                 * Check whether this user already
                 * registered for this party.
                 */
                const {
                    data: existingEntry,
                    error: entryError,
                } = await supabase
                    .from('entries')
                    .select('id')
                    .eq('party_id', partyData.id)
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (entryError) {
                    throw entryError;
                }

                if (existingEntry) {
                    navigate('/dashboard', {
                        replace: true,
                    });

                    return;
                }


                /*
                 * Load every contest for the party.
                 *
                 * We'll filter them in React based
                 * on the chosen entry type.
                 */
                const {
                    data: contestData,
                    error: contestError,
                } = await supabase
                    .from('contests')
                    .select(
                        'id, name, description, entry_type'
                    )
                    .eq('party_id', partyData.id)
                    .order('created_at');

                if (contestError) {
                    throw contestError;
                }

                setContests(
                    (contestData ?? []) as Contest[]
                );

            } catch (err) {
                console.error(err);

                if (err instanceof Error) {
                    setError(err.message);
                } else {
                    setError(
                        'Unable to load registration.'
                    );
                }
            } finally {
                setLoading(false);
            }
        }

        initialize();
    }, [navigate]);


    /*
     * Called whenever the guest chooses
     * Individual, Duo, or Group.
     */
    function chooseEntryType(
        type: EntryType
    ) {
        setEntryType(type);
        setSelectedContests([]);

        /*
         * Duo and Group don't need a category
         * picker if there's only one contest
         * for each type.
         *
         * Automatically select their contest.
         */
        if (
            type === 'duo' ||
            type === 'group'
        ) {
            const matching =
                contests.filter(
                    (contest) =>
                        contest.entry_type === type
                );

            setSelectedContests(
                matching.map(
                    (contest) => contest.id
                )
            );
        }
    }


    function toggleContest(
        contestId: string
    ) {
        setSelectedContests(
            (current) => {
                if (
                    current.includes(contestId)
                ) {
                    return current.filter(
                        (id) => id !== contestId
                    );
                }

                return [
                    ...current,
                    contestId,
                ];
            }
        );
    }


    async function handleSubmit(
        event: FormEvent
    ) {
        event.preventDefault();

        if (
            !party ||
            !entryType ||
            !costumeName.trim()
        ) {
            return;
        }

        if (
            selectedContests.length === 0
        ) {
            setError(
                'Please select at least one contest.'
            );

            return;
        }

        setSubmitting(true);
        setError(null);

        try {

            /*
             * Ensure the anonymous auth session
             * still exists.
             */
            await ensureAnonymousUser();


            /*
             * One transactional database call.
             */
            const {
                error: registrationError,
            } = await supabase.rpc(
                'create_entry',
                {
                    p_party_id:
                    party.id,

                    p_costume_name:
                        costumeName.trim(),

                    p_entry_type:
                    entryType,

                    p_contest_ids:
                    selectedContests,
                }
            );

            if (registrationError) {
                throw registrationError;
            }


            navigate('/dashboard', {
                replace: true,
            });

        } catch (err) {
            console.error(err);

            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError(
                    'Unable to register your costume.'
                );
            }
        } finally {
            setSubmitting(false);
        }
    }


    if (loading) {
        return (
            <main className="page">
                <section className="registration-card">
                    Loading registration...
                </section>
            </main>
        );
    }


    const individualContests =
        contests.filter(
            (contest) =>
                contest.entry_type ===
                'individual'
        );

    const automaticContest =
        entryType
            ? contests.find(
                (contest) =>
                    contest.entry_type ===
                    entryType
            )
            : null;


    return (
        <main className="page">

            <section className="registration-card">

                <div className="registration-header">

                    <div className="registration-symbol">
                        ✦
                    </div>

                    <h1>
                        Enter the Contest
                    </h1>

                    <p>
                        Choose how your costume will
                        enter the night's competition.
                    </p>

                </div>


                <form onSubmit={handleSubmit}>

                    {/* ENTRY TYPE */}

                    <div className="form-section">

                        <label>
                            Entry Type
                        </label>

                        <div className="entry-type-grid">

                            {(
                                [
                                    'individual',
                                    'duo',
                                    'group',
                                ] as EntryType[]
                            ).map((type) => (

                                <button
                                    key={type}
                                    type="button"
                                    className={
                                        `entry-type-option ${
                                            entryType === type
                                                ? 'selected'
                                                : ''
                                        }`
                                    }
                                    onClick={() =>
                                        chooseEntryType(type)
                                    }
                                >

                  <span className="entry-type-symbol">
                    {type === 'individual'
                        ? '☾'
                        : type === 'duo'
                            ? '☾ ☾'
                            : '☾ ☾ ☾'}
                  </span>

                                    <span>
                    {type}
                  </span>

                                </button>

                            ))}

                        </div>

                    </div>


                    {/* REST OF FORM */}

                    {entryType && (
                        <>

                            <div className="form-section">

                                <label htmlFor="costumeName">
                                    Costume Name
                                </label>

                                <input
                                    id="costumeName"
                                    type="text"
                                    placeholder={
                                        entryType === 'individual'
                                            ? 'e.g. Sexy Gandalf'
                                            : entryType === 'duo'
                                                ? 'e.g. Mario & Luigi'
                                                : 'e.g. The Scooby Gang'
                                    }
                                    value={costumeName}
                                    onChange={(event) =>
                                        setCostumeName(
                                            event.target.value
                                        )
                                    }
                                    required
                                    maxLength={80}
                                />

                            </div>


                            {/* INDIVIDUAL CATEGORIES */}

                            {entryType ===
                                'individual' && (

                                    <div className="form-section">

                                        <label>
                                            Choose Your Contests
                                        </label>

                                        <p className="form-help">
                                            Enter as many individual
                                            categories as you'd like.
                                        </p>


                                        <div className="contest-list">

                                            {individualContests.map(
                                                (contest) => {

                                                    const selected =
                                                        selectedContests.includes(
                                                            contest.id
                                                        );

                                                    return (
                                                        <button
                                                            key={contest.id}
                                                            type="button"
                                                            className={
                                                                `contest-option ${
                                                                    selected
                                                                        ? 'selected'
                                                                        : ''
                                                                }`
                                                            }
                                                            onClick={() =>
                                                                toggleContest(
                                                                    contest.id
                                                                )
                                                            }
                                                        >

                            <span
                                className="contest-check"
                            >
                              {selected
                                  ? '✓'
                                  : ''}
                            </span>

                                                            <span
                                                                className="contest-info"
                                                            >

                              <strong>
                                {contest.name}
                              </strong>

                                                                {contest.description && (
                                                                    <small>
                                                                        {
                                                                            contest.description
                                                                        }
                                                                    </small>
                                                                )}

                            </span>

                                                        </button>
                                                    );
                                                }
                                            )}

                                        </div>

                                    </div>
                                )}


                            {/* DUO / GROUP */}

                            {entryType !==
                                'individual' &&
                                automaticContest && (

                                    <div className="form-section">

                                        <label>
                                            Your Contest
                                        </label>

                                        <div className="automatic-contest">

                    <span>
                      ✦
                    </span>

                                            <strong>
                                                {automaticContest.name}
                                            </strong>

                                            {automaticContest.description && (
                                                <small>
                                                    {
                                                        automaticContest.description
                                                    }
                                                </small>
                                            )}

                                        </div>

                                    </div>
                                )}


                            {error && (
                                <div className="form-error">
                                    {error}
                                </div>
                            )}


                            <button
                                type="submit"
                                className="enter-button"
                                disabled={
                                    submitting ||
                                    !costumeName.trim() ||
                                    selectedContests.length === 0
                                }
                            >
                                {submitting
                                    ? 'Entering...'
                                    : `Enter as ${
                                        entryType ===
                                        'individual'
                                            ? 'Individual'
                                            : entryType ===
                                            'duo'
                                                ? 'Duo'
                                                : 'Group'
                                    }`}
                            </button>

                        </>
                    )}

                </form>

            </section>

        </main>
    );
}

export default Register;