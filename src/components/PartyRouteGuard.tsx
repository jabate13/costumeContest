import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../services/supabase"
import {
    getPartyPhase,
    type PartyPhase,
    type PartySchedule
} from '../utils/partyPhase';

const PARTY_ID = '32586d7a-6ade-4bfb-b40a-a0fa8f5e1cc5';

interface Props {
    allowedPhases: PartyPhase[];
    children: React.ReactNode;
}

export default function PartyRouteGuard({allowedPhases, children}: Props) {
    const [party, setParty] = useState<PartySchedule | null>(null);
    const [now, setNow] = useState(Date.now());
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                setNow(Date.now());
                void loadParty();
            }
        };

        document.addEventListener(
            'visibilitychange',
            handleVisibilityChange
        );

        async function loadParty() {
            const {data, error} = await supabase
                .from('parties')
                .select('voting_start, voting_end')
                .eq('id', PARTY_ID)
                .single();

            if (!active) return;

            if (error) {
                setError(error.message);
            } else {
                setParty(data);
                setError(null);
            }
        }

        void loadParty();

        const refresh = window.setInterval(() => {
            void loadParty();
        }, 30000);

        const clock = window.setInterval(() => {
            setNow(Date.now());
        }, 1000);

        return () => {
            active = false;

            window.clearInterval(refresh);
            window.clearInterval(clock);

            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange
            );
        };
    }, []);

    if (error) {
        return <div className="error">{error}</div>;
    }

    if (!party) {
        return <div className="loading">Loading...</div>;
    }

    const phase = getPartyPhase(party, now);

    if (!allowedPhases.includes(phase)) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}