import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

interface Party {
    id: string;
    name: string;
    voting_start: string | null;
    voting_end: string | null;
}

function CelestialArt() {
    return (
        <div className="celestial-art">
            <svg
                viewBox="0 0 360 300"
                className="celestial-svg"
                aria-hidden="true"
            >
                <defs>
                    <pattern
                        id="engraving"
                        width="5"
                        height="5"
                        patternUnits="userSpaceOnUse"
                    >
                        <path
                            d="M-1 5 L5 -1"
                            stroke="currentColor"
                            strokeWidth="0.35"
                            opacity="0.18"
                        />
                    </pattern>
                </defs>

                {/* =========================================
            OUTER ORNAMENT
            ========================================= */}

                <circle
                    cx="180"
                    cy="148"
                    r="112"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                />

                <circle
                    cx="180"
                    cy="148"
                    r="105"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.8"
                />

                {/* Decorative cardinal points */}
                <g
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                >
                    <path d="M180 27 L180 40" />
                    <path d="M180 256 L180 269" />

                    <path d="M59 148 L72 148" />
                    <path d="M288 148 L301 148" />
                </g>

                {/* =========================================
            RAYS
            ========================================= */}

                <g
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.9"
                    opacity="0.8"
                >
                    <path d="M180 39 L180 61" />
                    <path d="M180 235 L180 257" />

                    <path d="M72 148 L94 148" />
                    <path d="M266 148 L288 148" />

                    <path d="M103 72 L118 87" />
                    <path d="M242 209 L257 224" />

                    <path d="M103 224 L118 209" />
                    <path d="M242 87 L257 72" />

                    <path d="M132 47 L140 65" />
                    <path d="M220 231 L228 249" />

                    <path d="M81 112 L101 120" />
                    <path d="M259 176 L279 184" />

                    <path d="M81 184 L101 176" />
                    <path d="M259 120 L279 112" />
                </g>

                {/* =========================================
            STARS
            ========================================= */}

                <g fill="currentColor">

                    {/* Large four-point stars */}
                    <path d="
            M104 101
            L108 111
            L118 115
            L108 119
            L104 129
            L100 119
            L90 115
            L100 111
            Z
          " />

                    <path d="
            M260 98
            L264 108
            L274 112
            L264 116
            L260 126
            L256 116
            L246 112
            L256 108
            Z
          " />

                    {/* Small stars */}
                    <path d="
            M91 158
            L94 164
            L100 167
            L94 170
            L91 176
            L88 170
            L82 167
            L88 164
            Z
          " />

                    <path d="
            M270 158
            L273 164
            L279 167
            L273 170
            L270 176
            L267 170
            L261 167
            L267 164
            Z
          " />

                    <circle cx="123" cy="57" r="2" />
                    <circle cx="237" cy="57" r="2" />
                    <circle cx="78" cy="145" r="1.5" />
                    <circle cx="282" cy="145" r="1.5" />
                </g>

                {/* =========================================
            CELESTIAL SUN / MOON
            ========================================= */}

                <circle
                    cx="180"
                    cy="148"
                    r="69"
                    fill="var(--paper)"
                    stroke="currentColor"
                    strokeWidth="2"
                />

                <circle
                    cx="180"
                    cy="148"
                    r="62"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.8"
                    opacity="0.7"
                />

                {/* Engraving texture inside celestial body */}
                <circle
                    cx="180"
                    cy="148"
                    r="67"
                    fill="url(#engraving)"
                />

                {/* =========================================
            CELESTIAL FACE
            ========================================= */}

                {/* Left eye */}
                <path
                    d="
            M143 137
            C149 132 157 132 163 137
            C157 141 149 141 143 137
            Z
          "
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                />

                <circle
                    cx="153"
                    cy="137"
                    r="2.2"
                    fill="currentColor"
                />

                {/* Right eye */}
                <path
                    d="
            M197 137
            C203 132 211 132 217 137
            C211 141 203 141 197 137
            Z
          "
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                />

                <circle
                    cx="207"
                    cy="137"
                    r="2.2"
                    fill="currentColor"
                />

                {/* Nose */}
                <path
                    d="
            M180 139
            C177 149 176 154 181 157
            L187 155
          "
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                />

                {/* Mouth */}
                <path
                    d="
            M162 169
            C173 175 187 175 198 168
          "
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                />

                {/* =========================================
            MOON / SUN ORNAMENTATION
            ========================================= */}

                <g
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.8"
                    opacity="0.8"
                >
                    <path d="M137 119 C143 113 149 110 156 108" />
                    <path d="M223 119 C217 113 211 110 204 108" />

                    <path d="M136 177 C142 184 149 188 157 190" />
                    <path d="M224 177 C218 184 211 188 203 190" />
                </g>

                {/* Tiny celestial dots */}
                <g fill="currentColor">
                    <circle cx="129" cy="151" r="1.4" />
                    <circle cx="231" cy="151" r="1.4" />
                    <circle cx="157" cy="111" r="1.3" />
                    <circle cx="203" cy="111" r="1.3" />
                    <circle cx="156" cy="190" r="1.3" />
                    <circle cx="204" cy="190" r="1.3" />
                </g>

                {/* =========================================
            ORNAMENTAL CORNERS
            ========================================= */}

                <g
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                >
                    {/* Upper left */}
                    <path d="M88 62 C98 53 107 48 119 45" />
                    <path d="M92 67 C102 59 111 54 121 52" />

                    {/* Upper right */}
                    <path d="M272 62 C262 53 253 48 241 45" />
                    <path d="M268 67 C258 59 249 54 239 52" />

                    {/* Lower left */}
                    <path d="M88 234 C98 243 107 248 119 251" />
                    <path d="M92 229 C102 237 111 242 121 244" />

                    {/* Lower right */}
                    <path d="M272 234 C262 243 253 248 241 251" />
                    <path d="M268 229 C258 237 249 242 239 244" />
                </g>

                {/* =========================================
            BOTTOM ORNAMENT
            ========================================= */}

                <g
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                >
                    <path d="
            M135 265
            C148 255 161 255 180 265
            C199 255 212 255 225 265
          " />

                    <path d="M150 272 L210 272" />
                </g>

                <circle
                    cx="180"
                    cy="265"
                    r="3"
                    fill="var(--paper)"
                    stroke="currentColor"
                    strokeWidth="1"
                />

            </svg>
        </div>
    );
}

