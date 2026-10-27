import {
    useEffect,
    useState,
    useRef,
    type FormEvent,
} from 'react';

import { useNavigate } from 'react-router-dom';

import { supabase } from '../services/supabase';
import { ensureAnonymousUser } from '../services/auth';
import { processCostumePhoto } from '../utils/imageProcessing';
import type { ChangeEvent } from 'react';
import CostumePhotoFrame from "../components/CostumePhotoFrame.tsx";

type EntryType =
    | 'individual'
    | 'duo'
    | 'group';


interface Entry {
    id: string;
    party_id: string;
    costume_name: string;
    entry_type: EntryType;
    photo_url: string | null;
}


interface Contest {
    id: string;
    name: string;
    description: string | null;
    entry_type: EntryType;
}


function EditEntry() {
    const navigate = useNavigate();

    const [entry, setEntry] =
        useState<Entry | null>(null);

    const [costumeName, setCostumeName] =
        useState('');

    const [photoFile, setPhotoFile] =
        useState<File | null>(null);

    const [photoPreview, setPhotoPreview] =
        useState<string | null>(null);

    const [contests, setContests] =
        useState<Contest[]>([]);

    const [processingPhoto, setProcessingPhoto] =
        useState(false);

    const previewUrlRef = useRef<string | null>(null);

    const [
        selectedContests,
        setSelectedContests,
    ] = useState<string[]>([]);

    const [loading, setLoading] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

    const [error, setError] =
        useState<string | null>(null);

    useEffect(() => {
        return () => {
            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
            }
        }
    }, []);

    useEffect(() => {
        async function loadEntry() {
            try {
                const user =
                    await ensureAnonymousUser();


                /*
                 * Get the current party.
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
                 * Get this user's entry.
                 */
                const {
                    data: entryData,
                    error: entryError,
                } = await supabase
                    .from('entries')
                    .select(
                        `
              id,
              party_id,
              costume_name,
              entry_type,
              photo_url
            `
                    )
                    .eq('party_id', party.id)
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (entryError) {
                    throw entryError;
                }


                /*
                 * Somehow they reached /edit-entry
                 * without registering.
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


                const currentEntry =
                    entryData as Entry;

                setEntry(currentEntry);

                setCostumeName(currentEntry.costume_name);

                setPhotoPreview(currentEntry.photo_url);


                /*
                 * Load the contests available for
                 * this particular entry type.
                 */
                const {
                    data: contestData,
                    error: contestError,
                } = await supabase
                    .from('contests')
                    .select(
                        `
              id,
              name,
              description,
              entry_type
            `
                    )
                    .eq(
                        'party_id',
                        currentEntry.party_id
                    )
                    .eq(
                        'entry_type',
                        currentEntry.entry_type
                    )
                    .order('created_at');

                if (contestError) {
                    throw contestError;
                }


                setContests(
                    (contestData ?? []) as Contest[]
                );


                /*
                 * Find the contests this entry is
                 * currently registered in.
                 */
                const {
                    data: currentContestEntries,
                    error: currentContestError,
                } = await supabase
                    .from('contest_entries')
                    .select('contest_id')
                    .eq(
                        'entry_id',
                        currentEntry.id
                    );

                if (currentContestError) {
                    throw currentContestError;
                }


                setSelectedContests(
                    (currentContestEntries ?? [])
                        .map(
                            (contestEntry) =>
                                contestEntry.contest_id
                        )
                );

            } catch (err) {
                console.error(
                    'Edit entry error:',
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


        loadEntry();

    }, [navigate]);


    function toggleContest(
        contestId: string
    ) {
        /*
         * Only Individual entries should be
         * able to change their categories.
         */
        if (
            entry?.entry_type !==
            'individual'
        ) {
            return;
        }


        setSelectedContests(
            (current) => {
                if (
                    current.includes(contestId)
                ) {
                    return current.filter(
                        (id) =>
                            id !== contestId
                    );
                }

                return [
                    ...current,
                    contestId,
                ];
            }
        );
    }

    async function handlePhotoChange(
        event: ChangeEvent<HTMLInputElement>
    ) {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        event.target.value = '';

        setError(null);
        setProcessingPhoto(true);

        try {
            const processedFile =
                await processCostumePhoto(file);

            setPhotoFile(processedFile);

            const previewUrl =
                URL.createObjectURL(processedFile);

            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
            }

            previewUrlRef.current = previewUrl;
            setPhotoPreview(previewUrl);

        } catch (err) {
            console.error('Photo processing error:', err);

            setError(
                err instanceof Error
                    ? err.message
                    : 'Unable to process photo.'
            );
        } finally {
            setProcessingPhoto(false);
        }
    }

    async function handleSubmit(
        event: FormEvent
    ) {
        event.preventDefault();


        if (
            !entry ||
            !costumeName.trim()
        ) {
            return;
        }

        if (processingPhoto) {
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


        setSaving(true);
        setError(null);


        try {
            /*
             * Make sure the auth session still
             * exists before calling the RPC.
             */
            await ensureAnonymousUser();


            const {
                error: updateError,
            } = await supabase.rpc(
                'update_entry',
                {
                    p_entry_id:
                    entry.id,

                    p_costume_name:
                        costumeName.trim(),

                    p_contest_ids:
                    selectedContests,
                }
            );


            if (updateError) {
                throw updateError;
            }

            if (photoFile) {
                const user = await ensureAnonymousUser();

                const extension = photoFile.type === 'image/jpeg'
                    ? 'jpg'
                    : photoFile.type === 'image/png'
                        ? 'png'
                        : 'webp';

                const photoPath =
                    `${user.id}/${entry.id}-${crypto.randomUUID()}.${extension}`;

                const { error: uploadError } =
                    await supabase.storage
                        .from('costume-photos')
                        .upload(photoPath, photoFile, {
                            contentType: photoFile.type,
                            upsert: false,
                        });

                if (uploadError) {
                    throw uploadError;
                }

                const { data } = supabase.storage
                    .from('costume-photos')
                    .getPublicUrl(photoPath);

                const { error: photoUpdateError } =
                    await supabase.rpc('update_entry_photo', {
                        p_entry_id: entry.id,
                        p_photo_path: photoPath,
                        p_photo_url: data.publicUrl,
                    });

                if (photoUpdateError) {
                    throw photoUpdateError;
                }
            }

            navigate(
                '/dashboard',
                {
                    replace: true,
                }
            );

        } catch (err) {
            console.error(
                'Update entry error:',
                err
            );

            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError(
                    'Unable to update your entry.'
                );
            }
        } finally {
            setSaving(false);
        }
    }


    if (loading) {
        return (
            <main className="page">

                <section className="registration-card">
                    Loading your entry...
                </section>

            </main>
        );
    }


    if (error && !entry) {
        return (
            <main className="page">

                <section className="registration-card">

                    <h1>
                        Something went wrong
                    </h1>

                    <p>
                        {error}
                    </p>

                </section>

            </main>
        );
    }


    if (!entry) {
        return null;
    }


    const entryTypeLabel =
        entry.entry_type === 'individual'
            ? 'Individual'
            : entry.entry_type === 'duo'
                ? 'Duo'
                : 'Group';


    return (
        <main className="page">

            <section className="registration-card">

                <div className="registration-header">

                    <div className="registration-symbol">
                        ✦
                    </div>

                    <h1>
                        Edit Your Entry
                    </h1>

                    <p>
                        {entryTypeLabel} Entry
                    </p>

                </div>


                <form onSubmit={handleSubmit}>

                    {/* COSTUME PHOTO */}

                    <div className="form-section">
                        <label htmlFor="costumePhoto">
                            Costume Photo
                        </label>

                        <p className="form-help">
                            Show off your costume!
                            JPEG, PNG, or WebP. Maximum 5 MB.
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
                                disabled={saving || processingPhoto}
                                className="costume-upload-input"
                            />

                            <label
                                htmlFor="costumePhoto"
                                className={`costume-upload-button ${
                                    saving || processingPhoto ? 'disabled' : ''
                                }`}
                            >
                                <span className="costume-upload-symbol">✦</span>
                                {processingPhoto
                                    ? 'Preparing Photo...'
                                    : 'Change Costume Photo'}
                                <span className="costume-upload-symbol">✦</span>
                            </label>
                        </div>

                    </div>

                    {/* COSTUME NAME */}

                    <div className="form-section">

                        <label htmlFor="costumeName">
                            Costume Name
                        </label>

                        <input
                            id="costumeName"
                            type="text"
                            value={costumeName}
                            onChange={(event) =>
                                setCostumeName(
                                    event.target.value
                                )
                            }
                            maxLength={80}
                            required
                        />

                    </div>


                    {/* INDIVIDUAL CONTESTS */}

                    {entry.entry_type ===
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

                                    {contests.map(
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


                    {/* DUO / GROUP CONTEST */}

                    {entry.entry_type !==
                        'individual' && (

                            <div className="form-section">

                                <label>
                                    Your Contest
                                </label>

                                {contests.map(
                                    (contest) => (

                                        <div
                                            key={contest.id}
                                            className="automatic-contest"
                                        >

                    <span>
                      ✦
                    </span>

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

                                        </div>

                                    )
                                )}

                            </div>
                        )}


                    {/* ERROR */}

                    {error && (
                        <div className="form-error">
                            {error}
                        </div>
                    )}


                    {/* SAVE */}

                    <button
                        type="submit"
                        className="enter-button"
                        disabled={
                            saving ||
                            processingPhoto ||
                            !costumeName.trim() ||
                            selectedContests.length === 0
                        }
                    >
                        {saving
                            ? 'Saving...'
                            : 'Save Changes'}
                    </button>


                    {/* CANCEL */}

                    <button
                        type="button"
                        className="edit-cancel-button"
                        disabled={saving}
                        onClick={() =>
                            navigate('/dashboard')
                        }
                    >
                        Cancel
                    </button>

                </form>

            </section>

        </main>
    );
}


export default EditEntry;