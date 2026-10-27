import {
    useEffect,
    useState,
    useRef,
    type FormEvent,
    type ChangeEvent,
} from 'react';

import { useNavigate } from 'react-router-dom';

import { supabase } from '../services/supabase';
import { ensureAnonymousUser } from '../services/auth';
import { processCostumePhoto } from '../utils/imageProcessing';
import CostumePhotoFrame from "../components/CostumePhotoFrame.tsx";


type EntryType =
    | 'individual'
    | 'duo'
    | 'group';


interface Party {
    id: string;
    voting_start: string;
}


interface Contest {
    id: string;
    name: string;
    description: string | null;
    entry_type: EntryType;
}


function Register() {
    const navigate = useNavigate();

    const [now, setNow] = useState(Date.now());
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [processingPhoto, setProcessingPhoto] = useState(false);
    const [registrationCreated, setRegistrationCreated] = useState(false);
    const previewUrlRef = useRef<string | null>(null);

    useEffect(() => {
        const interval = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        return () => {
            if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        };
    }, []);

    async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;
        event.target.value = '';
        setProcessingPhoto(true);
        setError(null);

        try {
            const processed = await processCostumePhoto(file);
            const preview = URL.createObjectURL(processed);
            if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = preview;
            setPhotoFile(processed);
            setPhotoPreview(preview);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to process photo.');
        } finally {
            setProcessingPhoto(false);
        }
    }

    const [party, setParty] =
        useState<Party | null>(null);

    const registrationClosed =
        party !== null &&
        now >= new Date(party.voting_start).getTime();

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
                    .select('id, voting_start')
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

        if (!photoFile || processingPhoto) {
            setError('Please choose a costume photo and wait for it to finish processing.');
            return;
        }

        if (Date.now() >= new Date(party.voting_start).getTime()) {
            setNow(Date.now());
            setError('Registration has closed. Voting has begun.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {

            /*
             * Ensure the anonymous auth session
             * still exists.
             */
            const user = await ensureAnonymousUser();

            // The cutoff is also checked when the guest submits.
            if (Date.now() >= new Date(party.voting_start).getTime()) {
                throw new Error('Registration has closed. Voting has begun.');
            }

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


            // Registration exists now. If the photo fails, don't create a duplicate.
            setRegistrationCreated(true);

            const { data: newEntry, error: lookupError } = await supabase
                .from('entries')
                .select('id')
                .eq('party_id', party.id)
                .eq('user_id', user.id)
                .single();

            if (lookupError || !newEntry) {
                throw new Error('Entry created, but its photo could not be attached. Open Edit Entry from your dashboard.');
            }

            const extension = photoFile.type === 'image/jpeg'
                ? 'jpg'
                : photoFile.type === 'image/png'
                    ? 'png'
                    : 'webp';

            const photoPath = `${user.id}/${newEntry.id}-${crypto.randomUUID()}.${extension}`;
            const bucket = supabase.storage.from('costume-photos');
            const { error: uploadError } = await bucket.upload(photoPath, photoFile, {
                contentType: photoFile.type,
                upsert: false,
            });

            if (uploadError) throw uploadError;

            const { data: publicPhoto } = bucket.getPublicUrl(photoPath);
            const { error: photoError } = await supabase.rpc('update_entry_photo', {
                p_entry_id: newEntry.id,
                p_photo_path: photoPath,
                p_photo_url: publicPhoto.publicUrl,
            });

            if (photoError) {
                // Best-effort cleanup of the uploaded file.
                await bucket.remove([photoPath]);
                throw photoError;
            }

            navigate('/dashboard', { replace: true });

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


    if (registrationCreated) {
        return (
            <main className="page">
                <section className="registration-card">
                    <h1>Costume Registered</h1>
                    <p>Your entry was created, but we couldn't finish saving its photo.</p>
                    {error && <div className="form-error">{error}</div>}
                    <button type="button" className="enter-button"
                            onClick={() => navigate('/edit-entry')}>
                        Finish Photo in Edit Entry
                    </button>
                </section>
            </main>
        );
    }

    if (registrationClosed) {
        return (
            <main className="page">
                <section className="registration-card">
                    <div className="registration-header">
                        <div className="registration-symbol">✦</div>
                        <h1>Registration Closed</h1>
                        <p>The contestants are locked in! Registration closed when voting began.</p>
                    </div>
                    <button type="button" className="enter-button"
                            onClick={() => navigate('/vote')}>
                        View Voting
                    </button>
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
                                            ? 'e.g. Witch of Halloween Town'
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


                            {/* COSTUME PHOTO */}
                            <div className="form-section">
                                <label htmlFor="costumePhoto">Costume Photo</label>
                                <p className="form-help">
                                    Upload your costume photo. JPEG, PNG, WebP, and iPhone HEIC photos are supported through image conversion.
                                </p>
                                {photoPreview && (
                                    <CostumePhotoFrame
                                        photoUrl={photoPreview}
                                        costumeName={costumeName || 'Costume preview'}
                                    />
                                )}
                                <div className="costume-upload-container">
                                    <input
                                        id="costumePhoto"
                                        type="file"
                                        accept="image/*,.heic,.heif"
                                        onChange={handlePhotoChange}
                                        disabled={submitting || processingPhoto}
                                        required={!photoFile}
                                        className="costume-upload-input"
                                    />

                                    <label
                                        htmlFor="costumePhoto"
                                        className={`costume-upload-button ${
                                            submitting || processingPhoto ? 'disabled' : ''
                                        }`}
                                    >
                                        <span className="costume-upload-symbol">✦</span>

                                        {processingPhoto
                                            ? 'Preparing Photo...'
                                            : photoFile
                                                ? 'Change Costume Photo'
                                                : 'Upload Costume Photo'}

                                        <span className="costume-upload-symbol">✦</span>
                                    </label>
                                </div>
                                {processingPhoto && <p className="form-help">Preparing photo...</p>}
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
                                    processingPhoto ||
                                    registrationClosed ||
                                    !photoFile ||
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