function Home() {
    const navigate = useNavigate();

    const [party, setParty] = useState<Party | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadParty() {
            const { data, error } = await supabase
                .from('parties')
                .select('*')
                .limit(1)
                .single();

            if (error) {
                setError(error.message);
                setLoading(false);
                return;
            }

            setParty(data);
            setLoading(false);
        }

        loadParty();
    }, []);

    if (loading) {
        return (
            <main className="tarot-page">
                <div className="loading">
                    Loading...
                </div>
            </main>
        );
    }

    if (error || !party) {
        return (
            <main className="tarot-page">
                <div className="error">
                    <h1>Something went wrong</h1>
                    <p>{error ?? 'Party not found.'}</p>
                </div>
            </main>
        );
    }

    const votingStart = party.voting_start
        ? new Date(party.voting_start).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
        })
        : null;

    return (
        <main className="tarot-page">
            <section className="tarot-card">

                {/* Outer frame */}
                <div className="tarot-card-inner">

                    {/* Top number */}
                    <div className="card-number">
                        XIX
                    </div>

                    {/* Top ornament */}
                    <div className="card-ornament">
                        ✦
                    </div>

                    {/* Artwork */}
                    <CelestialArt />

                    {/* Title */}
                    <div className="card-title">
                        <span className="title-line" />
                        <h1>{party.name}</h1>
                        <span className="title-line" />
                    </div>

                    <p className="card-subtitle">
                        THE NIGHT OF COSTUMES
                    </p>

                    <p className="card-description">
                        Gather beneath the moon and reveal
                        what you've conjured for the night.
                    </p>

                    {/* Enter button */}
                    <button
                        className="tarot-button"
                        onClick={() => navigate('/register')}
                    >
                        <span>✦</span>
                        ENTER THE PARTY
                        <span>✦</span>
                    </button>

                    {votingStart && (
                        <div className="voting-info">
                            <span>VOTING OPENS</span>
                            <strong>{votingStart}</strong>
                        </div>
                    )}

                    {/* Bottom ornament */}
                    <div className="bottom-ornament">
                        <span>✦</span>
                        <span>☾</span>
                        <span>✦</span>
                    </div>

                </div>
            </section>
        </main>
    );
}

export default Home;